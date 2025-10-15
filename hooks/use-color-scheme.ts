import { useContext } from 'react';
import {
  ColorSchemeContext,
  type ColorScheme,
  type ColorSchemePreference,
} from '@/app/providers/ColorSchemeProvider';

export function useColorScheme(): ColorScheme {
  const context = useContext(ColorSchemeContext);

  if (!context) {
    return 'light';
  }

  return context.colorScheme;
}

export function useColorSchemePreference(): ColorSchemePreference {
  const context = useContext(ColorSchemeContext);

  if (!context) {
    return 'system';
  }

  return context.preference;
}

export function useSetColorSchemePreference() {
  const context = useContext(ColorSchemeContext);

  if (!context) {
    throw new Error('useSetColorSchemePreference must be used within a ColorSchemeProvider.');
  }

  return context.setPreference;
}
