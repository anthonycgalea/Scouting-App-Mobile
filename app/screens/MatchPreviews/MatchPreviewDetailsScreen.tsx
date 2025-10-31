// app/match-previews/[view].tsx (or similar)
import { useLocalSearchParams, useNavigation } from 'expo-router'; // ✅ useNavigation instead of Stack
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  onClose?: () => void;
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

const formatStatWithDeviation = (stat?: MetricStatistics): ReactNode => {
  const average = formatNumber(stat?.average);
  if (!average) {
    return '—';
  }
  const deviation = formatNumber(stat?.standard_deviation);
  if (deviation && deviation !== '0.0') {
    return (
      <>
        {average}
        <Text style={styles.standardDeviationSuperscript}>±{deviation}</Text>
      </>
    );
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

const ALLIANCE_METRIC_FIELDS = [
  { key: 'auto', label: 'Auto Total', selector: (t: AllianceTeam) => t.auto.total_points },
  { key: 'teleop', label: 'Teleop Total', selector: (t: AllianceTeam) => t.teleop.total_points },
  { key: 'endgame', label: 'Endgame', selector: (t: AllianceTeam) => t.endgame },
  { key: 'total', label: 'Total Score', selector: (t: AllianceTeam) => t.total_points },
] as const;

const sumTeamAverages = (teams: AllianceTeam[], selector: (t: AllianceTeam) => MetricStatistics | undefined) => {
  let total = 0;
  let hasValue = false;
  for (const t of teams) {
    const v = selector(t)?.average;
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      total += v;
      hasValue = true;
    }
  }
  return hasValue ? total : undefined;
};

const renderAllianceTeamNumbers = (fallback: (number | undefined)[], previewTeams: AllianceTeam[]) =>
  previewTeams.length > 0
    ? previewTeams.map((t) => t.team_number).filter((n) => n !== undefined)
    : fallback.filter((n) => n !== undefined);

const isMatchSimulation2025 = (
  simulation: MatchSimulationResponse | null,
): simulation is MatchSimulation2025 => simulation?.season === 1;

export default function MatchPreviewDetailsScreen() {
  const params = useLocalSearchParams();
  const {
    matchLevel,
    matchNumber,
    eventKey,
    red1,
    red2,
    red3,
    blue1,
    blue2,
    blue3,
  } = createMatchPreviewDetailsScreenPropsFromParams(params);

  const [preview, setPreview] = useState<MatchPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<MatchSimulationResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [hasLoadedSimulation, setHasLoadedSimulation] = useState(false);
  const [activeView, setActiveView] = useState<PreviewViewKey>('overview');

  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.1)', dark: 'rgba(148, 163, 184, 0.25)' },
    'text',
  );
  const mutedText = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226,232,240,0.7)' },
    'text',
  );
  const textColor = useThemeColor({}, 'text');
  const closeButtonBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');

  const numericMatchNumber = Number.isFinite(matchNumber ?? NaN) ? matchNumber : undefined;
  const matchLabel = useMemo(() => {
    const levelLabel = getMatchLevelLabel(matchLevel);
    if (!numericMatchNumber) return levelLabel;
    return `${levelLabel} Match ${numericMatchNumber} Preview`;
  }, [matchLevel, numericMatchNumber]);

  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: matchLabel });
  }, [navigation, matchLabel]);


  const loadPreview = useCallback(async () => {
    if (!matchLevel || numericMatchNumber === undefined)
      throw new Error('Match information is missing or invalid.');
    return fetchMatchPreview({ matchLevel, matchNumber: numericMatchNumber, eventKey });
  }, [matchLevel, numericMatchNumber, eventKey]);

  const loadSimulation = useCallback(async () => {
    if (!matchLevel || numericMatchNumber === undefined)
      throw new Error('Match information is missing or invalid.');
    return fetchMatchSimulation({ matchLevel, matchNumber: numericMatchNumber, eventKey });
  }, [matchLevel, numericMatchNumber, eventKey]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      loadPreview(),
      loadSimulation().catch((err) => {
        setSimulationError(err.message);
        return null;
      }),
    ])
      .then(([p, s]) => {
        setPreview(p);
        setSimulation(s);
      })
      .catch((e) => setErrorMessage(e.message))
      .finally(() => {
        setIsLoading(false);
        setHasLoadedSimulation(true);
      });
  }, [loadPreview, loadSimulation]);

  const redTeams = useMemo(() => preview?.red.teams ?? [], [preview]);
  const blueTeams = useMemo(() => preview?.blue.teams ?? [], [preview]);
  const redTeamNumbers = useMemo(
    () => renderAllianceTeamNumbers([red1, red2, red3], redTeams),
    [red1, red2, red3, redTeams],
  );
  const blueTeamNumbers = useMemo(
    () => renderAllianceTeamNumbers([blue1, blue2, blue3], blueTeams),
    [blue1, blue2, blue3, blueTeams],
  );

  const buildAllianceSummary = useCallback((teams: AllianceTeam[], variant: 'red' | 'blue') => {
    return ALLIANCE_METRIC_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      value: formatNumber(sumTeamAverages(teams, field.selector)) ?? '—',
      variant,
    }));
  }, []);

  const buildAlliancePhaseBreakdown = useCallback(
    (teams: AllianceTeam[], selector: (t: AllianceTeam) => PhaseMetrics) => {
      const breakdown = {} as Record<PhaseMetricFieldKey, string>;
      PHASE_METRIC_FIELDS.forEach((f) => {
        const total = sumTeamAverages(teams, (t) => selector(t)[f.key]);
        breakdown[f.key] = formatNumber(total) ?? '—';
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
    [buildAllianceSummary, blueTeams],
  );

  const redAllianceAutoBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(redTeams, (t) => t.auto),
    [buildAlliancePhaseBreakdown, redTeams],
  );
  const redAllianceTeleopBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(redTeams, (t) => t.teleop),
    [buildAlliancePhaseBreakdown, redTeams],
  );
  const blueAllianceAutoBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(blueTeams, (t) => t.auto),
    [buildAlliancePhaseBreakdown, blueTeams],
  );
  const blueAllianceTeleopBreakdown = useMemo(
    () => buildAlliancePhaseBreakdown(blueTeams, (t) => t.teleop),
    [buildAlliancePhaseBreakdown, blueTeams],
  );

  const simulation2025 = useMemo(
    () => (isMatchSimulation2025(simulation) ? simulation : null),
    [simulation],
  );

  const simulationWinner = useMemo(() => {
    if (!simulation2025) return null;
    const redWin = simulation2025.red_alliance_win_pct ?? 0;
    const blueWin = simulation2025.blue_alliance_win_pct ?? 0;
    const isRed = redWin > blueWin;
    const isBlue = blueWin > redWin;
    const winnerLabel = isRed ? 'Red Alliance' : isBlue ? 'Blue Alliance' : 'Evenly Matched';
    const winnerPct = isRed ? redWin : isBlue ? blueWin : redWin;
    return { redWinPct: redWin, blueWinPct: blueWin, isRed, isBlue, winnerLabel, winnerPct };
  }, [simulation2025]);

  const simulationFallbackMessage = useMemo(() => {
    if (simulationError) return simulationError;
    if (hasLoadedSimulation) return 'Simulation details are not available for this season yet.';
    return null;
  }, [hasLoadedSimulation, simulationError]);

  const renderPhaseTable = useCallback(
    (title: string, getValue: (f: (typeof PHASE_METRIC_FIELDS)[number]) => ReactNode, variant?: 'red' | 'blue') => {
      const colorStyle = variant === 'red' ? styles.redText : variant === 'blue' ? styles.blueText : null;
      return (
        <View style={styles.breakdownSection}>
          <ThemedText type="defaultSemiBold" style={[styles.breakdownSectionTitle, colorStyle]}>
            {title}
          </ThemedText>
          <View style={[styles.breakdownTable, { borderColor }]}>
            {PHASE_METRIC_FIELDS.map((f, i) => (
              <View
                key={f.key}
                style={[
                  styles.breakdownTableRow,
                  i !== PHASE_METRIC_FIELDS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor },
                ]}
              >
                <ThemedText style={[styles.breakdownLabel, { color: mutedText }]}>{f.label}</ThemedText>
                <ThemedText style={[styles.breakdownValue, colorStyle]}>{getValue(f)}</ThemedText>
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
              {renderPhaseTable('Auto Breakdown', (f) => formatStatWithDeviation(team.auto[f.key]), alliance)}
              {renderPhaseTable('Teleop Breakdown', (f) => formatStatWithDeviation(team.teleop[f.key]), alliance)}
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
      const colorStyle = isRed ? styles.redText : styles.blueText;
      return (
        <View style={[styles.summaryColumnCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText type="defaultSemiBold" style={[styles.columnTitle, colorStyle]}>
            {title}
          </ThemedText>
          <View style={styles.columnMetrics}>
            {summary.map((m) => (
              <View key={m.key} style={styles.columnMetricRow}>
                <ThemedText style={[styles.columnMetricLabel, { color: mutedText }]}>{m.label}</ThemedText>
                <ThemedText style={[styles.columnMetricValue, colorStyle]}>{m.value}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.breakdownGrid}>
            {renderPhaseTable('Auto Breakdown', (f) => autoBreakdown[f.key], variant)}
            {renderPhaseTable('Teleop Breakdown', (f) => teleopBreakdown[f.key], variant)}
          </View>
        </View>
      );
    },
    [
      redAllianceSummary,
      blueAllianceSummary,
      redAllianceAutoBreakdown,
      blueAllianceAutoBreakdown,
      redAllianceTeleopBreakdown,
      blueAllianceTeleopBreakdown,
      renderPhaseTable,
      borderColor,
      cardBackground,
      mutedText,
    ],
  );

  const renderAllianceTeamsSection = useCallback(
    (variant: 'red' | 'blue') => {
      const isRed = variant === 'red';
      const teams = isRed ? redTeams : blueTeams;
      return (
        <View style={styles.teamListSection}>
          <View style={styles.teamList}>
            {teams.map((t) => renderTeamCard(t, variant))}
            {renderAllianceSummaryCard(variant)}
          </View>
        </View>
      );
    },
    [redTeams, blueTeams, renderTeamCard, renderAllianceSummaryCard],
  );

  return (
    <ScreenContainer>
      {/* Tab selector + Close in one row under router header */}
      <View style={styles.topBar}>
        <View style={styles.tabSelectorRow}>
          {PREVIEW_VIEW_OPTIONS.map((opt) => {
            const isActive = opt.key === activeView;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setActiveView(opt.key)}
                style={[
                  styles.tabButton,
                  { borderColor },
                  isActive && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <ThemedText type="defaultSemiBold" style={[styles.tabLabel, { color: isActive ? '#FFF' : mutedText }]}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => history.back()}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: closeButtonBackground, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <ThemedText style={styles.closeButtonText}>Close</ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.stateWrapper}>
          <ActivityIndicator color={accentColor} />
          <ThemedText style={[styles.stateMessage, { color: mutedText }]}>Loading match preview…</ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={[styles.stateCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={{ color: textColor }}>{errorMessage}</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.previewContent}>
          {activeView === 'overview' ? (
            <View style={styles.summaryColumns}>
              {renderAllianceSummaryCard('red')}
              <View style={styles.simulationColumn}>
                {simulation2025 ? (
                  <>
                    {/* Predicted Winner */}
                    <View style={[styles.simulationPredictionCard, { backgroundColor: cardBackground, borderColor }]}>
                      <ThemedText type="defaultSemiBold" style={styles.simulationSectionTitle}>
                        Predicted Winner
                      </ThemedText>
                      <View style={styles.predictionRow}>
                        <ThemedText
                          style={[
                            styles.predictionWinner,
                            simulationWinner?.isRed ? styles.redText : simulationWinner?.isBlue ? styles.blueText : null,
                          ]}
                        >
                          {simulationWinner?.winnerLabel ?? '—'}
                        </ThemedText>
                        <View
                          style={[
                            styles.winBadge,
                            simulationWinner?.isRed
                              ? styles.winBadgeRed
                              : simulationWinner?.isBlue
                              ? styles.winBadgeBlue
                              : styles.winBadgeNeutral,
                          ]}
                        >
                          <ThemedText style={styles.winBadgeText}>
                            {formatPercentage(simulationWinner?.winnerPct ?? null)}
                          </ThemedText>
                        </View>
                      </View>
                    </View>

                    {/* RP Breakdown Cards */}
                    <View style={styles.simulationAllianceGrid}>
                      {/* Red Alliance */}
                      <View style={[styles.simulationAllianceCard, { backgroundColor: cardBackground, borderColor }]}>
                        <ThemedText type="defaultSemiBold" style={[styles.simulationAllianceTitle, styles.redText]}>
                          Red RP
                        </ThemedText>

                        <View style={styles.simulationMetricRow}>
                          <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>Auto RP</ThemedText>
                          <ThemedText style={styles.simulationMetricValue}>
                            {formatPercentage(simulation2025.red_auto_rp)}
                          </ThemedText>
                        </View>

                        <View style={styles.simulationMetricGroup}>
                          <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>Coral Success</ThemedText>
                          <View style={styles.simulationMetricSubGroup}>
                            <View style={styles.simulationMetricSubRow}>
                              <ThemedText style={[styles.simulationMetricSubLabel, { color: mutedText }]}>Win</ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.red_w_coral_rp)}
                              </ThemedText>
                            </View>
                            <View style={styles.simulationMetricSubRow}>
                              <ThemedText style={[styles.simulationMetricSubLabel, { color: mutedText }]}>RP</ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.red_r_coral_rp)}
                              </ThemedText>
                            </View>
                          </View>
                        </View>

                        <View style={styles.simulationMetricRow}>
                          <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>Endgame RP</ThemedText>
                          <ThemedText style={styles.simulationMetricValue}>
                            {formatPercentage(simulation2025.red_endgame_rp)}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Blue Alliance */}
                      <View style={[styles.simulationAllianceCard, { backgroundColor: cardBackground, borderColor }]}>
                        <ThemedText type="defaultSemiBold" style={[styles.simulationAllianceTitle, styles.blueText]}>
                          Blue RP
                        </ThemedText>

                        <View style={styles.simulationMetricRow}>
                          <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>Auto RP</ThemedText>
                          <ThemedText style={styles.simulationMetricValue}>
                            {formatPercentage(simulation2025.blue_auto_rp)}
                          </ThemedText>
                        </View>

                        <View style={styles.simulationMetricGroup}>
                          <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>Coral Success</ThemedText>
                          <View style={styles.simulationMetricSubGroup}>
                            <View style={styles.simulationMetricSubRow}>
                              <ThemedText style={[styles.simulationMetricSubLabel, { color: mutedText }]}>Win</ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.blue_w_coral_rp)}
                              </ThemedText>
                            </View>
                            <View style={styles.simulationMetricSubRow}>
                              <ThemedText style={[styles.simulationMetricSubLabel, { color: mutedText }]}>RP</ThemedText>
                              <ThemedText style={styles.simulationMetricValue}>
                                {formatPercentage(simulation2025.blue_r_coral_rp)}
                              </ThemedText>
                            </View>
                          </View>
                        </View>

                        <View style={styles.simulationMetricRow}>
                          <ThemedText style={[styles.simulationMetricLabel, { color: mutedText }]}>Endgame RP</ThemedText>
                          <ThemedText style={styles.simulationMetricValue}>
                            {formatPercentage(simulation2025.blue_endgame_rp)}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </>
                ) : simulationFallbackMessage ? (
                  <View style={[styles.simulationMessageCard, { backgroundColor: cardBackground, borderColor }]}>
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
                    <ThemedText style={[styles.simulationMessageText, { color: mutedText }]}>Loading simulation…</ThemedText>
                  </View>
                )}
              </View>
              {renderAllianceSummaryCard('blue')}
            </View>
          ) : activeView === 'red' ? (
            renderAllianceTeamsSection('red')
          ) : (
            renderAllianceTeamsSection('blue')
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

export const createMatchPreviewDetailsScreenPropsFromParams = (params: any) => {
  const toSingle = (v: any) => (Array.isArray(v) ? v[0] : v);
  const parseNum = (v: any) => {
    const raw = toSingle(v);
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    matchLevel: toSingle(params.matchLevel),
    matchNumber: parseNum(params.matchNumber),
    eventKey: toSingle(params.eventKey),
    red1: parseNum(params.red1),
    red2: parseNum(params.red2),
    red3: parseNum(params.red3),
    blue1: parseNum(params.blue1),
    blue2: parseNum(params.blue2),
    blue3: parseNum(params.blue3),
  };
};

const styles = StyleSheet.create({
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  tabSelectorRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButtonText: { fontWeight: '600' },
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
  },
  stateMessage: { textAlign: 'center', fontSize: 16 },
  previewContent: { gap: 20, paddingBottom: 40 },
  summaryColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  summaryColumnCard: { flex: 1, minWidth: 220, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  simulationColumn: { flex: 1, minWidth: 220, gap: 16 },
  simulationPredictionCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  simulationSectionTitle: { fontSize: 18 },
  predictionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  predictionWinner: { fontSize: 16, fontWeight: '600' },
  winBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  winBadgeRed: { backgroundColor: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)' },
  winBadgeBlue: { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.3)' },
  winBadgeNeutral: { backgroundColor: 'rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.12)' },
  winBadgeText: { fontWeight: '700' },
  simulationMessageCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  simulationMessageText: { fontSize: 14, textAlign: 'center' },
  simulationLoadingCard: { alignItems: 'center' },
  columnTitle: { fontSize: 18 },
  columnMetrics: { gap: 12 },
  columnMetricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  columnMetricLabel: { flex: 1, fontSize: 14 },
  columnMetricValue: { fontWeight: '600' },
  redText: { color: '#DC2626' },
  blueText: { color: '#2563EB' },
  teamListSection: { gap: 12 },
  teamList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  teamCardWrapper: { flexGrow: 1, flexShrink: 1, width: '24%', minWidth: 220 },
  teamCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12, minWidth: 0 },
  teamCardTitle: { fontSize: 16 },
  teamMetricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  teamMetric: { minWidth: 120, gap: 4 },
  metricLabel: { fontSize: 13, color: 'rgba(15,23,42,0.7)' },
  metricValue: { fontWeight: '600' },
  teamBreakdowns: { gap: 16 },
  breakdownGrid: { gap: 16 },
  breakdownSection: { gap: 8 },
  breakdownSectionTitle: { fontSize: 15 },
  breakdownTable: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  breakdownTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  breakdownLabel: { flex: 1, fontSize: 13 },
  breakdownValue: { fontWeight: '600' },
  standardDeviationSuperscript: {
    fontSize: 12,
    marginLeft: 2,
    lineHeight: 12,
    transform: [{ translateY: -6 }],
  },
});


