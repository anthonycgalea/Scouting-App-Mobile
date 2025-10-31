import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  fetchMatchPreview,
  fetchMatchSimulation,
  type MatchPreviewResponse,
  type MatchSimulation2025,
  type MatchSimulationResponse,
  type MetricStatistics,
  type PhaseMetrics,
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

const formatPercentage = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  const normalized = Math.max(0, Math.min(1, value));

  return `${(normalized * 100).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

type AllianceTeam = MatchPreviewResponse['red']['teams'][number];

type SummaryMetric = {
  key: string;
  label: string;
  value: string;
  variant?: 'red' | 'blue';
};

type PreviewViewKey = 'overview' | 'red' | 'blue';

const PREVIEW_VIEW_OPTIONS: { key: PreviewViewKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'red', label: 'Red Alliance' },
  { key: 'blue', label: 'Blue Alliance' },
];

const PHASE_METRIC_FIELDS = [
  { key: 'level4', label: 'Level 4' },
  { key: 'level3', label: 'Level 3' },
  { key: 'level2', label: 'Level 2' },
  { key: 'level1', label: 'Level 1' },
  { key: 'net', label: 'Net' },
  { key: 'processor', label: 'Processor' },
  { key: 'total_points', label: 'Total Points' },
] as const;

type PhaseMetricFieldKey = (typeof PHASE_METRIC_FIELDS)[number]['key'];

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

const isMatchSimulation2025 = (
  simulation: MatchSimulationResponse | null
): simulation is MatchSimulation2025 => simulation?.season === 1;

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
  const [simulation, setSimulation] = useState<MatchSimulationResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [hasLoadedSimulation, setHasLoadedSimulation] = useState(false);
  const [activeView, setActiveView] = useState<PreviewViewKey>('overview');

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

  const loadSimulation = useCallback(async () => {
    if (!matchLevel || numericMatchNumber === undefined) {
      throw new Error('Match information is missing or invalid.');
    }

    return fetchMatchSimulation({
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

  const handleSimulationError = useCallback((error: unknown) => {
    console.error('Unable to load match simulation', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load match simulation. Confirm you are connected to the internet and try again.';

    setSimulationError(message);
    setSimulation(null);
  }, []);

  useEffect(() => {
    if (!hasValidParams) {
      setIsLoading(false);
      setErrorMessage('Match information is missing or invalid.');
      setPreview(null);
      setSimulation(null);
      setSimulationError(null);
      setHasLoadedSimulation(true);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setHasLoadedSimulation(false);
    setSimulationError(null);

    Promise.all([
      loadPreview(),
      loadSimulation().catch((error) => {
        if (isActive) {
          handleSimulationError(error);
        }

        return null;
      }),
    ])
      .then(([previewResponse, simulationResponse]) => {
        if (!isActive) {
          return;
        }

        setPreview(previewResponse);
        setErrorMessage(null);
        setSimulation(simulationResponse);

        if (simulationResponse) {
          setSimulationError(null);
        }
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        handlePreviewError(error);
        setSimulation(null);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
          setHasLoadedSimulation(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    handlePreviewError,
    handleSimulationError,
    hasValidParams,
    loadPreview,
    loadSimulation,
  ]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing || !hasValidParams) {
      return;
    }

    setIsRefreshing(true);
    setSimulationError(null);
    setHasLoadedSimulation(false);

    Promise.all([
      loadPreview(),
      loadSimulation().catch((error) => {
        handleSimulationError(error);
        return null;
      }),
    ])
      .then(([previewResponse, simulationResponse]) => {
        setPreview(previewResponse);
        setErrorMessage(null);
        setSimulation(simulationResponse);

        if (simulationResponse) {
          setSimulationError(null);
        }
      })
      .catch((error) => {
        handlePreviewError(error);
        setSimulation(null);
      })
      .finally(() => {
        setHasLoadedSimulation(true);
        setIsRefreshing(false);
      });
  }, [
    handlePreviewError,
    handleSimulationError,
    hasValidParams,
    isRefreshing,
    loadPreview,
    loadSimulation,
  ]);

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

  const buildAlliancePhaseBreakdown = useCallback(
    (teams: AllianceTeam[], selector: (team: AllianceTeam) => PhaseMetrics) => {
      const breakdown = {} as Record<PhaseMetricFieldKey, string>;

      PHASE_METRIC_FIELDS.forEach((field) => {
        const total = sumTeamAverages(teams, (team) => selector(team)[field.key]);
        breakdown[field.key] = formatNumber(total) ?? '—';
      });

      return breakdown;
    },
    [],
  );

  const redAllianceSummary = useMemo(
    () => buildAllianceSummary(redTeams, 'red'),
    [buildAllianceSummary, redTeams],
  );
  const blueAllianceSummary = useMemo(
    () => buildAllianceSummary(blueTeams, 'blue'),
    [blueTeams, buildAllianceSummary],
  );

  const redAllianceAutoBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(redTeams, (team) => team.auto),
    [buildAlliancePhaseBreakdown, redTeams],
  );
  const redAllianceTeleopBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(redTeams, (team) => team.teleop),
    [buildAlliancePhaseBreakdown, redTeams],
  );
  const blueAllianceAutoBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(blueTeams, (team) => team.auto),
    [blueTeams, buildAlliancePhaseBreakdown],
  );
  const blueAllianceTeleopBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(blueTeams, (team) => team.teleop),
    [buildAlliancePhaseBreakdown, blueTeams],
  );

  const simulation2025 = useMemo(
    () => (isMatchSimulation2025(simulation) ? simulation : null),
    [simulation],
  );

  const simulationWinner = useMemo(() => {
    if (!simulation2025) {
      return null;
    }

    const redWinPct = simulation2025.red_alliance_win_pct;
    const blueWinPct = simulation2025.blue_alliance_win_pct;
    const safeRedWin = redWinPct ?? 0;
    const safeBlueWin = blueWinPct ?? 0;

    const isRedFavorite = safeRedWin > safeBlueWin;
    const isBlueFavorite = safeBlueWin > safeRedWin;

    const winnerLabel = isRedFavorite
      ? 'Red Alliance'
      : isBlueFavorite
        ? 'Blue Alliance'
        : 'Evenly Matched';

    const winnerPct = isRedFavorite
      ? redWinPct
      : isBlueFavorite
        ? blueWinPct
        : redWinPct;

    return { redWinPct, blueWinPct, isRedFavorite, isBlueFavorite, winnerLabel, winnerPct };
  }, [simulation2025]);

  const simulationFallbackMessage = useMemo(() => {
    if (simulationError) {
      return simulationError;
    }

    if (hasLoadedSimulation) {
      return 'Simulation details are not available for this season yet.';
    }

    return null;
  }, [hasLoadedSimulation, simulationError]);

  const renderPhaseTable = useCallback(
    (
      title: string,
      getValue: (field: (typeof PHASE_METRIC_FIELDS)[number]) => string,
      options?: { variant?: 'red' | 'blue' },
    ) => {
      const variantStyle =
        options?.variant === 'red'
          ? styles.redText
          : options?.variant === 'blue'
            ? styles.blueText
            : null;

      return (
        <View style={styles.breakdownSection}>
          <ThemedText type="defaultSemiBold" style={[styles.breakdownSectionTitle, variantStyle]}>
            {title}
          </ThemedText>
          <View style={[styles.breakdownTable, { borderColor }]}>
            {PHASE_METRIC_FIELDS.map((field, index) => (
              <View
                key={field.key}
                style={[
                  styles.breakdownTableRow,
                  index !== PHASE_METRIC_FIELDS.length - 1
                    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor }
                    : null,
                ]}
              >
                <ThemedText style={[styles.breakdownLabel, { color: mutedText }]}>{field.label}</ThemedText>
                <ThemedText style={[styles.breakdownValue, variantStyle]}>{getValue(field)}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      );
    },
    [borderColor, mutedText],
  );

  const renderTeamCard = useCallback(
    (team: AllianceTeam, alliance: 'red' | 'blue') => {
      const cardBorder = alliance === 'red' ? '#DC2626' : '#2563EB';

      return (
        <View key={team.team_number} style={styles.teamCardWrapper}>
          <View style={[styles.teamCard, { borderColor: cardBorder }]}>
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
            <View style={styles.teamBreakdowns}>
              {renderPhaseTable(
                'Auto Breakdown',
                (field) => formatStatWithDeviation(team.auto[field.key]),
                { variant: alliance },
              )}
              {renderPhaseTable(
                'Teleop Breakdown',
                (field) => formatStatWithDeviation(team.teleop[field.key]),
                { variant: alliance },
              )}
            </View>
          </View>
        </View>
      );
    },
    [renderPhaseTable],
  );

  const renderAllianceSummaryCard = useCallback(
    (variant: 'red' | 'blue') => {
      const isRed = variant === 'red';
      const summary = isRed ? redAllianceSummary : blueAllianceSummary;
      const autoBreakdown = isRed ? redAllianceAutoBreakdown : blueAllianceAutoBreakdown;
      const teleopBreakdown = isRed ? redAllianceTeleopBreakdown : blueAllianceTeleopBreakdown;
      const title = isRed ? 'Red Alliance' : 'Blue Alliance';
      const variantStyle = isRed ? styles.redText : styles.blueText;

      return (
        <View
          key={`${variant}-summary`}
          style={[styles.summaryColumnCard, { backgroundColor: cardBackground, borderColor }]}
        >
          <ThemedText type="defaultSemiBold" style={[styles.columnTitle, variantStyle]}>
            {title}
          </ThemedText>
          <View style={styles.columnMetrics}>
            {summary.map((metric) => (
              <View key={metric.key} style={styles.columnMetricRow}>
                <ThemedText style={[styles.columnMetricLabel, { color: mutedText }]}>
                  {metric.label}
                </ThemedText>
                <ThemedText style={[styles.columnMetricValue, variantStyle]}>{metric.value}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.breakdownGrid}>
            {renderPhaseTable('Auto Breakdown', (field) => autoBreakdown[field.key], { variant })}
            {renderPhaseTable('Teleop Breakdown', (field) => teleopBreakdown[field.key], { variant })}
          </View>
        </View>
      );
    },
    [
      blueAllianceAutoBreakdown,
      blueAllianceSummary,
      blueAllianceTeleopBreakdown,
      cardBackground,
      borderColor,
      mutedText,
      redAllianceAutoBreakdown,
      redAllianceSummary,
      redAllianceTeleopBreakdown,
      renderPhaseTable,
    ],
  );

  const renderAllianceTeamsSection = useCallback(
    (variant: 'red' | 'blue') => {
      const isRed = variant === 'red';
      const teams = isRed ? redTeams : blueTeams;
      const teamNumbers = isRed ? redTeamNumbers : blueTeamNumbers;
      const allianceLabel = isRed ? 'Red Alliance Teams' : 'Blue Alliance Teams';
      const variantStyle = isRed ? styles.redText : styles.blueText;

      return (
        <View key={`${variant}-teams`} style={styles.teamListSection}>
          <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, variantStyle]}>
            {allianceLabel}
          </ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>
            Teams: {teamNumbers.length > 0 ? teamNumbers.join(', ') : 'TBD'}
          </ThemedText>
          <View style={styles.teamList}>{teams.map((team) => renderTeamCard(team, variant))}</View>
        </View>
      );
    },
    [blueTeamNumbers, blueTeams, mutedText, redTeamNumbers, redTeams, renderTeamCard],
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
        <>
          <View style={styles.viewSelector}>
            {PREVIEW_VIEW_OPTIONS.map((option) => {
              const isActive = option.key === activeView;

              return (
                <Pressable
                  key={option.key}
                  onPress={() => setActiveView(option.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [
                    styles.viewSelectorButton,
                    { borderColor },
                    isActive ? { backgroundColor: accentColor, borderColor: accentColor } : null,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={[
                      styles.viewSelectorLabel,
                      { color: mutedText },
                      isActive ? styles.viewSelectorLabelActive : null,
                    ]}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ScrollView contentContainerStyle={styles.previewContent}>
            {activeView === 'overview' ? (
              <>
                <View style={styles.summaryColumns}>
                  {renderAllianceSummaryCard('red')}
                  <View style={styles.simulationColumn}>
                    {simulation2025 ? (
                      <>
                        <View
                          style={[
                            styles.simulationPredictionCard,
                            { backgroundColor: cardBackground, borderColor },
                          ]}
                        >
                          <ThemedText type="defaultSemiBold" style={styles.simulationSectionTitle}>
                            Predicted Winner
                          </ThemedText>
                          <View style={styles.predictionRow}>
                            <ThemedText
                              style={[
                                styles.predictionWinner,
                                simulationWinner?.isRedFavorite
                                  ? styles.redText
                                  : simulationWinner?.isBlueFavorite
                                    ? styles.blueText
                                    : null,
                              ]}
                            >
                              {simulationWinner?.winnerLabel ?? '—'}
                            </ThemedText>
                            <View
                              style={[
                                styles.winBadge,
                                simulationWinner?.isRedFavorite
                                  ? styles.winBadgeRed
                                  : simulationWinner?.isBlueFavorite
                                    ? styles.winBadgeBlue
                                    : styles.winBadgeNeutral,
                              ]}
                            >
                              <ThemedText style={styles.winBadgeText}>
                                {formatPercentage(simulationWinner?.winnerPct ?? null)}
                              </ThemedText>
                            </View>
                          </View>
                          {simulationWinner &&
                          !simulationWinner.isRedFavorite &&
                          !simulationWinner.isBlueFavorite ? (
                            <ThemedText style={[styles.predictionDescription, { color: mutedText }]}>
                              Both alliances have an equal chance of winning based on the current simulation.
                            </ThemedText>
                          ) : null}
                        </View>

                        <View style={styles.simulationAllianceGrid}>
                          <View
                            style={[
                              styles.simulationAllianceCard,
                              { backgroundColor: cardBackground, borderColor },
                            ]}
                          >
                            <ThemedText
                              type="defaultSemiBold"
                              style={[styles.simulationAllianceTitle, styles.redText]}
                            >
                              Red RP
                            </ThemedText>
                            <View style={styles.simulationMetricRow}>
                              <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>
                                Auto RP
                              </ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.red_auto_rp)}
                              </ThemedText>
                            </View>
                            <View style={styles.simulationMetricGroup}>
                              <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>
                                Coral Success
                              </ThemedText>
                              <View style={styles.simulationMetricSubGroup}>
                                <View style={styles.simulationMetricSubRow}>
                                  <ThemedText
                                    style={[styles.simulationMetricSubLabel, { color: mutedText }]}
                                  >
                                    Win
                                  </ThemedText>
                                  <ThemedText style={styles.simulationMetricValue}>
                                    {formatPercentage(simulation2025.red_w_coral_rp)}
                                  </ThemedText>
                                </View>
                                <View style={styles.simulationMetricSubRow}>
                                  <ThemedText
                                    style={[styles.simulationMetricSubLabel, { color: mutedText }]}
                                  >
                                    RP
                                  </ThemedText>
                                  <ThemedText style={styles.simulationMetricValue}>
                                    {formatPercentage(simulation2025.red_r_coral_rp)}
                                  </ThemedText>
                                </View>
                              </View>
                            </View>
                            <View style={styles.simulationMetricRow}>
                              <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>
                                Endgame RP
                              </ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.red_endgame_rp)}
                              </ThemedText>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.simulationAllianceCard,
                              { backgroundColor: cardBackground, borderColor },
                            ]}
                          >
                            <ThemedText
                              type="defaultSemiBold"
                              style={[styles.simulationAllianceTitle, styles.blueText]}
                            >
                              Blue RP
                            </ThemedText>
                            <View style={styles.simulationMetricRow}>
                              <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>
                                Auto RP
                              </ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.blue_auto_rp)}
                              </ThemedText>
                            </View>
                            <View style={styles.simulationMetricGroup}>
                              <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>
                                Coral Success
                              </ThemedText>
                              <View style={styles.simulationMetricSubGroup}>
                                <View style={styles.simulationMetricSubRow}>
                                  <ThemedText
                                    style={[styles.simulationMetricSubLabel, { color: mutedText }]}
                                  >
                                    Win
                                  </ThemedText>
                                  <ThemedText style={styles.simulationMetricValue}>
                                    {formatPercentage(simulation2025.blue_w_coral_rp)}
                                  </ThemedText>
                                </View>
                                <View style={styles.simulationMetricSubRow}>
                                  <ThemedText
                                    style={[styles.simulationMetricSubLabel, { color: mutedText }]}
                                  >
                                    RP
                                  </ThemedText>
                                  <ThemedText style={styles.simulationMetricValue}>
                                    {formatPercentage(simulation2025.blue_r_coral_rp)}
                                  </ThemedText>
                                </View>
                              </View>
                            </View>
                            <View style={styles.simulationMetricRow}>
                              <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>
                                Endgame RP
                              </ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.blue_endgame_rp)}
                              </ThemedText>
                            </View>
                          </View>
                        </View>
                      </>
                    ) : simulationFallbackMessage ? (
                      <View
                        style={[
                          styles.simulationMessageCard,
                          { backgroundColor: cardBackground, borderColor },
                        ]}
                      >
                        <ThemedText style={[styles.simulationMessageText, { color: mutedText }]}>
                          {simulationFallbackMessage}
                        </ThemedText>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.simulationMessageCard,
                          styles.simulationLoadingCard,
                          { backgroundColor: cardBackground, borderColor },
                        ]}
                      >
                        <ActivityIndicator color={accentColor} />
                        <ThemedText style={[styles.simulationMessageText, { color: mutedText }]}>
                          Loading simulation…
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  {renderAllianceSummaryCard('blue')}
                </View>
              </>
            ) : activeView === 'red' ? (
              <>
                {renderAllianceSummaryCard('red')}
                {renderAllianceTeamsSection('red')}
              </>
            ) : (
              <>
                {renderAllianceSummaryCard('blue')}
                {renderAllianceTeamsSection('blue')}
              </>
            )}
          </ScrollView>
        </>
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
  viewSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  viewSelectorButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  viewSelectorLabel: {
    fontSize: 15,
  },
  viewSelectorLabelActive: {
    color: '#F8FAFC',
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
  simulationColumn: {
    flex: 1,
    minWidth: 220,
    gap: 16,
  },
  simulationPredictionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  simulationSectionTitle: {
    fontSize: 18,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  predictionWinner: {
    fontSize: 16,
    fontWeight: '600',
  },
  winBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  winBadgeRed: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  winBadgeBlue: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  winBadgeNeutral: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  winBadgeText: {
    fontWeight: '700',
  },
  predictionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  simulationAllianceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  simulationAllianceCard: {
    flex: 1,
    minWidth: 200,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  simulationAllianceTitle: {
    fontSize: 18,
  },
  simulationMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  simulationMetricLabel: {
    fontSize: 14,
  },
  simulationMetricValue: {
    fontWeight: '600',
  },
  simulationMetricGroup: {
    gap: 12,
  },
  simulationMetricSubGroup: {
    gap: 8,
  },
  simulationMetricSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simulationMetricSubLabel: {
    fontSize: 12,
  },
  simulationMessageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  simulationMessageText: {
    fontSize: 14,
    textAlign: 'center',
  },
  simulationLoadingCard: {
    alignItems: 'center',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  teamCardWrapper: {
    flexGrow: 1,
    width: '32%',
    minWidth: 0,
  },
  teamCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    minWidth: 0,
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
  teamBreakdowns: {
    gap: 16,
  },
  breakdownGrid: {
    gap: 16,
  },
  breakdownSection: {
    gap: 8,
  },
  breakdownSectionTitle: {
    fontSize: 15,
  },
  breakdownTable: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  breakdownTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
  },
  breakdownValue: {
    fontWeight: '600',
  },
});
