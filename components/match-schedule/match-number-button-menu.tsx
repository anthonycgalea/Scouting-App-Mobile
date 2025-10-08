import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface MatchNumberButtonMenuProps {
  matchNumber: number;
  matchLevel: string;
}

export function MatchNumberButtonMenu({ matchNumber, matchLevel }: MatchNumberButtonMenuProps) {
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'icon');

  return (
    <Link
      asChild
      href={`/matches/preview/${matchLevel}/${matchNumber}`}
      accessibilityLabel={`Preview match ${matchNumber}`}
    >
      <Pressable style={({ pressed }) => [styles.button, { borderColor }, pressed && styles.pressed]}>
        <ThemedText type="defaultSemiBold" style={[styles.label, { color: tintColor }]}>
          Match {matchNumber}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 14,
  },
});
