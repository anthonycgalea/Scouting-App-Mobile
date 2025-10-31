import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  MatchPreviewDetailsScreen,
  createMatchPreviewDetailsScreenPropsFromParams,
} from '@/app/screens/MatchPreviews/MatchPreviewDetailsScreen';

export default function MatchPreviewDetailsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const screenProps = createMatchPreviewDetailsScreenPropsFromParams(params);

  return <MatchPreviewDetailsScreen {...screenProps} onClose={() => router.back()} />;
}
