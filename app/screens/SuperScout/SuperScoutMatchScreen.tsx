import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_SUPER_SCOUT_FIELDS, SuperScoutFieldDefinition } from '@/constants/superScout';
import { getDbOrThrow, schema } from '@/db';
import type { MatchSchedule } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { and, eq, inArray } from 'drizzle-orm';

import { apiRequest } from '@/app/services/api';
import { getActiveEvent } from '@/app/services/logged-in-event';

type AllianceColor = 'red' | 'blue';
type StartingPosition = 'LEFT' | 'CENTER' | 'RIGHT' | 'NO_SHOW';
type ViewKey = 'starting' | 'comments' | 'ratings';

type TeamInputState = {
  startingPosition: StartingPosition | null;
  cannedComments: string[];
  notes: string;
  driverRating: number;
  robotOverall: number;
  defenseRating: number;
};

const STARTING_POSITIONS: { key: StartingPosition; label: string }[] = [
  { key: 'LEFT', label: 'Left' },
  { key: 'CENTER', label: 'Center' },
  { key: 'RIGHT', label: 'Right' },
  { key: 'NO_SHOW', label: 'No Show' },
];

const ALLIANCE_DETAILS: Record<AllianceColor, { label: string }> = {
  red: { label: 'Red Alliance' },
  blue: { label: 'Blue Alliance' },
};

const DEFAULT_DEFENSE_REQUIRED_KEYS = new Set(
  DEFAULT_SUPER_SCOUT_FIELDS.filter((field) => field.requiresDefenseRating).map((field) => field.key),
);

const createDefaultTeamState = (): TeamInputState => ({
  startingPosition: null,
  cannedComments: [],
  notes: '',
  driverRating: 0,
  robotOverall: 0,
  defenseRating: 0,
});

const getMatchLevelLabel = (matchLevel: string | undefined) => {
  const normalized = matchLevel?.toLowerCase();
  switch (normalized) {
    case 'qm':
      return 'Qualification';
    case 'sf':
      return 'Playoff';
    case 'qf':
      return 'Quarterfinal';
    case 'f':
      return 'Final';
    default:
      return matchLevel?.toUpperCase() ?? 'Match';
  }
};

const renderTeamNumber = (value?: number) => (value === undefined ? 'TBD' : value);

const normalizeMatchLevel = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const findNextMatchParams = (
  schedule: MatchSchedule[],
  {
    matchLevel,
    matchNumber,
    alliance,
  }: { matchLevel: string; matchNumber: number; alliance: AllianceColor },
) => {
  const normalizedLevel = normalizeMatchLevel(matchLevel);

  const candidates = schedule
    .filter((row) => normalizeMatchLevel(row.matchLevel) === normalizedLevel)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  for (const match of candidates) {
    if (match.matchNumber > matchNumber) {
      const params: Record<string, string> = {
        matchLevel: match.matchLevel,
        matchNumber: String(match.matchNumber),
        alliance,
      };

      if (match.eventKey) {
        params.eventKey = match.eventKey;
      }

      const allianceTeams =
        alliance === 'red'
          ? [match.red1Id, match.red2Id, match.red3Id]
          : [match.blue1Id, match.blue2Id, match.blue3Id];

      allianceTeams.forEach((teamNumber, index) => {
        if (typeof teamNumber === 'number' && Number.isFinite(teamNumber)) {
          params[`team${index + 1}`] = String(teamNumber);
        }
      });

      return params;
    }
  }

  return null;
};

