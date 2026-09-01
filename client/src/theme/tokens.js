export const spacingTokens = Object.freeze({ 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 });

export const radiusTokens = Object.freeze({ xs: 4, sm: 6, md: 8, lg: 10, round: 999 });

export const typographyTokens = Object.freeze({
  fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  numericFontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  sizes: {
    caption: '0.6875rem', labelSmall: '0.75rem', bodySmall: '0.8125rem', body: '0.875rem',
    bodyLarge: '0.9375rem', panelHeading: '0.9375rem', sectionHeading: '1.125rem',
    pageHeading: '1.5rem', metric: '1.25rem', metricLarge: '1.625rem',
  },
});

export const transitionTokens = Object.freeze({
  instant: 80, fast: 120, standard: 180, slow: 240, chart: 300,
  easing: { standard: 'cubic-bezier(0.2, 0, 0, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)' },
});

export const zIndexTokens = Object.freeze({ base: 0, sticky: 10, navigation: 20, appBar: 30, popover: 40, modal: 50, toast: 60, tooltip: 70 });

const shared = {
  radius: radiusTokens, spacing: spacingTokens, typography: typographyTokens,
  transitions: transitionTokens, zIndex: zIndexTokens,
  table: {
    rowHeight: { compact: 36, standard: 44, comfortable: 52 },
    headerWeight: 600,
    cellPadding: { compact: '6px 12px', standard: '10px 16px' },
  },
};

const darkColors = {
  background: { canvas: '#111412', sidebar: '#131714' },
  surface: { primary: '#161A18', secondary: '#1D221F', tertiary: '#252B27', sunken: '#101310', hover: '#212721', selected: '#20382A' },
  border: { subtle: '#272D28', default: '#313832', strong: '#465047' },
  text: { primary: '#F1EFE8', secondary: '#AAAFA8', muted: '#777D77', disabled: '#5C625D' },
  brand: { deep: '#102B1F', forest: '#163E2A', jade: '#387A55', jadeSoft: '#6B9B7B', gold: '#9B7738', bronze: '#73562C' },
  financial: {
    positive: '#72AE83', positiveStrong: '#8BC59A', positiveBg: '#17291D', positiveBorder: '#315C3D',
    negative: '#D47773', negativeStrong: '#E38C87', negativeBg: '#2B1B1A', negativeBorder: '#6C3D39',
  },
  status: {
    warning: '#C49A54', warningBg: '#2A2418', warningBorder: '#66522D', info: '#7FA1B2', infoBg: '#18252A',
    infoBorder: '#385764', neutral: '#AAAFA8', neutralBg: '#202420', neutralBorder: '#414841',
  },
  focus: '#85B796', overlay: 'rgba(6, 8, 6, 0.72)',
  chart: {
    primary: '#6B9B7B', secondary: '#9B7738', comparison: '#7FA1B2', positive: '#72AE83',
    negative: '#D47773', neutral: '#8D938D', grid: '#2A302B', axis: '#777D77', reference: '#AAAFA8',
  },
};

const lightColors = {
  background: { canvas: '#F6F3EA', sidebar: '#EFEADF' },
  surface: { primary: '#FFFFFF', secondary: '#EFEBE0', tertiary: '#E7E1D4', sunken: '#F4F1E9', hover: '#F1EEE5', selected: '#E3EDE5', parchment: '#F3EBD9' },
  border: { subtle: '#E7E2D7', default: '#DDD7C9', strong: '#BBB5A8' },
  text: { primary: '#1B1D1A', secondary: '#60645E', muted: '#7A7E77', disabled: '#A3A69F' },
  brand: { deep: '#102B1F', forest: '#163E2A', jade: '#326D4C', jadeSoft: '#D6E4D8', gold: '#87662E', bronze: '#6D522C' },
  financial: {
    positive: '#25613E', positiveStrong: '#194C2E', positiveBg: '#E3F0E6', positiveBorder: '#A9CDB2',
    negative: '#9D3F3F', negativeStrong: '#7F2F2F', negativeBg: '#F5E6E3', negativeBorder: '#DBB1AB',
  },
  status: {
    warning: '#805C1F', warningBg: '#F5ECD7', warningBorder: '#DCC494', info: '#315F78', infoBg: '#E4EFF3',
    infoBorder: '#B0CDD7', neutral: '#60645E', neutralBg: '#EFEEE9', neutralBorder: '#D1CEC5',
  },
  focus: '#276844', overlay: 'rgba(20, 22, 19, 0.42)',
  chart: {
    primary: '#326D4C', secondary: '#87662E', comparison: '#315F78', positive: '#25613E',
    negative: '#9D3F3F', neutral: '#6F746D', grid: '#E2DDD2', axis: '#73776F', reference: '#60645E',
  },
};

const shadows = {
  dark: { none: 'none', sm: '0 2px 8px rgba(0, 0, 0, 0.18)', md: '0 8px 24px rgba(0, 0, 0, 0.24)', lg: '0 18px 48px rgba(0, 0, 0, 0.32)' },
  light: { none: 'none', sm: '0 2px 8px rgba(34, 31, 24, 0.08)', md: '0 10px 28px rgba(34, 31, 24, 0.12)', lg: '0 20px 52px rgba(34, 31, 24, 0.16)' },
};

export const darkTokens = Object.freeze({ ...shared, mode: 'dark', colors: darkColors, shadows: shadows.dark });
export const lightTokens = Object.freeze({ ...shared, mode: 'light', colors: lightColors, shadows: shadows.light });
export function getDesignTokens(mode) { return mode === 'light' ? lightTokens : darkTokens; }
