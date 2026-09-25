import { useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import { createTortoiseTheme } from '@/theme/theme';
import useUIStore from '@/store/useUIStore';

export default function AppThemeProvider({ children }) {
  const mode = useUIStore((state) => state.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', {
    noSsr: true,
  });

  const resolvedMode =
    mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

  const theme = useMemo(
    () => createTortoiseTheme(resolvedMode),
    [resolvedMode]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
