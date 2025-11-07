import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface SmallScreenHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function SmallScreenHeader({
  title,
  showBackButton = false,
  onBackPress,
}: SmallScreenHeaderProps) {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const textColor = useThemeColor({}, 'text');
  const iconBackground = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.04)', dark: 'rgba(148, 163, 184, 0.16)' },
    'background',
  );
  const borderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.24)' },
    'text',
  );

  const additionalTopInset = Math.max(top - 16, 0);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.wrapper, { marginTop: additionalTopInset }]}> 
      <View style={[styles.header, { borderColor }]}> 
        {showBackButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBackPress}
            style={[styles.backButton, { backgroundColor: iconBackground }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={textColor} />
          </Pressable>
        ) : null}
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
  },
});
