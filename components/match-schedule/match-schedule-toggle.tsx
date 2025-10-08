import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

import type { MatchScheduleSection, MatchScheduleToggleOption } from './constants';

interface MatchScheduleToggleProps {
  value: MatchScheduleSection;
  options: MatchScheduleToggleOption[];
  onChange: (value: MatchScheduleSection) => void;
}

export function MatchScheduleToggle({ value, options, onChange }: MatchScheduleToggleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: isDark ? 'rgba(23, 23, 23, 0.9)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.9)',
        },
      ]}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.control,
              isActive && [styles.controlActive, isDark ? styles.controlActiveDark : styles.controlActiveLight],
              pressed && styles.controlPressed,
            ]}
            onPress={() => onChange(option.value)}
          >
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.label,
                isActive && (isDark ? styles.labelActiveDark : styles.labelActiveLight),
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    gap: 4,
    alignItems: 'center',
  },
  control: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: {
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  controlActiveLight: {
    backgroundColor: '#f97316',
  },
  controlActiveDark: {
    backgroundColor: '#db2777',
  },
  controlPressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 14,
  },
  labelActiveLight: {
    color: '#FFFFFF',
  },
  labelActiveDark: {
    color: '#FFFFFF',
  },
});
