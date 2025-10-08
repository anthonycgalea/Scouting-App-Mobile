export interface MatchScheduleEntry {
  match_number: number;
  match_level: string;
  red1_id?: number | null;
  red2_id?: number | null;
  red3_id?: number | null;
  blue1_id?: number | null;
  blue2_id?: number | null;
  blue3_id?: number | null;
}

export interface TeamMatchValidationEntry {
  match_number: number;
  match_level: string;
}
