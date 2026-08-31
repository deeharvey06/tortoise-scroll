import { createTheme } from '@mui/material/styles';
import { getDesignTokens, radiusTokens, typographyTokens } from './tokens';

// Existing chart pages consume these aliases. CSS variables let them follow
// the active theme without changing page behavior in the foundation phase.
export const palette = Object.freeze({
  background: { default: 'var(--ts-bg-canvas)', paper: 'var(--ts-surface-primary)', elevated: 'var(--ts-surface-secondary)' },
  border: 'var(--ts-border-default)',
  text: { primary: 'var(--ts-text-primary)', secondary: 'var(--ts-text-secondary)', disabled: 'var(--ts-text-disabled)' },
  accent: { main: 'var(--ts-chart-primary)', dim: 'var(--ts-surface-selected)' },
  profit: 'var(--ts-financial-positive)',
  loss: 'var(--ts-financial-negative)',
  neutralAmber: 'var(--ts-status-warning)',
});

function cssVariables(tokens) {
  const { colors } = tokens;
  return {
    '--ts-bg-canvas': colors.background.canvas, '--ts-bg-sidebar': colors.background.sidebar,
    '--ts-surface-primary': colors.surface.primary, '--ts-surface-secondary': colors.surface.secondary,
    '--ts-surface-tertiary': colors.surface.tertiary, '--ts-surface-sunken': colors.surface.sunken,
    '--ts-surface-hover': colors.surface.hover, '--ts-surface-selected': colors.surface.selected,
    '--ts-border-subtle': colors.border.subtle, '--ts-border-default': colors.border.default, '--ts-border-strong': colors.border.strong,
    '--ts-text-primary': colors.text.primary, '--ts-text-secondary': colors.text.secondary,
    '--ts-text-muted': colors.text.muted, '--ts-text-disabled': colors.text.disabled,
    '--ts-brand-deep': colors.brand.deep, '--ts-brand-forest': colors.brand.forest,
    '--ts-brand-jade': colors.brand.jade, '--ts-brand-jade-soft': colors.brand.jadeSoft,
    '--ts-brand-gold': colors.brand.gold, '--ts-brand-bronze': colors.brand.bronze,
    '--ts-financial-positive': colors.financial.positive, '--ts-financial-positive-bg': colors.financial.positiveBg,
    '--ts-financial-negative': colors.financial.negative, '--ts-financial-negative-bg': colors.financial.negativeBg,
    '--ts-status-warning': colors.status.warning, '--ts-status-info': colors.status.info, '--ts-status-neutral': colors.status.neutral,
    '--ts-focus-ring': colors.focus, '--ts-chart-primary': colors.chart.primary, '--ts-chart-secondary': colors.chart.secondary,
    '--ts-chart-comparison': colors.chart.comparison, '--ts-chart-grid': colors.chart.grid, '--ts-chart-axis': colors.chart.axis,
    '--ts-font-ui': typographyTokens.fontFamily, '--ts-font-numeric': typographyTokens.numericFontFamily,
    '--ts-radius-sm': `${radiusTokens.sm}px`, '--ts-radius-md': `${radiusTokens.md}px`,
    '--ts-shadow-sm': tokens.shadows.sm,
    '--ts-transition-fast': `${tokens.transitions.fast}ms ${tokens.transitions.easing.standard}`,
  };
}

