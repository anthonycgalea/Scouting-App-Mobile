import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  MatchTeamSelectScreen,
  createMatchTeamSelectScreenPropsFromParams,
} from '@/app/screens/MatchScout/MatchTeamSelectScreen';

export default function MatchTeamSelectRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const screenProps = createMatchTeamSelectScreenPropsFromParams(params);

  return <MatchTeamSelectScreen {...screenProps} onCancel={() => router.back()} />;
}
