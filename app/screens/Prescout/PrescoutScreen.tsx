import { useRouter } from 'expo-router';

import { TeamListScreen, type TeamListItem } from '@/app/screens/Shared/TeamListScreen';
import { getActiveEvent } from '@/app/services/logged-in-event';

export function PrescoutScreen() {
  const router = useRouter();

  const handleTeamPress = (team: TeamListItem) => {
    const activeEventKey = getActiveEvent();
    const teamNumberParam = String(team.number);

    const params: Record<string, string> = {
      mode: 'prescout',
      teamNumber: teamNumberParam,
      team_number: teamNumberParam,
    };

    if (activeEventKey) {
      params.eventKey = activeEventKey;
      params.event_key = activeEventKey;
    }

    router.push({
      pathname: '/(drawer)/match-scout/begin-scouting',
      params,
    });
  };

  return <TeamListScreen title="Prescout" onTeamPress={handleTeamPress} />;
}
