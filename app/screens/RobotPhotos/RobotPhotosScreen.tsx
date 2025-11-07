import { useRouter } from 'expo-router';

import { TeamListScreen, type TeamListItem } from '@/app/screens/Shared/TeamListScreen';

export function RobotPhotosScreen() {
  const router = useRouter();

  const handleTeamPress = (team: TeamListItem) => {
    router.push({
      pathname: '/(drawer)/robot-photos/team-photos',
      params: {
        teamNumber: String(team.number),
        teamName: team.name,
      },
    });
  };

  return (
    <TeamListScreen
      title="Robot Photos"
      onTeamPress={handleTeamPress}
      showRobotPhotoStatus
    />
  );
}
