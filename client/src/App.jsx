import { useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import { createTortoiseTheme } from './theme/theme';
import useUIStore from './store/useUIStore';
import router from './router';

export default function App() {
  const themeMode = useUIStore((state) => state.themeMode);
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const resolvedMode = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;
  const theme = useMemo(() => createTortoiseTheme(resolvedMode), [resolvedMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
