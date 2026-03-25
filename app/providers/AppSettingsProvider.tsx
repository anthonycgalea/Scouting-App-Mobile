import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

type AppSettingsContextValue = {
  leftHandedMode: boolean;
  setLeftHandedMode: Dispatch<SetStateAction<boolean>>;
};

const LEFT_HANDED_MODE_KEY = 'app_setting_left_handed_mode';

export const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const [leftHandedMode, setLeftHandedModeState] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSetting = async () => {
      try {
        const storedValue = await SecureStore.getItemAsync(LEFT_HANDED_MODE_KEY);

        if (!isMounted || storedValue === null) {
          return;
        }

        setLeftHandedModeState(storedValue === 'true');
      } catch (error) {
        console.warn('Failed to load left-handed mode setting', error);
      }
    };

    void loadSetting();

    return () => {
      isMounted = false;
    };
  }, []);

  const setLeftHandedMode = useCallback((value: SetStateAction<boolean>) => {
    setLeftHandedModeState((previousValue) => {
      const nextValue = typeof value === 'function' ? value(previousValue) : value;

      void SecureStore.setItemAsync(LEFT_HANDED_MODE_KEY, String(nextValue)).catch((error) => {
        console.warn('Failed to save left-handed mode setting', error);
      });

      return nextValue;
    });
  }, []);

  const value = useMemo(
    () => ({
      leftHandedMode,
      setLeftHandedMode,
    }),
    [leftHandedMode, setLeftHandedMode],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}
