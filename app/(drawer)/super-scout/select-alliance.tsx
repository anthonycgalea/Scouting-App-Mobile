import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  SuperScoutAllianceSelectScreen,
  createSuperScoutAllianceSelectScreenPropsFromParams,
} from '@/app/screens/SuperScout/SuperScoutAllianceSelectScreen';

export default function SuperScoutAllianceSelectRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const screenProps = createSuperScoutAllianceSelectScreenPropsFromParams(params);

  return <SuperScoutAllianceSelectScreen {...screenProps} onCancel={() => router.back()} />;
}
