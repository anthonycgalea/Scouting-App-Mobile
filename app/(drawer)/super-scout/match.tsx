import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  SuperScoutMatchScreen,
  createSuperScoutMatchScreenPropsFromParams,
} from '@/app/screens/SuperScout/SuperScoutMatchScreen';

export default function SuperScoutMatchRoute() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const screenProps = createSuperScoutMatchScreenPropsFromParams(params);

  return <SuperScoutMatchScreen {...screenProps} onClose={() => router.back()} />;
}
