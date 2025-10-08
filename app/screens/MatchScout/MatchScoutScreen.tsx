import { useMemo, useState } from 'react';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  MatchSchedule,
  MatchScheduleEntry,
  MatchScheduleSection,
  MatchScheduleToggle,
  SECTION_DEFINITIONS,
  groupMatchesBySection,
} from '@/components/match-schedule';
import { ThemedText } from '@/components/themed-text';

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

  const groupedMatches = useMemo(() => groupMatchesBySection(MOCK_MATCHES), []);

  return (
    <ScreenContainer>
      <ThemedText type="title">Match Scouting</ThemedText>
      <ThemedText>
        Record match performance, scoring actions, and alliance notes in real time.
      </ThemedText>
      <MatchScheduleToggle
        value={selectedSection}
        onChange={setSelectedSection}
        options={SECTION_DEFINITIONS}
      />
      <MatchSchedule matches={groupedMatches[selectedSection]} />
    </ScreenContainer>
  );
}
