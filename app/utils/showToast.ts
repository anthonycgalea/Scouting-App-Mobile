import { Alert, Platform, ToastAndroid } from 'react-native';

export function showToast(message: string, title = 'General data updated') {
  const show = Platform.select<() => void>({
    android: () => ToastAndroid.show(message, ToastAndroid.SHORT),
    ios: () => Alert.alert(title, message),
    default: () => Alert.alert(title, message),
  });

  show?.();
}
