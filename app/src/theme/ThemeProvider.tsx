import { createContext, useContext, type PropsWithChildren } from 'react';

import { theme, type Theme } from '@/theme/tokens';

/**
 * Trivial v1 theme provider: light tokens only.
 * Exists so a dark token set can be wired in later without touching call sites.
 */
const ThemeContext = createContext<Theme>(theme);

export function ThemeProvider({ children }: PropsWithChildren) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
