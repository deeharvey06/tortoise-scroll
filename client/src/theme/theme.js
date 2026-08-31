import { createTheme } from '@mui/material/styles';

/*
 * Design direction: a quiet, disciplined trading-terminal look rather than
 * a generic "AI dashboard". Background sits in cool blue-black (not pure
 * black), body copy in a clean grotesque, and all numeric data in a
 * monospaced face so P&L columns and price ladders align visually — the
 * one signature choice this app is built around. Green/red are reserved
 * strictly for profit/loss semantics, never used decoratively elsewhere.
 */

export const palette = {
  background: {
    default: '#0B0E14',
    paper: '#11151D',
    elevated: '#161B26',
  },
  border: '#232936',
  text: {
    primary: '#E6E9F0',
    secondary: '#8B92A3',
    disabled: '#535A6B',
  },
  accent: {
    main: '#4C8DFF', // signal blue — links, active nav, focus
    dim: '#294169',
  },
  profit: '#2FD675',
  loss: '#FF5C6C',
  neutralAmber: '#E8A33D',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: palette.background.default,
      paper: palette.background.paper,
    },
    primary: { main: palette.accent.main },
    success: { main: palette.profit },
    error: { main: palette.loss },
    warning: { main: palette.neutralAmber },
    text: {
      primary: palette.text.primary,
      secondary: palette.text.secondary,
      disabled: palette.text.disabled,
    },
    divider: palette.border,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background.default,
        },
        '::selection': {
          backgroundColor: palette.accent.dim,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${palette.border}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: palette.border,
        },
      },
    },
  },
});

export default theme;
