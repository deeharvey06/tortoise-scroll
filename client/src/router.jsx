import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AppShell from '@/layout/AppShell';
import { ErrorFallback, PageErrorBoundary } from '@/components/ErrorBoundary';
import useAuthStore from '@/store/useAuthStore';
import {
  AdminRoute,
  RootRoute,
  AuthLoadingState,
  ProtectedRoute,
} from '@/components/auth/RouteGuards';

import { routes } from '@/config/routes';

const LoginPage = lazy(() => import('@/pages/Login/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/Auth/RegisterPage'));
const ForgotPasswordPage = lazy(
  () => import('@/pages/Auth/ForgotPasswordPage')
);

const ResetPasswordPage = lazy(() => import('@/pages/Auth/ResetPasswordPage'));
const AccessDeniedPage = lazy(() => import('@/pages/Auth/AccessDeniedPage'));
const SessionExpiredPage = lazy(
  () => import('@/pages/Auth/SessionExpiredPage')
);

const AccountSuspendedPage = lazy(
  () => import('@/pages/Auth/AccountSuspendedPage')
);

const NetworkErrorPage = lazy(() => import('@/pages/Auth/NetworkErrorPage'));

// Route-level code splitting: each page (and its dependencies, e.g. the
// Dashboard/Analytics/Backtesting pages all pull in Recharts) loads only
// when its route is visited, instead of bundling every page into the
// initial load. This is the "lazy-loaded pages" requirement from the
// performance spec (section 27) — verify it by checking the Network tab
// on first load vs. navigating to a not-yet-visited page.
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const TradesPage = lazy(() => import('@/pages/Trades/TradesPage'));
const AccountsPage = lazy(() => import('@/pages/Accounts/AccountsPage'));
const TradeDetailPage = lazy(() => import('@/pages/Trades/TradeDetailPage'));
const CalendarPage = lazy(() => import('@/pages/Calendar/CalendarPage'));
const KnowledgePage = lazy(() => import('@/pages/Knowledge/KnowledgePage'));
const JournalPage = lazy(() => import('@/pages/Journal/JournalPage'));
const StrategiesPage = lazy(() => import('@/pages/Strategies/StrategiesPage'));
const PlaybooksPage = lazy(() => import('@/pages/Playbooks/PlaybooksPage'));
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'));
const AnalyticsPage = lazy(() => import('@/pages/Analytics/AnalyticsPage'));
const ReplayPage = lazy(() => import('@/pages/Replay/ReplayPage'));
const BacktestingPage = lazy(
  () => import('@/pages/Backtesting/BacktestingPage')
);

const AiPartnerPage = lazy(() => import('@/pages/AiPartner/AiPartnerPage'));
const RiskPage = lazy(() => import('@/pages/Risk/RiskPage'));
const ImportPage = lazy(() => import('@/pages/Import/ImportPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));
const AdministrationPage = lazy(
  () => import('@/pages/Administration/AdministrationPage')
);

const AccountSecurityPage = lazy(
  () => import('@/pages/Security/AccountSecurityPage')
);

function PageFallback() {
  return (
    <Box
      role='status'
      aria-live='polite'
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minHeight: 180,
        color: 'text.secondary',
      }}
    >
      <CircularProgress size={20} thickness={4} />
      <Box component='span' sx={{ fontSize: 13 }}>
        Opening workspace…
      </Box>
    </Box>
  );
}

function withSuspense(Component) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    </PageErrorBoundary>
  );
}

function PublicOnlyLayout() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === 'INITIALIZING') return <AuthLoadingState />;
  if (status === 'AUTHENTICATED' && user)
    return <Navigate to={routes.dashboard} replace />;

  return <Outlet />;
}

export function createRouter() {
  return createBrowserRouter(
    [
      {
        path: routes.login,
        element: <PublicOnlyLayout />,
        children: [{ index: true, element: withSuspense(LoginPage) }],
      },
      {
        path: routes.register,
        element: <PublicOnlyLayout />,
        children: [{ index: true, element: withSuspense(RegisterPage) }],
      },
      {
        path: routes.forgotPassword,
        element: withSuspense(ForgotPasswordPage),
      },
      { path: routes.resetPassword, element: withSuspense(ResetPasswordPage) },
      { path: routes.accessDenied, element: withSuspense(AccessDeniedPage) },
      {
        path: routes.sessionExpired,
        element: withSuspense(SessionExpiredPage),
      },
      {
        path: routes.accountSuspended,
        element: withSuspense(AccountSuspendedPage),
      },
      { path: routes.networkError, element: withSuspense(NetworkErrorPage) },
      {
        path: routes.dashboard,
        element: (
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: withSuspense(DashboardPage) },
          { path: routes.trades, element: withSuspense(TradesPage) },
          { path: routes.accounts, element: withSuspense(AccountsPage) },
          { path: routes.tradeDetail, element: withSuspense(TradeDetailPage) },
          { path: routes.calendar, element: withSuspense(CalendarPage) },
          { path: routes.journal, element: withSuspense(JournalPage) },
          {
            path: routes.knowledge,
            element: <RootRoute>{withSuspense(KnowledgePage)}</RootRoute>,
          },
          { path: routes.strategies, element: withSuspense(StrategiesPage) },
          { path: routes.playbooks, element: withSuspense(PlaybooksPage) },
          { path: routes.reports, element: withSuspense(ReportsPage) },
          { path: routes.analytics, element: withSuspense(AnalyticsPage) },
          { path: routes.replay, element: withSuspense(ReplayPage) },
          { path: routes.backtesting, element: withSuspense(BacktestingPage) },
          { path: routes.aiPartner, element: withSuspense(AiPartnerPage) },
          { path: routes.risk, element: withSuspense(RiskPage) },
          { path: routes.import, element: withSuspense(ImportPage) },
          { path: routes.settings, element: withSuspense(SettingsPage) },
          { path: routes.security, element: withSuspense(AccountSecurityPage) },
          {
            path: routes.administration,
            element: (
              <AdminRoute>{withSuspense(AdministrationPage)}</AdminRoute>
            ),
          },
        ],
      },
    ].map((route) => ({ ...route, errorElement: <ErrorFallback /> }))
  );
}

export const router = createRouter();

export default router;
