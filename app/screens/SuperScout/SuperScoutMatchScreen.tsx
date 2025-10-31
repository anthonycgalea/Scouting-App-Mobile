import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_SUPER_SCOUT_FIELDS, SuperScoutFieldDefinition } from '@/constants/superScout';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

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

const VIEW_DEFINITIONS: { key: ViewKey; label: string }[] = [
  { key: 'starting', label: 'Starting Position' },
  { key: 'comments', label: 'Canned Comments' },
  { key: 'ratings', label: 'Performance Ratings' },
];

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

export function createSuperScoutMatchScreenPropsFromParams(params: {
  matchLevel?: string | string[];
  matchNumber?: string | string[];
  alliance?: string | string[];
  team1?: string | string[];
  team2?: string | string[];
  team3?: string | string[];
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
  alliance: AllianceColor;
  teams: (number | undefined)[];
  onClose: () => void;
}

export function SuperScoutMatchScreen({
  matchLevel,
  matchNumber,
  alliance,
  teams,
  onClose,
}: SuperScoutMatchScreenProps) {
  const [teamInputs, setTeamInputs] = useState<Record<string, TeamInputState>>(() => {
    const initial: Record<string, TeamInputState> = {};
    teams.forEach((teamNumber, index) => {
      const teamKey = String(teamNumber ?? `slot-${index}`);
      initial[teamKey] = createDefaultTeamState();
    });
    return initial;
  });

  const [activeView, setActiveView] = useState<ViewKey>('starting');

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
    const hasDefense = t.cannedComments.includes('played_defense')
      ? t.defenseRating > 0
      : true;
    return hasDriver && hasOverall && hasDefense;
  });

  const handleToggleComment = (teamKey: string, field: SuperScoutFieldDefinition) => {
    setTeamInputs((current) => {
      const existing = current[teamKey] ?? createDefaultTeamState();
      const hasField = existing.cannedComments.includes(field.key);
      const nextComments = hasField
        ? existing.cannedComments.filter((key) => key !== field.key)
        : [...existing.cannedComments, field.key];

      const nextState: TeamInputState = {
        ...existing,
        cannedComments: nextComments,
      };

      if (!nextComments.includes('played_defense')) {
        nextState.defenseRating = 0;
      }

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
    (teamInputs[teamKey]?.cannedComments ?? []).includes('played_defense');

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

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={textColor} />
          <ThemedText style={[styles.backButtonLabel, { color: textColor }]}>Back</ThemedText>
        </Pressable>

        <View style={styles.matchDescriptor}>
          <ThemedText type="title" style={[styles.matchSubtitle, { color: textColor }]}>
            {matchLabel}: {allianceLabel}
          </ThemedText>
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
                  backgroundColor: isRatingsComplete ? allianceBackground : chipBackground,
                  opacity: isRatingsComplete ? 1 : 0.5,
                },
              ]}
              disabled={!isRatingsComplete}
              onPress={() => {
                // TODO: handle submit action here
              }}
            >
              <ThemedText style={[styles.navButtonText, { color: allianceText }]}>
                Submit Comments
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
                    <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                      Canned Comments
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {DEFAULT_SUPER_SCOUT_FIELDS.map((field) => {
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
    paddingHorizontal: 12,
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