export function createSuperScoutMatchScreenPropsFromParams(params: {
  matchLevel?: string | string[];
  matchNumber?: string | string[];
  alliance?: string | string[];
  team1?: string | string[];
  team2?: string | string[];
  team3?: string | string[];
  eventKey?: string | string[];
}) {
  const toSingleValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parseNumberParam = (value: string | string[] | undefined) => {
    const raw = toSingleValue(value);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const allianceValue = toSingleValue(params.alliance);
  const normalizedAlliance =
    allianceValue === 'red' || allianceValue === 'blue' ? allianceValue : 'red';

  return {
    matchLevel: toSingleValue(params.matchLevel),
    matchNumber: parseNumberParam(params.matchNumber),
    eventKey: toSingleValue(params.eventKey),
    alliance: normalizedAlliance,
    teams: [
      parseNumberParam(params.team1),
      parseNumberParam(params.team2),
      parseNumberParam(params.team3),
    ],
  } satisfies Omit<SuperScoutMatchScreenProps, 'onClose'>;
}

export interface SuperScoutMatchScreenProps {
  matchLevel?: string;
  matchNumber?: number;
  eventKey?: string;
  alliance: AllianceColor;
  teams: (number | undefined)[];
  onClose: () => void;
}

export function SuperScoutMatchScreen({
  matchLevel,
  matchNumber,
  eventKey,
  alliance,
  teams,
  onClose,
}: SuperScoutMatchScreenProps) {
  const router = useRouter();
  const [teamInputs, setTeamInputs] = useState<Record<string, TeamInputState>>(() => {
    const initial: Record<string, TeamInputState> = {};
    teams.forEach((teamNumber, index) => {
      const teamKey = String(teamNumber ?? `slot-${index}`);
      initial[teamKey] = createDefaultTeamState();
    });
    return initial;
  });

  const [availableFields, setAvailableFields] = useState<SuperScoutFieldDefinition[]>(
    DEFAULT_SUPER_SCOUT_FIELDS,
  );

  const [activeView, setActiveView] = useState<ViewKey>('starting');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTeamInputs((current) => {
      const updated: Record<string, TeamInputState> = {};
      teams.forEach((teamNumber, index) => {
        const key = String(teamNumber ?? `slot-${index}`);
        updated[key] = current[key] ?? createDefaultTeamState();
      });
      return updated;
    });
  }, [teams]);

  useEffect(() => {
    try {
      const db = getDbOrThrow();
      const rows = db.select().from(schema.superScoutFields).all();

      if (!Array.isArray(rows) || rows.length === 0) {
        setAvailableFields(DEFAULT_SUPER_SCOUT_FIELDS);
        return;
      }

      const mapped = rows
        .map((row) => {
          if (typeof row?.key !== 'string' || typeof row?.label !== 'string') {
            return null;
          }

          const normalizedKey = row.key.trim();

          if (normalizedKey.length === 0) {
            return null;
          }

          const normalizedLabel = row.label.trim();

          const field: SuperScoutFieldDefinition = {
            key: normalizedKey,
            label: normalizedLabel.length > 0 ? normalizedLabel : normalizedKey,
          };

          if (DEFAULT_DEFENSE_REQUIRED_KEYS.has(normalizedKey)) {
            field.requiresDefenseRating = true;
          }

          return field;
        })
        .filter((field): field is SuperScoutFieldDefinition => field !== null);

      setAvailableFields(mapped.length > 0 ? mapped : DEFAULT_SUPER_SCOUT_FIELDS);
    } catch (error) {
      console.error('Failed to load super scout fields', error);
      setAvailableFields(DEFAULT_SUPER_SCOUT_FIELDS);
    }
  }, []);

  const defenseRequiredKeys = useMemo(
    () =>
      new Set(
        availableFields
          .filter((field) => field.requiresDefenseRating)
          .map((field) => field.key),
      ),
    [availableFields],
  );

  const availableFieldKeys = useMemo(
    () => availableFields.map((field) => field.key),
    [availableFields],
  );

  useEffect(() => {
    const validKeys = new Set(availableFields.map((field) => field.key));

    setTeamInputs((current) => {
      let hasChanges = false;
      const nextState: Record<string, TeamInputState> = {};

      Object.entries(current).forEach(([teamKey, state]) => {
        const filteredComments = state.cannedComments.filter((key) => validKeys.has(key));
        const hasDefenseComment = filteredComments.some((key) => defenseRequiredKeys.has(key));
        const needsUpdate =
          filteredComments.length !== state.cannedComments.length ||
          (!hasDefenseComment && state.defenseRating !== 0);

        if (needsUpdate) {
          hasChanges = true;
          nextState[teamKey] = {
            ...state,
            cannedComments: filteredComments,
            defenseRating: hasDefenseComment ? state.defenseRating : 0,
          };
        } else {
          nextState[teamKey] = state;
        }
      });

      return hasChanges ? nextState : current;
    });
  }, [availableFields, defenseRequiredKeys]);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(15, 23, 42, 0.1)';
  const chipBackground = useThemeColor({ light: '#E2E8F0', dark: '#374151' }, 'background');
  const inputBackground = useThemeColor({ light: '#F8FAFC', dark: '#1F2937' }, 'background');
  const inputBorderColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(15, 23, 42, 0.12)';
  const placeholderColor = isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(15, 23, 42, 0.45)';
  const textColor = useThemeColor({}, 'text');
  const mutedText = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226, 232, 240, 0.7)' },
    'text',
  );
  const allianceBackground =
    isDark ? (alliance === 'red' ? '#7F1D1D' : '#1E3A8A') : alliance === 'red' ? '#DC2626' : '#1D4ED8';
  const allianceText = '#F8FAFC';

  const matchLabel = useMemo(() => {
    const levelLabel = getMatchLevelLabel(matchLevel);
    if (!matchNumber) return levelLabel;
    return `${levelLabel} ${matchNumber}`;
  }, [matchLevel, matchNumber]);

  const allianceLabel = ALLIANCE_DETAILS[alliance].label;

  const isStartingPositionsComplete = Object.values(teamInputs).every(
    (t) => t.startingPosition !== null,
  );

  const isRatingsComplete = Object.values(teamInputs).every((t) => {
    const hasDriver = t.driverRating > 0;
    const hasOverall = t.robotOverall > 0;
    const requiresDefenseRating = t.cannedComments.some((key) => defenseRequiredKeys.has(key));
    const hasDefense = requiresDefenseRating ? t.defenseRating > 0 : true;
    return hasDriver && hasOverall && hasDefense;
  });

  const handleToggleComment = (teamKey: string, field: SuperScoutFieldDefinition) => {
    setTeamInputs((current) => {
      const existing = current[teamKey] ?? createDefaultTeamState();
      const hasField = existing.cannedComments.includes(field.key);
      const nextComments = hasField
        ? existing.cannedComments.filter((key) => key !== field.key)
        : [...existing.cannedComments, field.key];

      const hasDefenseComment = nextComments.some((key) => defenseRequiredKeys.has(key));

      const nextState: TeamInputState = {
        ...existing,
        cannedComments: nextComments,
        defenseRating: hasDefenseComment ? existing.defenseRating : 0,
      };

      return { ...current, [teamKey]: nextState };
    });
  };

  const handleSelectStartingPosition = (teamKey: string, value: StartingPosition) => {
    setTeamInputs((current) => {
      const existing = current[teamKey] ?? createDefaultTeamState();
      return {
        ...current,
        [teamKey]: {
          ...existing,
          startingPosition: existing.startingPosition === value ? null : value,
        },
      };
    });
  };

  const handleRatingChange = (
    teamKey: string,
    type: 'driverRating' | 'robotOverall' | 'defenseRating',
    value: number,
  ) => {
    setTeamInputs((current) => {
      const existing = current[teamKey] ?? createDefaultTeamState();
      return {
        ...current,
        [teamKey]: { ...existing, [type]: existing[type] === value ? 0 : value },
      };
    });
  };

  const handleNotesChange = (teamKey: string, value: string) => {
    setTeamInputs((current) => {
      const existing = current[teamKey] ?? createDefaultTeamState();
      return { ...current, [teamKey]: { ...existing, notes: value } };
    });
  };

  const isDefenseCommentSelected = (teamKey: string) =>
    (teamInputs[teamKey]?.cannedComments ?? []).some((key) => defenseRequiredKeys.has(key));

  const renderStarRating = (
    teamKey: string,
    type: 'driverRating' | 'robotOverall' | 'defenseRating',
    value: number,
  ) => (
    <View style={styles.ratingRow}>
      {Array.from({ length: 5 }, (_, index) => {
        const ratingValue = index + 1;
        const isActive = ratingValue <= value;

        return (
          <Pressable
            key={ratingValue}
            onPress={() => handleRatingChange(teamKey, type, ratingValue)}
            style={({ pressed }) => [styles.starButton, pressed ? styles.starButtonPressed : null]}
          >
            <Ionicons
              name={isActive ? 'star' : 'star-outline'}
              size={22}
              color={isActive ? '#FACC15' : isDark ? '#9CA3AF' : '#94A3B8'}
            />
          </Pressable>
        );
      })}
    </View>
  );

  const handleConfirmSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const resolvedMatchLevel = typeof matchLevel === 'string' && matchLevel.trim().length > 0 ? matchLevel : null;
    const resolvedMatchNumber =
      typeof matchNumber === 'number' && Number.isFinite(matchNumber) ? matchNumber : null;

    if (!resolvedMatchLevel || resolvedMatchNumber === null) {
      Alert.alert(
        'Unable to submit',
        'Match information is incomplete. Please return to the match schedule and try again.',
      );
      return;
    }

    const resolvedEventKey = (eventKey ?? getActiveEvent()) ?? null;

    if (!resolvedEventKey) {
      Alert.alert(
        'Unable to submit',
        'No active event is currently selected. Please sync or select an event before submitting.',
      );
      return;
    }

    const entries = teams
      .map((teamNumber, index) => {
        if (typeof teamNumber !== 'number' || !Number.isFinite(teamNumber)) {
          return null;
        }

        const teamKey = String(teamNumber ?? `slot-${index}`);
        const state = teamInputs[teamKey] ?? createDefaultTeamState();

        return { teamNumber, state };
      })
      .filter((entry): entry is { teamNumber: number; state: TeamInputState } => entry !== null);

    if (entries.length === 0) {
      Alert.alert('Unable to submit', 'No valid teams are available for this match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDbOrThrow();

      db.transaction((tx) => {
        for (const entry of entries) {
          const { teamNumber, state } = entry;
          const trimmedNotes = state.notes.trim();
          const notesValue = trimmedNotes.length > 0 ? state.notes : null;
          const defenseValue = state.defenseRating > 0 ? state.defenseRating : null;

          tx
            .insert(schema.superScoutData)
            .values({
              eventKey: resolvedEventKey,
              teamNumber,
              matchNumber: resolvedMatchNumber,
              matchLevel: resolvedMatchLevel,
              alliance,
              startPosition: state.startingPosition,
              notes: notesValue,
              driverRating: state.driverRating,
              robotOverall: state.robotOverall,
              defenseRating: defenseValue,
              submissionPending: 1,
            })
            .onConflictDoUpdate({
              target: [
                schema.superScoutData.eventKey,
                schema.superScoutData.teamNumber,
                schema.superScoutData.matchNumber,
                schema.superScoutData.matchLevel,
              ],
              set: {
                alliance,
                startPosition: state.startingPosition,
                notes: notesValue,
                driverRating: state.driverRating,
                robotOverall: state.robotOverall,
                defenseRating: defenseValue,
                submissionPending: 1,
              },
            })
            .run();

          tx
            .delete(schema.superScoutSelections)
            .where(
              and(
                eq(schema.superScoutSelections.eventKey, resolvedEventKey),
                eq(schema.superScoutSelections.teamNumber, teamNumber),
                eq(schema.superScoutSelections.matchNumber, resolvedMatchNumber),
                eq(schema.superScoutSelections.matchLevel, resolvedMatchLevel),
              ),
            )
            .run();

          if (state.cannedComments.length > 0) {
            const selectionRecords = state.cannedComments.map((fieldKey) => ({
              eventKey: resolvedEventKey,
              teamNumber,
              matchNumber: resolvedMatchNumber,
              matchLevel: resolvedMatchLevel,
              fieldKey,
            }));

            tx.insert(schema.superScoutSelections).values(selectionRecords).onConflictDoNothing().run();
          }
        }
      });

      const successfulTeams: number[] = [];
      let hadFailure = false;

      for (const entry of entries) {
        const { teamNumber, state } = entry;
        const payload: Record<string, unknown> = {
          team_number: teamNumber,
          match_number: resolvedMatchNumber,
          match_level: resolvedMatchLevel,
          notes: state.notes,
          driver_rating: state.driverRating,
          robot_overall: state.robotOverall,
        };

        const startPositionValue =
          state.startingPosition && state.startingPosition !== 'NO_SHOW'
            ? state.startingPosition
            : undefined;

        if (startPositionValue) {
          payload.startPosition = startPositionValue;
        }

        if (state.defenseRating > 0) {
          payload.defense_rating = state.defenseRating;
        }

        availableFieldKeys.forEach((fieldKey) => {
          payload[fieldKey] = state.cannedComments.includes(fieldKey);
        });

        try {
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 5000);

          try {
            await apiRequest('/scout/superscout', {
              method: 'POST',
              body: JSON.stringify(payload),
              signal: abortController.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          successfulTeams.push(teamNumber);
        } catch (error) {
          hadFailure = true;
          console.error('Failed to submit super scout data', error);
        }
      }

      if (successfulTeams.length > 0) {
        db
          .update(schema.superScoutData)
          .set({ submissionPending: 0 })
          .where(
            and(
              eq(schema.superScoutData.eventKey, resolvedEventKey),
              eq(schema.superScoutData.matchNumber, resolvedMatchNumber),
              eq(schema.superScoutData.matchLevel, resolvedMatchLevel),
              inArray(schema.superScoutData.teamNumber, successfulTeams),
            ),
          )
          .run();
      }

      let nextMatchParams: Record<string, string> | null = null;

      try {
        const scheduleRows = db
          .select()
          .from(schema.matchSchedules)
          .where(eq(schema.matchSchedules.eventKey, resolvedEventKey))
          .all();

        nextMatchParams = findNextMatchParams(scheduleRows, {
          matchLevel: resolvedMatchLevel,
          matchNumber: resolvedMatchNumber,
          alliance,
        });
      } catch (scheduleError) {
        console.error('Failed to determine next SuperScout match', scheduleError);
      }

      const navigateToNext = () => {
        if (nextMatchParams) {
          router.replace({ pathname: '/(drawer)/super-scout/match', params: nextMatchParams });
        } else {
          router.replace('/(drawer)/super-scout');
        }
      };

      const buttonLabel = nextMatchParams ? 'Next Match' : 'Match Schedule';
      const totalEntries = entries.length;

      if (!hadFailure && successfulTeams.length === totalEntries) {
        Alert.alert(
          'SuperScout submitted',
          'SuperScout data was saved and sent successfully.',
          [{ text: buttonLabel, onPress: navigateToNext }],
          { cancelable: false },
        );
      } else if (successfulTeams.length === 0) {
        Alert.alert(
          'SuperScout saved locally',
          'The SuperScout data was saved on this device but could not be sent to the server.',
          [{ text: buttonLabel, onPress: navigateToNext }],
          { cancelable: false },
        );
      } else {
        Alert.alert(
          'SuperScout partially submitted',
          'Some SuperScout data was sent successfully, but at least one submission failed and was saved locally.',
          [{ text: buttonLabel, onPress: navigateToNext }],
          { cancelable: false },
        );
      }
    } catch (error) {
      console.error('Failed to save super scout data', error);
      Alert.alert(
        'Submission failed',
        'An unexpected error occurred while saving SuperScout data. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    alliance,
    availableFieldKeys,
    eventKey,
    isSubmitting,
    matchLevel,
    matchNumber,
    router,
    teamInputs,
    teams,
  ]);

  const handleSubmit = useCallback(() => {
    if (!isRatingsComplete || isSubmitting) {
      return;
    }

    Alert.alert('Submit SuperScout data', 'Submit comments for this match?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          void handleConfirmSubmit();
        },
      },
    ]);
  }, [handleConfirmSubmit, isRatingsComplete, isSubmitting]);

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={textColor} />
          <ThemedText style={[styles.backButtonLabel, { color: textColor }]}>Back</ThemedText>
        </Pressable>

        <View style={styles.matchDescriptor}>
          <View style={[styles.matchBadge, { backgroundColor: allianceBackground }]}> 
            <ThemedText type="title" style={[styles.matchSubtitle, { color: allianceText }]}> 
              {matchLabel}: {allianceLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.navButtonContainer}>
          {activeView !== 'starting' && (
            <Pressable
              style={[styles.navButton, { backgroundColor: chipBackground }]}
              onPress={() => {
                if (activeView === 'comments') setActiveView('starting');
                else if (activeView === 'ratings') setActiveView('comments');
              }}
            >
              <ThemedText style={[styles.navButtonText, { color: textColor }]}>
                Back to: {activeView === 'comments' ? 'Starting' : 'Comments'}
              </ThemedText>
            </Pressable>
          )}

          {activeView !== 'ratings' ? (
            <Pressable
              style={[
                styles.navButton,
                {
                  backgroundColor:
                    (activeView === 'starting' && !isStartingPositionsComplete)
                      ? chipBackground
                      : allianceBackground,
                  opacity:
                    (activeView === 'starting' && !isStartingPositionsComplete) ? 0.5 : 1,
                },
              ]}
              disabled={activeView === 'starting' && !isStartingPositionsComplete}
              onPress={() => {
                if (activeView === 'starting') setActiveView('comments');
                else if (activeView === 'comments') setActiveView('ratings');
              }}
            >
              <ThemedText style={[styles.navButtonText, { color: allianceText }]}>
                {activeView === 'starting' ? 'Next: Comments' : 'Next: Ratings'}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.navButton,
                {
                  backgroundColor:
                    isRatingsComplete && !isSubmitting ? allianceBackground : chipBackground,
                  opacity: isRatingsComplete && !isSubmitting ? 1 : 0.5,
                },
              ]}
              disabled={!isRatingsComplete || isSubmitting}
              onPress={handleSubmit}
            >
              <ThemedText style={[styles.navButtonText, { color: allianceText }]}>
                {isSubmitting ? 'Submitting…' : 'Submit Comments'}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={100}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.teamCardsRow}>
          {teams.map((teamNumber, index) => {
            const teamKey = String(teamNumber ?? `slot-${index}`);
            const state = teamInputs[teamKey] ?? createDefaultTeamState();
            const defenseActive = isDefenseCommentSelected(teamKey);

            return (
              <View
                key={teamKey}
                style={[styles.teamCard, { backgroundColor: cardBackground, borderColor }]}
              >
                <ThemedText type="subtitle" style={styles.teamTitle}>
                  Team {renderTeamNumber(teamNumber)}
                </ThemedText>

                {activeView === 'starting' && (
                  <View style={styles.section}>
                    <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                      Starting Position
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {STARTING_POSITIONS.map((option) => {
                        const isSelected = state.startingPosition === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => handleSelectStartingPosition(teamKey, option.key)}
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: isSelected ? allianceBackground : chipBackground,
                                borderColor,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.chipLabel,
                                { color: isSelected ? allianceText : textColor },
                              ]}
                            >
                              {option.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {activeView === 'comments' && (
                  <View style={styles.section}>
                    <View style={styles.chipRow}>
                      {availableFields.map((field) => {
                        const isSelected = state.cannedComments.includes(field.key);
                        return (
                          <Pressable
                            key={field.key}
                            onPress={() => handleToggleComment(teamKey, field)}
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: isSelected ? allianceBackground : chipBackground,
                                borderColor,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.chipLabel,
                                { color: isSelected ? allianceText : textColor },
                              ]}
                            >
                              {field.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {activeView === 'ratings' && (
                  <View style={styles.section}>
                    <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                      Performance Ratings
                    </ThemedText>
                    <View style={styles.ratingColumns}>
                      <View style={styles.ratingColumn}>
                        <ThemedText style={[styles.ratingLabel, { color: mutedText }]}>
                          Driver
                        </ThemedText>
                        {renderStarRating(teamKey, 'driverRating', state.driverRating)}
                      </View>

                      {defenseActive && (
                        <View style={styles.ratingColumn}>
                          <ThemedText style={[styles.ratingLabel, { color: mutedText }]}>
                            Defense
                          </ThemedText>
                          {renderStarRating(teamKey, 'defenseRating', state.defenseRating)}
                        </View>
                      )}

                      <View style={styles.ratingColumn}>
                        <ThemedText style={[styles.ratingLabel, { color: mutedText }]}>
                          Overall
                        </ThemedText>
                        {renderStarRating(teamKey, 'robotOverall', state.robotOverall)}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Notes
                  </ThemedText>
                  <TextInput
                    multiline
                    placeholder="Enter any additional observations"
                    placeholderTextColor={placeholderColor}
                    value={state.notes}
                    onChangeText={(value) => handleNotesChange(teamKey, value)}
                    style={[
                      styles.notesInput,
                      {
                        backgroundColor: inputBackground,
                        borderColor: inputBorderColor,
                        color: textColor,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </KeyboardAwareScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  matchDescriptor: {
    flex: 1,
    alignItems: 'center',
  },
  matchBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  matchSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  teamCardsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
    flex: 1,
  },
  teamCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    flex: 1,
  },
  teamTitle: {
    textAlign: 'center',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingColumns: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  ratingColumn: {
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  starButtonPressed: {
    opacity: 0.8,
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  navButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
