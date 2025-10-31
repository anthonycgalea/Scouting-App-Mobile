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

type SummaryMetric = {
  key: string;
  label: string;
  value: string;
  variant?: 'red' | 'blue';
};

const ALLIANCE_METRIC_FIELDS: {
  key: string;
  label: string;
  selector: (team: AllianceTeam) => MetricStatistics | undefined;
}[] = [
  { key: 'auto', label: 'Auto Total', selector: (team) => team.auto.total_points },
  { key: 'teleop', label: 'Teleop Total', selector: (team) => team.teleop.total_points },
  { key: 'endgame', label: 'Endgame', selector: (team) => team.endgame },
  { key: 'total', label: 'Total Score', selector: (team) => team.total_points },
];

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

  const buildAllianceSummary = useCallback((teams: AllianceTeam[], variant: 'red' | 'blue') => {
    return ALLIANCE_METRIC_FIELDS.map<SummaryMetric>((field) => ({
      key: field.key,
      label: field.label,
      value: formatNumber(sumTeamAverages(teams, field.selector)) ?? '—',
      variant,
    }));
  }, []);

  const redAllianceSummary = useMemo(
    () => buildAllianceSummary(redTeams, 'red'),
    [buildAllianceSummary, redTeams],
  );
  const blueAllianceSummary = useMemo(
    () => buildAllianceSummary(blueTeams, 'blue'),
    [blueTeams, buildAllianceSummary],
  );

  const redTotalAverage = useMemo(
    () => sumTeamAverages(redTeams, (team) => team.total_points),
    [redTeams],
  );
  const blueTotalAverage = useMemo(
    () => sumTeamAverages(blueTeams, (team) => team.total_points),
    [blueTeams],
  );

  const overallSimulationSummary = useMemo<SummaryMetric[]>(() => {
    const formattedRedTotal = formatNumber(redTotalAverage);
    const formattedBlueTotal = formatNumber(blueTotalAverage);
    const hasBothTotals =
      formattedRedTotal !== undefined && formattedBlueTotal !== undefined;

    const margin =
      redTotalAverage !== undefined && blueTotalAverage !== undefined
        ? redTotalAverage - blueTotalAverage
        : undefined;

    const marginVariant: SummaryMetric['variant'] =
      margin === undefined || margin === 0 ? undefined : margin > 0 ? 'red' : 'blue';

    const projectedWinner = (() => {
      if (margin === undefined) {
        return '—';
      }

      if (margin > 0) {
        return 'Red Alliance';
      }

      if (margin < 0) {
        return 'Blue Alliance';
      }

      return 'Dead heat';
    })();

    let marginLabel: string | undefined;
    if (margin !== undefined) {
      if (margin === 0) {
        marginLabel = 'Even';
      } else {
        const formattedMargin = formatNumber(Math.abs(margin));
        if (formattedMargin) {
          marginLabel = `${margin > 0 ? 'Red' : 'Blue'} +${formattedMargin}`;
        }
      }
    }

    const combinedTotal =
      redTotalAverage !== undefined && blueTotalAverage !== undefined
        ? redTotalAverage + blueTotalAverage
        : undefined;

    const projectedScore = hasBothTotals
      ? `Red ${formattedRedTotal} – Blue ${formattedBlueTotal}`
      : '—';

    const combinedLabel = formatNumber(combinedTotal) ?? '—';

    return [
      { key: 'winner', label: 'Projected Winner', value: projectedWinner, variant: marginVariant },
      { key: 'score', label: 'Projected Score', value: projectedScore },
      { key: 'margin', label: 'Score Margin', value: marginLabel ?? '—', variant: marginVariant },
      { key: 'combined', label: 'Combined Score', value: combinedLabel },
    ];
  }, [blueTotalAverage, redTotalAverage]);

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
          <View style={styles.summaryColumns}>
            <View style={[styles.summaryColumnCard, { backgroundColor: cardBackground, borderColor }]}
            >
              <ThemedText type="defaultSemiBold" style={[styles.columnTitle, styles.redText]}>
                Red Alliance
              </ThemedText>
              <View style={styles.columnMetrics}>
                {redAllianceSummary.map((metric) => (
                  <View key={metric.key} style={styles.columnMetricRow}>
                    <ThemedText style={[styles.columnMetricLabel, { color: mutedText }]}>
                      {metric.label}
                    </ThemedText>
                    <ThemedText style={[styles.columnMetricValue, styles.redText]}>
                      {metric.value}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.summaryColumnCard, { backgroundColor: cardBackground, borderColor }]}
            >
              <ThemedText type="defaultSemiBold" style={styles.columnTitle}>
                Overall Simulation
              </ThemedText>
              <View style={styles.columnMetrics}>
                {overallSimulationSummary.map((metric) => (
                  <View key={metric.key} style={styles.columnMetricRow}>
                    <ThemedText style={[styles.columnMetricLabel, { color: mutedText }]}>
                      {metric.label}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.columnMetricValue,
                        metric.variant === 'red'
                          ? styles.redText
                          : metric.variant === 'blue'
                          ? styles.blueText
                          : null,
                      ]}
                    >
                      {metric.value}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.summaryColumnCard, { backgroundColor: cardBackground, borderColor }]}
            >
              <ThemedText type="defaultSemiBold" style={[styles.columnTitle, styles.blueText]}>
                Blue Alliance
              </ThemedText>
              <View style={styles.columnMetrics}>
                {blueAllianceSummary.map((metric) => (
                  <View key={metric.key} style={styles.columnMetricRow}>
                    <ThemedText style={[styles.columnMetricLabel, { color: mutedText }]}>
                      {metric.label}
                    </ThemedText>
                    <ThemedText style={[styles.columnMetricValue, styles.blueText]}>
                      {metric.value}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
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
  summaryColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  summaryColumnCard: {
    flex: 1,
    minWidth: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  columnTitle: {
    fontSize: 18,
  },
  columnMetrics: {
    gap: 12,
  },
  columnMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  columnMetricLabel: {
    flex: 1,
    fontSize: 14,
  },
  columnMetricValue: {
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