export function createTortoiseTheme(mode = 'dark') {
  const tokens = getDesignTokens(mode);
  const { colors } = tokens;
  const shadows = Array(25).fill(tokens.shadows.none);
  shadows[1] = tokens.shadows.sm;
  for (let index = 2; index <= 8; index += 1) shadows[index] = tokens.shadows.md;
  for (let index = 9; index < shadows.length; index += 1) shadows[index] = tokens.shadows.lg;

  return createTheme({
    palette: {
      mode,
      background: { default: colors.background.canvas, paper: colors.surface.primary },
      primary: { main: colors.brand.jade, dark: colors.brand.forest, light: colors.brand.jadeSoft },
      secondary: { main: colors.brand.gold, dark: colors.brand.bronze },
      success: { main: colors.financial.positive, dark: colors.financial.positiveStrong },
      error: { main: colors.financial.negative, dark: colors.financial.negativeStrong },
      warning: { main: colors.status.warning }, info: { main: colors.status.info },
      text: { primary: colors.text.primary, secondary: colors.text.secondary, muted: colors.text.muted, disabled: colors.text.disabled },
      divider: colors.border.default,
      action: { hover: colors.surface.hover, selected: colors.surface.selected, disabled: colors.text.disabled },
    },
    spacing: 4,
    shape: { borderRadius: radiusTokens.sm },
    shadows,
    transitions: {
      duration: {
        shortest: tokens.transitions.instant, shorter: tokens.transitions.fast, short: tokens.transitions.standard,
        standard: tokens.transitions.standard, complex: tokens.transitions.slow,
        enteringScreen: tokens.transitions.slow, leavingScreen: tokens.transitions.standard,
      },
      easing: {
        easeInOut: tokens.transitions.easing.standard, easeOut: tokens.transitions.easing.standard,
        easeIn: tokens.transitions.easing.exit, sharp: tokens.transitions.easing.exit,
      },
    },
    zIndex: {
      mobileStepper: tokens.zIndex.sticky, fab: tokens.zIndex.navigation, speedDial: tokens.zIndex.navigation,
      appBar: tokens.zIndex.appBar, drawer: tokens.zIndex.navigation, modal: tokens.zIndex.modal,
      snackbar: tokens.zIndex.toast, tooltip: tokens.zIndex.tooltip,
    },
    typography: {
      fontFamily: typographyTokens.fontFamily,
      h1: { fontSize: typographyTokens.sizes.pageHeading, lineHeight: 1.33, fontWeight: 650 },
      h2: { fontSize: typographyTokens.sizes.sectionHeading, lineHeight: 1.45, fontWeight: 650 },
      h3: { fontSize: typographyTokens.sizes.sectionHeading, lineHeight: 1.45, fontWeight: 650 },
      h4: { fontSize: typographyTokens.sizes.pageHeading, lineHeight: 1.33, fontWeight: 650 },
      h5: { fontSize: typographyTokens.sizes.sectionHeading, lineHeight: 1.45, fontWeight: 650 },
      h6: { fontSize: typographyTokens.sizes.panelHeading, lineHeight: 1.47, fontWeight: 600 },
      body1: { fontSize: typographyTokens.sizes.body, lineHeight: 1.5 },
      body2: { fontSize: typographyTokens.sizes.bodySmall, lineHeight: 1.46 },
      caption: { fontSize: typographyTokens.sizes.caption, lineHeight: 1.45, fontWeight: 500 },
      button: { fontSize: typographyTokens.sizes.bodySmall, textTransform: 'none', fontWeight: 600 },
    },
    tortoise: tokens,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { ...cssVariables(tokens), colorScheme: mode },
          body: { backgroundColor: colors.background.canvas, color: colors.text.primary },
          '::selection': { backgroundColor: colors.surface.selected, color: colors.text.primary },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important', animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important', scrollBehavior: 'auto !important',
            },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${colors.border.default}` } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 36, borderRadius: radiusTokens.sm, transitionDuration: `${tokens.transitions.fast}ms`, paddingInline: 14 },
          sizeSmall: { minHeight: 32, paddingInline: 10 },
          containedPrimary: { color: mode === 'dark' ? colors.text.primary : '#FFFFFF' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: colors.border.subtle, fontVariantNumeric: 'tabular-nums' },
          head: { backgroundColor: colors.surface.secondary, color: colors.text.secondary, fontWeight: tokens.table.headerWeight },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { color: colors.text.secondary } } },
      MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, color: colors.text.muted } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 40, borderRadius: radiusTokens.sm, backgroundColor: colors.surface.sunken,
            transition: `border-color ${tokens.transitions.fast}ms ${tokens.transitions.easing.standard}`,
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.strong },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.focus, boxShadow: `0 0 0 2px ${colors.surface.selected}` },
          },
          inputSizeSmall: { paddingTop: 9, paddingBottom: 9 },
        },
      },
      MuiSelect: { defaultProps: { MenuProps: { PaperProps: { elevation: 1 } } } },
      MuiCheckbox: {
        styleOverrides: { root: { color: colors.text.muted, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: colors.brand.jade } } },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { '&.Mui-checked': { color: colors.brand.jadeSoft, '& + .MuiSwitch-track': { backgroundColor: colors.brand.jade } } },
          track: { backgroundColor: colors.border.strong },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { minHeight: 24, borderRadius: radiusTokens.sm, fontWeight: 500 },
          sizeSmall: { height: 24, fontSize: typographyTokens.sizes.labelSmall },
          outlined: { borderColor: colors.border.default },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: radiusTokens.lg, boxShadow: tokens.shadows.md } } },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: typographyTokens.sizes.sectionHeading, fontWeight: 650, padding: '20px 24px 12px' } } },
      MuiDialogContent: { styleOverrides: { root: { padding: '16px 24px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none', borderColor: colors.border.default } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: radiusTokens.md, boxShadow: tokens.shadows.sm } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: radiusTokens.sm, fontSize: typographyTokens.sizes.labelSmall } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: radiusTokens.md, border: '1px solid currentColor' }, message: { width: '100%' } } },
      MuiSkeleton: { defaultProps: { animation: 'wave' }, styleOverrides: { root: { borderRadius: radiusTokens.sm, backgroundColor: colors.surface.secondary } } },
    },
  });
}

export const theme = createTortoiseTheme('dark');
export default theme;
