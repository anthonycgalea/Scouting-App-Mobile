import { useRouter } from 'expo-router';

import { TeamListScreen, type TeamListItem } from '@/app/screens/Shared/TeamListScreen';

export function PitScoutScreen() {
  const router = useRouter();

  const handleTeamPress = (team: TeamListItem) => {
    router.push({
      pathname: '/(drawer)/pit-scout/team-details',
      params: {
        teamNumber: String(team.number),
        teamName: team.name,
      },
    });
  };

  return <TeamListScreen title="Pit Scout" onTeamPress={handleTeamPress} />;
}
