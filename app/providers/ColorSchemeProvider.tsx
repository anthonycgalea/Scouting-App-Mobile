import {
  createContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ColorScheme = 'light' | 'dark';
export type ColorSchemePreference = ColorScheme | 'system';

type ColorSchemeContextValue = {
  colorScheme: ColorScheme;
  preference: ColorSchemePreference;
  setPreference: Dispatch<SetStateAction<ColorSchemePreference>>;
};

export const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreference] = useState<ColorSchemePreference>('system');

  const effectiveScheme: ColorScheme =
    preference === 'system' ? systemScheme ?? 'light' : preference;

  const value = useMemo(
    () => ({
      colorScheme: effectiveScheme,
      preference,
      setPreference,
    }),
    [effectiveScheme, preference],
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}
