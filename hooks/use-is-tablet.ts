import { Platform, useWindowDimensions } from 'react-native';

export function useIsTablet() {
  const { width, height } = useWindowDimensions();
  const smallestDimension = Math.min(width, height);

  if (Platform.OS === 'ios') {
    return Platform.isPad;
  }

  return smallestDimension >= 600;
}
