import { useRouter } from 'expo-router';

import { TeamListScreen, type TeamListItem } from '@/app/screens/Shared/TeamListScreen';
import { getActiveEvent } from '@/app/services/logged-in-event';

export function PrescoutScreen() {
  const router = useRouter();

  const handleTeamPress = (team: TeamListItem) => {
    const activeEventKey = getActiveEvent();

    router.push({
      pathname: '/(drawer)/match-scout/begin-scouting',
      params: {
        mode: 'prescout',
        teamNumber: String(team.number),
        eventKey: activeEventKey ?? undefined,
      },
    });
  };

  return <TeamListScreen title="Prescout" onTeamPress={handleTeamPress} />;
}
