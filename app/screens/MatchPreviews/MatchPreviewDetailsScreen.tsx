import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  fetchMatchPreview,
  type MatchPreviewResponse,
  type MetricStatistics,
} from '@/app/services/api/match-previews';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface MatchPreviewDetailsScreenProps {
  matchLevel?: string;
  matchNumber?: number;
  eventKey?: string;
  red1?: number;
  red2?: number;
  red3?: number;
  blue1?: number;
  blue2?: number;
  blue3?: number;
  onClose: () => void;
}

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

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined;
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

const formatStatWithDeviation = (stat?: MetricStatistics) => {
  const average = formatNumber(stat?.average);

  if (!average) {
    return '—';
  }

  const deviation = formatNumber(stat?.standard_deviation);

  if (deviation && deviation !== '0.0') {
    return `${average} ±${deviation}`;
  }

  return average;
};

type AllianceTeam = MatchPreviewResponse['red']['teams'][number];

const sumTeamAverages = (
  teams: AllianceTeam[],
  selector: (team: AllianceTeam) => MetricStatistics | undefined,
) => {
  let total = 0;
  let hasValue = false;

  teams.forEach((team) => {
    const stat = selector(team);
    const average = stat?.average;

    if (average !== null && average !== undefined && Number.isFinite(average)) {
      total += average;
      hasValue = true;
    }
  });

  return hasValue ? total : undefined;
};

const renderAllianceTeamNumbers = (fallback: (number | undefined)[], previewTeams: AllianceTeam[]) => {
  if (previewTeams.length > 0) {
    return previewTeams.map((team) => team.team_number).filter((team) => team !== undefined);
  }

  return fallback.filter((team) => team !== undefined);
};

