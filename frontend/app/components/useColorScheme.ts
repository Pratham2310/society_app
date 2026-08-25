import { useColorScheme as useColorSchemeCore } from 'react-native';

// React Native reports null before the OS setting is known, and the web
// shim below always answers 'light'. Narrowing to the two real values
// here keeps every caller — Colors[theme], props[theme] — from having to
// handle an absent theme it can do nothing useful with.
export const useColorScheme = (): 'light' | 'dark' => {
  return useColorSchemeCore() ?? 'light';
};
