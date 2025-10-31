import { apiRequest, type ApiRequestParams } from './client';

export interface MatchScheduleEntry {
  event_key: string;
  match_number: number;
  match_level: string;
  red1_id: number | null;
  red2_id: number | null;
  red3_id: number | null;
  blue1_id: number | null;
  blue2_id: number | null;
  blue3_id: number | null;
  season?: number | null;
}

export interface MetricStatistics {
  average: number | null;
  standard_deviation: number | null;
}

export interface PhaseMetrics {
  level4: MetricStatistics;
  level3: MetricStatistics;
  level2: MetricStatistics;
  level1: MetricStatistics;
  net: MetricStatistics;
  processor: MetricStatistics;
  total_points: MetricStatistics;
}

export interface TeamMatchPreview {
  team_number: number;
  auto: PhaseMetrics;
  teleop: PhaseMetrics;
  endgame: MetricStatistics;
  total_points: MetricStatistics;
}

export interface AllianceMatchPreview {
  teams: TeamMatchPreview[];
}

export interface MatchPreviewResponse {
  season: number;
  red: AllianceMatchPreview;
  blue: AllianceMatchPreview;
}

export interface MatchSimulationBase {
  season: number;
}

export interface MatchSimulation2025 extends MatchSimulationBase {
  season: 1;
  red_alliance_win_pct: number | null;
  blue_alliance_win_pct: number | null;
  red_auto_rp: number | null;
  red_w_coral_rp: number | null;
  red_r_coral_rp: number | null;
  red_endgame_rp: number | null;
  blue_auto_rp: number | null;
  blue_w_coral_rp: number | null;
  blue_r_coral_rp: number | null;
  blue_endgame_rp: number | null;
}

export type MatchSimulationResponse = MatchSimulation2025 | MatchSimulationBase;

export interface FetchMatchScheduleParams {
  eventKey?: string;
}

export const fetchMatchSchedule = (params?: FetchMatchScheduleParams) => {
  const requestParams: ApiRequestParams | undefined = params?.eventKey
    ? { eventKey: params.eventKey }
    : undefined;

  return apiRequest<MatchScheduleEntry[]>("/event/matches", {
    method: 'GET',
    params: requestParams,
  });
};

export interface FetchMatchPreviewParams {
  matchLevel: string;
  matchNumber: number;
  eventKey?: string;
}

export const fetchMatchPreview = ({ matchLevel, matchNumber, eventKey }: FetchMatchPreviewParams) => {
  const normalizedLevel = matchLevel.toLowerCase();
  const requestParams: ApiRequestParams | undefined = eventKey ? { eventKey } : undefined;

  return apiRequest<MatchPreviewResponse>(
    `/event/match/${encodeURIComponent(normalizedLevel)}/${matchNumber}/preview`,
    { method: 'GET', params: requestParams }
  );
};

export interface FetchMatchSimulationParams {
  matchLevel: string;
  matchNumber: number;
  eventKey?: string;
}

export const fetchMatchSimulation = ({
  matchLevel,
  matchNumber,
  eventKey,
}: FetchMatchSimulationParams) => {
  const normalizedLevel = matchLevel.toLowerCase();
  const requestParams: ApiRequestParams | undefined = eventKey ? { eventKey } : undefined;

  return apiRequest<MatchSimulationResponse>(
    `/event/match/${encodeURIComponent(normalizedLevel)}/${matchNumber}/simulation`,
    { method: 'GET', params: requestParams }
  );
};
