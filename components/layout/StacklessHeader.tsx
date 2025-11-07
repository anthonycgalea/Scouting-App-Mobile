import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface StacklessHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  backLabel?: string;
}

export function StacklessHeader({
  title,
  showBackButton = false,
  onBackPress,
  backLabel = 'Back',
}: StacklessHeaderProps) {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const buttonBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');

  const handleBackPress = useCallback(() => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    router.back();
  }, [onBackPress, router]);

  return (
    <View style={styles.container}>
      {showBackButton ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleBackPress}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: buttonBackground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={textColor} />
          <ThemedText style={[styles.backLabel, { color: textColor }]}>{backLabel}</ThemedText>
        </Pressable>
      ) : null}

      <ThemedText style={[styles.title, { color: textColor }]} type="defaultSemiBold">
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
});
