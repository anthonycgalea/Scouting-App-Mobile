import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  MatchSchedule,
  MatchScheduleEntry,
  MatchScheduleSection,
  MatchScheduleToggle,
  SECTION_DEFINITIONS,
  groupMatchesBySection,
} from '@/components/match-schedule';

const MOCK_MATCHES: MatchScheduleEntry[] = [
  {
    match_number: 1,
    match_level: 'qm',
    red1_id: 111,
    red2_id: 222,
    red3_id: 333,
    blue1_id: 444,
    blue2_id: 555,
    blue3_id: 666,
  },
  {
    match_number: 2,
    match_level: 'qm',
    red1_id: 777,
    red2_id: 888,
    red3_id: 999,
    blue1_id: 1010,
    blue2_id: 1111,
    blue3_id: 1212,
  },
  {
    match_number: 1,
    match_level: 'sf',
    red1_id: 1313,
    red2_id: 1414,
    red3_id: 1515,
    blue1_id: 1616,
    blue2_id: 1717,
    blue3_id: 1818,
  },
  {
    match_number: 1,
    match_level: 'f',
    red1_id: 1919,
    red2_id: 2020,
    red3_id: 2121,
    blue1_id: 2222,
    blue2_id: 2323,
    blue3_id: 2424,
  },
];

export function MatchScoutScreen() {
  const [selectedSection, setSelectedSection] = useState<MatchScheduleSection>('qualification');
  const router = useRouter();

  const groupedMatches = useMemo(() => groupMatchesBySection(MOCK_MATCHES), []);

  const handleMatchPress = useCallback(
    (match: MatchScheduleEntry) => {
      const params: Record<string, string> = {
        matchLevel: match.match_level,
        matchNumber: String(match.match_number),
      };

      const maybeAddTeam = (key: string, value: number | null | undefined) => {
        if (value !== null && value !== undefined) {
          params[key] = String(value);
        }
      };

      maybeAddTeam('red1', match.red1_id);
      maybeAddTeam('red2', match.red2_id);
      maybeAddTeam('red3', match.red3_id);
      maybeAddTeam('blue1', match.blue1_id);
      maybeAddTeam('blue2', match.blue2_id);
      maybeAddTeam('blue3', match.blue3_id);

      router.push({ pathname: '/(drawer)/match-scout/select-team', params });
    },
    [router]
  );

  return (
    <ScreenContainer>
      <MatchScheduleToggle
        value={selectedSection}
        onChange={setSelectedSection}
        options={SECTION_DEFINITIONS}
      />
      <MatchSchedule matches={groupedMatches[selectedSection]} onMatchPress={handleMatchPress} />
    </ScreenContainer>
  );
}
