export const routes = Object.freeze({
  dashboard: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  accessDenied: '/403',
  sessionExpired: '/session-expired',
  accountSuspended: '/account-suspended',
  networkError: '/network-error',
  trades: '/trades',
  accounts: '/accounts',
  tradeDetail: '/trades/:id',
  calendar: '/calendar',
  journal: '/journal',
  knowledge: '/knowledge',
  strategies: '/strategies',
  playbooks: '/playbooks',
  reports: '/reports',
  analytics: '/analytics',
  replay: '/replay',
  backtesting: '/backtesting',
  aiPartner: '/ai-partner',
  risk: '/risk',
  import: '/import',
  settings: '/settings',
  security: '/security',
  administration: '/administration',
});

export const tradePath = (id) => `${routes.trades}/${encodeURIComponent(id)}`;

export function knowledgePath(params) {
  return `${routes.knowledge}?${new URLSearchParams(params)}`;
}

export const resetPasswordPath = (token) =>
  `${routes.resetPassword}?${new URLSearchParams({ token })}`;
