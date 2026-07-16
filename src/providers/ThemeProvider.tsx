import { createContext, type ReactNode, useContext } from 'react';

import { theme, type Theme } from '@/lib/theme';

type ThemeContextValue = {
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const DARK_THEME: ThemeContextValue = { theme };

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={DARK_THEME}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider');
  return value;
}
