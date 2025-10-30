import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseNumberParam = (value: string | string[] | undefined) => {
  const raw = toSingleValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const getMatchLevelLabel = (matchLevel: string | undefined) => {
  const normalized = matchLevel?.toLowerCase();

  switch (normalized) {
    case 'qm':
      return 'Quals';
    case 'sf':
      return 'Playoff';
    case 'qf':
      return 'Quarters';
    case 'f':
      return 'Finals';
    default:
      return matchLevel?.toUpperCase() ?? '';
  }
};

const renderTeamNumber = (value?: number) => (value === undefined ? 'TBD' : value);

type AllianceColor = 'red' | 'blue';

type AllianceOption = {
  key: AllianceColor;
  label: string;
  teams: (number | undefined)[];
};

export interface SuperScoutAllianceSelectScreenProps {
  matchLevel?: string;
  matchNumber?: number;
  eventKey?: string;
  red1?: number;
  red2?: number;
  red3?: number;
  blue1?: number;
  blue2?: number;
  blue3?: number;
  onCancel: () => void;
}

export function SuperScoutAllianceSelectScreen({
  matchLevel,
  matchNumber,
  eventKey,
  red1,
  red2,
  red3,
  blue1,
  blue2,
  blue3,
  onCancel,
}: SuperScoutAllianceSelectScreenProps) {
  const [selectedAlliance, setSelectedAlliance] = useState<AllianceColor>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const cardBackground = useThemeColor({ light: '#F8FAFC', dark: '#1F2937' }, 'background');
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(30, 41, 59, 0.2)';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.9)' : '#B91C1C';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.85)' : '#1D4ED8';
  const neutralButtonBackground = useThemeColor({ light: '#E2E8F0', dark: '#27272A' }, 'background');
  const neutralButtonText = useThemeColor({}, 'text');
  const headerText = useThemeColor({}, 'text');
  const redButtonBackground = isDark ? '#7F1D1D' : '#DC2626';
  const blueButtonBackground = isDark ? '#1E3A8A' : '#1D4ED8';
  const primaryButtonText = '#F8FAFC';

  const matchLabel = useMemo(() => {
    const levelLabel = getMatchLevelLabel(matchLevel);
    if (!levelLabel) {
      return matchNumber ? `Match ${matchNumber}` : 'Match Details';
    }

    if (!matchNumber) {
      return levelLabel;
    }

    return `${levelLabel} ${matchNumber}`;
  }, [matchLevel, matchNumber]);

  const allianceOptions: AllianceOption[] = useMemo(
    () => [
      { key: 'red', label: 'Red Alliance', teams: [red1, red2, red3] },
      { key: 'blue', label: 'Blue Alliance', teams: [blue1, blue2, blue3] },
    ],
    [blue1, blue2, blue3, red1, red2, red3]
  );

  const selectedOption = useMemo(
    () => allianceOptions.find((option) => option.key === selectedAlliance),
    [allianceOptions, selectedAlliance]
  );

  const renderAllianceTeams = (teams: (number | undefined)[]) =>
    teams.map((team, index) => (
      <ThemedText key={index} type="default" style={styles.teamNumber}>
        {renderTeamNumber(team)}
      </ThemedText>
    ));

  const handleBeginSuperScout = useCallback(() => {
    if (!selectedOption) {
      return;
    }

    const params: Record<string, string> = {
      alliance: selectedOption.key,
    };

    if (matchLevel) {
      params.matchLevel = matchLevel;
    }

    if (matchNumber !== undefined) {
      params.matchNumber = String(matchNumber);
    }

    if (eventKey) {
      params.eventKey = eventKey;
    }

    const [team1, team2, team3] = selectedOption.teams;

    if (team1 !== undefined) {
      params.team1 = String(team1);
    }

    if (team2 !== undefined) {
      params.team2 = String(team2);
    }

    if (team3 !== undefined) {
      params.team3 = String(team3);
    }

    router.push({ pathname: '/(drawer)/super-scout/match', params });
  }, [eventKey, matchLevel, matchNumber, router, selectedOption]);

  const canBegin = Boolean(selectedOption);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title" style={[styles.headerText, { color: headerText }]}>Select an Alliance</ThemedText>
        <ThemedText style={[styles.subHeaderText, { color: headerText }]}>{matchLabel}</ThemedText>
      </View>
      <View style={styles.optionsWrapper}>
        {allianceOptions.map((option) => {
          const isSelected = selectedAlliance === option.key;
          const backgroundColor = option.key === 'red' ? redCellBackground : blueCellBackground;

          return (
            <Pressable
              key={option.key}
              onPress={() => setSelectedAlliance(option.key)}
              style={({ pressed }) => [
                styles.allianceOption,
                {
                  backgroundColor,
                  borderColor: isSelected ? '#FACC15' : borderColor,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.allianceLabel}>
                {option.label}
              </ThemedText>
              <View style={styles.teamList}>{renderAllianceTeams(option.teams)}</View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <View style={[styles.selectionPreview, { backgroundColor: cardBackground, borderColor }]}>
          <Pressable
            accessibilityRole="button"
            onPress={handleBeginSuperScout}
            disabled={!canBegin}
            style={({ pressed }) => {
              const backgroundColor = selectedAlliance
                ? selectedAlliance === 'red'
                  ? redButtonBackground
                  : blueButtonBackground
                : neutralButtonBackground;

              return [
                styles.beginButton,
                {
                  backgroundColor,
                  opacity: !canBegin ? 0.5 : pressed ? 0.85 : 1,
                },
              ];
            }}
          >
            <ThemedText
              style={[
                styles.beginButtonText,
                {
                  color: selectedAlliance ? primaryButtonText : neutralButtonText,
                },
              ]}
            >
              Begin SuperScout
            </ThemedText>
          </Pressable>
          {!selectedOption && (
            <ThemedText style={[styles.selectionText, { color: headerText }]}>Select an alliance to continue</ThemedText>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            {
              backgroundColor: neutralButtonBackground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <ThemedText style={[styles.cancelButtonText, { color: neutralButtonText }]}>Cancel</ThemedText>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

export function createSuperScoutAllianceSelectScreenPropsFromParams(params: {
  matchLevel?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  red1?: string | string[];
  red2?: string | string[];
  red3?: string | string[];
  blue1?: string | string[];
  blue2?: string | string[];
  blue3?: string | string[];
}) {
  return {
    matchLevel: toSingleValue(params.matchLevel),
    matchNumber: parseNumberParam(params.matchNumber),
    eventKey: toSingleValue(params.eventKey),
    red1: parseNumberParam(params.red1),
    red2: parseNumberParam(params.red2),
    red3: parseNumberParam(params.red3),
    blue1: parseNumberParam(params.blue1),
    blue2: parseNumberParam(params.blue2),
    blue3: parseNumberParam(params.blue3),
  } satisfies Omit<SuperScoutAllianceSelectScreenProps, 'onCancel'>;
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  headerText: {
    textAlign: 'center',
  },
  subHeaderText: {
    textAlign: 'center',
    opacity: 0.8,
  },
  optionsWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  allianceOption: {
    width: '80%',
    maxWidth: 480,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  allianceLabel: {
    color: '#F8FAFC',
    fontSize: 18,
    textAlign: 'center',
  },
  teamList: {
    gap: 4,
  },
  teamNumber: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    gap: 12,
  },
  selectionPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  selectionText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  beginButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  beginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