export function MatchPreviewDetailsScreen({
  matchLevel,
  matchNumber,
  eventKey,
  red1,
  red2,
  red3,
  blue1,
  blue2,
  blue3,
  onClose,
}: MatchPreviewDetailsScreenProps) {
  const [preview, setPreview] = useState<MatchPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.1)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const mutedText = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226, 232, 240, 0.7)' },
    'text',
  );
  const textColor = useThemeColor({}, 'text');
  const closeButtonBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');

  const numericMatchNumber = Number.isFinite(matchNumber ?? NaN) ? matchNumber : undefined;
  const hasValidParams = Boolean(matchLevel) && numericMatchNumber !== undefined;

  const loadPreview = useCallback(async () => {
    if (!matchLevel || numericMatchNumber === undefined) {
      throw new Error('Match information is missing or invalid.');
    }

    return fetchMatchPreview({
      matchLevel,
      matchNumber: numericMatchNumber,
      eventKey,
    });
  }, [eventKey, matchLevel, numericMatchNumber]);

  const handlePreviewError = useCallback((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load match preview information. Confirm you are connected to the internet and try again.';

    setErrorMessage(message);
    setPreview(null);
  }, []);

  useEffect(() => {
    if (!hasValidParams) {
      setIsLoading(false);
      setErrorMessage('Match information is missing or invalid.');
      setPreview(null);
      return;
    }

    let isActive = true;
    setIsLoading(true);

    loadPreview()
      .then((response) => {
        if (!isActive) {
          return;
        }

        setPreview(response);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        handlePreviewError(error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [handlePreviewError, hasValidParams, loadPreview]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing || !hasValidParams) {
      return;
    }

    setIsRefreshing(true);

    loadPreview()
      .then((response) => {
        setPreview(response);
        setErrorMessage(null);
      })
      .catch((error) => {
        handlePreviewError(error);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [handlePreviewError, hasValidParams, isRefreshing, loadPreview]);

  const matchLabel = useMemo(() => {
    const levelLabel = getMatchLevelLabel(matchLevel);
    if (!numericMatchNumber) {
      return levelLabel;
    }

    return `${levelLabel} Match ${numericMatchNumber}`;
  }, [matchLevel, numericMatchNumber]);

  const redTeams = useMemo(
    () => (preview?.red.teams ?? []) as AllianceTeam[],
    [preview],
  );
  const blueTeams = useMemo(
    () => (preview?.blue.teams ?? []) as AllianceTeam[],
    [preview],
  );

  const redTeamNumbers = useMemo(
    () => renderAllianceTeamNumbers([red1, red2, red3], redTeams),
    [red1, red2, red3, redTeams],
  );
  const blueTeamNumbers = useMemo(
    () => renderAllianceTeamNumbers([blue1, blue2, blue3], blueTeams),
    [blue1, blue2, blue3, blueTeams],
  );

  const allianceSummaries = useMemo(() => {
    if (!preview) {
      return null;
    }

    const fields: {
      key: string;
      label: string;
      selector: (team: AllianceTeam) => MetricStatistics | undefined;
    }[] = [
      { key: 'auto', label: 'Auto Total', selector: (team) => team.auto.total_points },
      { key: 'teleop', label: 'Teleop Total', selector: (team) => team.teleop.total_points },
      { key: 'endgame', label: 'Endgame', selector: (team) => team.endgame },
      { key: 'total', label: 'Total Score', selector: (team) => team.total_points },
    ];

    return fields.map((field) => ({
      key: field.key,
      label: field.label,
      red: formatNumber(sumTeamAverages(redTeams, field.selector)),
      blue: formatNumber(sumTeamAverages(blueTeams, field.selector)),
    }));
  }, [blueTeams, preview, redTeams]);

  const renderTeamCard = useCallback(
    (team: AllianceTeam, alliance: 'red' | 'blue') => {
      const cardBorder = alliance === 'red' ? '#DC2626' : '#2563EB';

      return (
        <View key={team.team_number} style={[styles.teamCard, { borderColor: cardBorder }]}>
          <ThemedText type="defaultSemiBold" style={styles.teamCardTitle}>
            Team {team.team_number}
          </ThemedText>
          <View style={styles.teamMetricsRow}>
            <View style={styles.teamMetric}>
              <ThemedText style={styles.metricLabel}>Auto</ThemedText>
              <ThemedText style={styles.metricValue}>{formatStatWithDeviation(team.auto.total_points)}</ThemedText>
            </View>
            <View style={styles.teamMetric}>
              <ThemedText style={styles.metricLabel}>Teleop</ThemedText>
              <ThemedText style={styles.metricValue}>{formatStatWithDeviation(team.teleop.total_points)}</ThemedText>
            </View>
            <View style={styles.teamMetric}>
              <ThemedText style={styles.metricLabel}>Endgame</ThemedText>
              <ThemedText style={styles.metricValue}>{formatStatWithDeviation(team.endgame)}</ThemedText>
            </View>
            <View style={styles.teamMetric}>
              <ThemedText style={styles.metricLabel}>Total</ThemedText>
              <ThemedText style={styles.metricValue}>{formatStatWithDeviation(team.total_points)}</ThemedText>
            </View>
          </View>
        </View>
      );
    },
    [],
  );

  return (
    <ScreenContainer>
      <View style={styles.detailsHeader}>
        <View style={styles.headerTextContainer}>
          <ThemedText type="title">{matchLabel}</ThemedText>
          {eventKey ? (
            <ThemedText style={[styles.eventKeyLabel, { color: mutedText }]}>Event: {eventKey}</ThemedText>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: closeButtonBackground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <ThemedText style={styles.closeButtonText}>Close</ThemedText>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleRefresh}
        style={({ pressed }) => [
          styles.refreshButton,
          {
            backgroundColor: accentColor,
            opacity: pressed || isRefreshing ? 0.9 : 1,
          },
        ]}
      >
        {isRefreshing ? (
          <ActivityIndicator color="#F8FAFC" />
        ) : (
          <ThemedText style={styles.refreshButtonText}>Refresh preview</ThemedText>
        )}
      </Pressable>

      {isLoading ? (
        <View style={styles.stateWrapper}>
          <ActivityIndicator accessibilityLabel="Loading match preview" color={accentColor} />
          <ThemedText style={[styles.stateMessage, { color: mutedText }]}>Loading match preview…</ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={[styles.stateCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText type="defaultSemiBold" style={[styles.stateTitle, { color: textColor }]}>
            Unable to load match preview
          </ThemedText>
          <ThemedText style={[styles.stateMessage, { color: mutedText }]}>{errorMessage}</ThemedText>
        </View>
      ) : preview ? (
        <ScrollView contentContainerStyle={styles.previewContent}>
          <View style={[styles.summaryCard, { backgroundColor: cardBackground, borderColor }]}
          >
            <ThemedText type="defaultSemiBold" style={styles.summaryTitle}>Alliance Summary</ThemedText>
            <View style={styles.summaryHeaderRow}>
              <ThemedText style={styles.summaryHeaderLabel}>Metric</ThemedText>
              <View style={styles.summaryValuesHeader}>
                <ThemedText style={[styles.summaryAllianceLabel, styles.redText]}>Red</ThemedText>
                <ThemedText style={[styles.summaryAllianceLabel, styles.blueText]}>Blue</ThemedText>
              </View>
            </View>
            {allianceSummaries?.map((field) => (
              <View key={field.key} style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>{field.label}</ThemedText>
                <View style={styles.summaryValues}>
                  <ThemedText style={[styles.summaryValue, styles.redText]}>
                    {field.red ?? '—'}
                  </ThemedText>
                  <ThemedText style={[styles.summaryValue, styles.blueText]}>
                    {field.blue ?? '—'}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.teamListSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Red Alliance
            </ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>Teams: {redTeamNumbers.length > 0 ? redTeamNumbers.join(', ') : 'TBD'}</ThemedText>
            <View style={styles.teamList}>{redTeams.map((team) => renderTeamCard(team, 'red'))}</View>
          </View>

          <View style={styles.teamListSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Blue Alliance
            </ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>Teams: {blueTeamNumbers.length > 0 ? blueTeamNumbers.join(', ') : 'TBD'}</ThemedText>
            <View style={styles.teamList}>{blueTeams.map((team) => renderTeamCard(team, 'blue'))}</View>
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.stateCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText type="defaultSemiBold" style={[styles.stateTitle, { color: textColor }]}>
            Match preview is not available for this match yet.
          </ThemedText>
        </View>
      )}
    </ScreenContainer>
  );
}

export const createMatchPreviewDetailsScreenPropsFromParams = (params: {
  matchLevel?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  red1?: string | string[];
  red2?: string | string[];
  red3?: string | string[];
  blue1?: string | string[];
  blue2?: string | string[];
  blue3?: string | string[];
}) => {
  const toSingleValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parseNumber = (value: string | string[] | undefined) => {
    const raw = toSingleValue(value);
    if (!raw) {
      return undefined;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    matchLevel: toSingleValue(params.matchLevel),
    matchNumber: parseNumber(params.matchNumber),
    eventKey: toSingleValue(params.eventKey),
    red1: parseNumber(params.red1),
    red2: parseNumber(params.red2),
    red3: parseNumber(params.red3),
    blue1: parseNumber(params.blue1),
    blue2: parseNumber(params.blue2),
    blue3: parseNumber(params.blue3),
  };
};

const styles = StyleSheet.create({
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
    gap: 4,
  },
  eventKeyLabel: {
    fontSize: 14,
  },
  closeButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButtonText: {
    fontWeight: '600',
  },
  refreshButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  stateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  stateMessage: {
    textAlign: 'center',
    fontSize: 16,
  },
  previewContent: {
    gap: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 18,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryHeaderLabel: {
    fontWeight: '600',
  },
  summaryValuesHeader: {
    flexDirection: 'row',
    gap: 24,
  },
  summaryAllianceLabel: {
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  summaryLabel: {
    flex: 1,
  },
  summaryValues: {
    flexDirection: 'row',
    gap: 24,
    minWidth: 160,
    justifyContent: 'flex-end',
  },
  summaryValue: {
    fontWeight: '600',
  },
  redText: {
    color: '#DC2626',
  },
  blueText: {
    color: '#2563EB',
  },
  teamListSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionSubtitle: {
    fontSize: 15,
  },
  teamList: {
    gap: 12,
  },
  teamCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  teamCardTitle: {
    fontSize: 16,
  },
  teamMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  teamMetric: {
    minWidth: 120,
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: 'rgba(15, 23, 42, 0.7)',
  },
  metricValue: {
    fontWeight: '600',
  },
});
