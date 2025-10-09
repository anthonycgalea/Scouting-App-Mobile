import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

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
  // Qualification Matches
  {
    match_number: 1,
    match_level: 'qm',
    event_key: '2024mock',
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
    event_key: '2024mock',
    red1_id: 777,
    red2_id: 888,
    red3_id: 999,
    blue1_id: 1010,
    blue2_id: 1111,
    blue3_id: 1212,
  },
  {
    match_number: 3,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 1313,
    red2_id: 1414,
    red3_id: 1515,
    blue1_id: 1616,
    blue2_id: 1717,
    blue3_id: 1818,
  },
  {
    match_number: 4,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 1919,
    red2_id: 2020,
    red3_id: 2121,
    blue1_id: 2222,
    blue2_id: 2323,
    blue3_id: 2424,
  },
  {
    match_number: 5,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 2525,
    red2_id: 2626,
    red3_id: 2727,
    blue1_id: 2828,
    blue2_id: 2929,
    blue3_id: 3030,
  },
  {
    match_number: 6,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 3131,
    red2_id: 3232,
    red3_id: 3333,
    blue1_id: 3434,
    blue2_id: 3535,
    blue3_id: 3636,
  },
  {
    match_number: 7,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 3737,
    red2_id: 3838,
    red3_id: 3939,
    blue1_id: 4040,
    blue2_id: 4141,
    blue3_id: 4242,
  },
  {
    match_number: 8,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 4343,
    red2_id: 4444,
    red3_id: 4545,
    blue1_id: 4646,
    blue2_id: 4747,
    blue3_id: 4848,
  },
  {
    match_number: 9,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 4949,
    red2_id: 5050,
    red3_id: 5151,
    blue1_id: 5252,
    blue2_id: 5353,
    blue3_id: 5454,
  },
  {
    match_number: 10,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 5555,
    red2_id: 5656,
    red3_id: 5757,
    blue1_id: 5858,
    blue2_id: 5959,
    blue3_id: 6060,
  },
  {
    match_number: 11,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 6161,
    red2_id: 6262,
    red3_id: 6363,
    blue1_id: 6464,
    blue2_id: 6565,
    blue3_id: 6666,
  },
  {
    match_number: 12,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 6767,
    red2_id: 6868,
    red3_id: 6969,
    blue1_id: 7070,
    blue2_id: 7171,
    blue3_id: 7272,
  },
  {
    match_number: 13,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 7373,
    red2_id: 7474,
    red3_id: 7575,
    blue1_id: 7676,
    blue2_id: 7777,
    blue3_id: 7878,
  },
  {
    match_number: 14,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 7979,
    red2_id: 8080,
    red3_id: 8181,
    blue1_id: 8282,
    blue2_id: 8383,
    blue3_id: 8484,
  },
  {
    match_number: 15,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 8585,
    red2_id: 8686,
    red3_id: 8787,
    blue1_id: 8888,
    blue2_id: 8989,
    blue3_id: 9090,
  },
  {
    match_number: 16,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 9191,
    red2_id: 9292,
    red3_id: 9393,
    blue1_id: 9494,
    blue2_id: 9595,
    blue3_id: 9696,
  },
  {
    match_number: 17,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 9797,
    red2_id: 9898,
    red3_id: 9999,
    blue1_id: 10000,
    blue2_id: 10101,
    blue3_id: 10202,
  },
  {
    match_number: 18,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 10303,
    red2_id: 10404,
    red3_id: 10505,
    blue1_id: 10606,
    blue2_id: 10707,
    blue3_id: 10808,
  },
  {
    match_number: 19,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 10909,
    red2_id: 11010,
    red3_id: 11111,
    blue1_id: 11212,
    blue2_id: 11313,
    blue3_id: 11414,
  },
  {
    match_number: 20,
    match_level: 'qm',
    event_key: '2024mock',
    red1_id: 11515,
    red2_id: 11616,
    red3_id: 11717,
    blue1_id: 11818,
    blue2_id: 11919,
    blue3_id: 12020,
  },

  // Playoffs
  {
    match_number: 1,
    match_level: 'sf',
    event_key: '2024mock',
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
    event_key: '2024mock',
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

      if (match.event_key) {
        params.eventKey = match.event_key;
      }

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
