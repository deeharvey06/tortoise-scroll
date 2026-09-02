import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AppShell from './layout/AppShell';
import useAuthStore from './store/useAuthStore';
import PhasePlaceholder from './components/PhasePlaceholder';
import { AdminRoute, AuthLoadingState, ProtectedRoute, RootRoute } from './components/auth/RouteGuards';

const LoginPage = lazy(() => import('./pages/Login/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPasswordPage'));
const AccessDeniedPage = lazy(() => import('./pages/Auth/AccessDeniedPage'));
const SessionExpiredPage = lazy(() => import('./pages/Auth/SessionExpiredPage'));
const AccountSuspendedPage = lazy(() => import('./pages/Auth/AccountSuspendedPage'));
const NetworkErrorPage = lazy(() => import('./pages/Auth/NetworkErrorPage'));

// Route-level code splitting: each page (and its dependencies, e.g. the
// Dashboard/Analytics/Backtesting pages all pull in Recharts) loads only
// when its route is visited, instead of bundling every page into the
// initial load. This is the "lazy-loaded pages" requirement from the
// performance spec (section 27) — verify it by checking the Network tab
// on first load vs. navigating to a not-yet-visited page.
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const TradesPage = lazy(() => import('./pages/Trades/TradesPage'));
const TradeDetailPage = lazy(() => import('./pages/Trades/TradeDetailPage'));
const CalendarPage = lazy(() => import('./pages/Calendar/CalendarPage'));
const JournalPage = lazy(() => import('./pages/Journal/JournalPage'));
const StrategiesPage = lazy(() => import('./pages/Strategies/StrategiesPage'));
const PlaybooksPage = lazy(() => import('./pages/Playbooks/PlaybooksPage'));
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'));
const AnalyticsPage = lazy(() => import('./pages/Analytics/AnalyticsPage'));
const ReplayPage = lazy(() => import('./pages/Replay/ReplayPage'));
const BacktestingPage = lazy(
  () => import('./pages/Backtesting/BacktestingPage'),
);
const AiPartnerPage = lazy(() => import('./pages/AiPartner/AiPartnerPage'));
const RiskPage = lazy(() => import('./pages/Risk/RiskPage'));
const ImportPage = lazy(() => import('./pages/Import/ImportPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));

function PageFallback() {
  return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 180, color: 'text.secondary' }}>
      <CircularProgress size={20} thickness={4} />
      <Box component="span" sx={{ fontSize: 13 }}>Opening workspace…</Box>
    </Box>
  );
}

function withSuspense(Component) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

function PublicOnlyLayout() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  if (status === 'INITIALIZING') return <AuthLoadingState />;
  if (status === 'AUTHENTICATED' && user) return <Navigate to='/' replace />;
  return <Outlet />;
}

export function createRouter() {
  return createBrowserRouter([
    {
      path: '/login',
      element: <PublicOnlyLayout />,
      children: [{ index: true, element: withSuspense(LoginPage) }],
    },
    { path: '/register', element: <PublicOnlyLayout />, children: [{ index: true, element: withSuspense(RegisterPage) }] },
    { path: '/forgot-password', element: withSuspense(ForgotPasswordPage) },
    { path: '/403', element: withSuspense(AccessDeniedPage) },
    { path: '/session-expired', element: withSuspense(SessionExpiredPage) },
    { path: '/account-suspended', element: withSuspense(AccountSuspendedPage) },
    { path: '/network-error', element: withSuspense(NetworkErrorPage) },
    {
      path: '/',
      element: <ProtectedRoute><AppShell /></ProtectedRoute>,
      children: [
        { index: true, element: withSuspense(DashboardPage) },
        { path: 'trades', element: withSuspense(TradesPage) },
        { path: 'trades/:id', element: withSuspense(TradeDetailPage) },
        { path: 'calendar', element: withSuspense(CalendarPage) },
        { path: 'journal', element: withSuspense(JournalPage) },
        { path: 'strategies', element: withSuspense(StrategiesPage) },
        { path: 'playbooks', element: withSuspense(PlaybooksPage) },
        { path: 'reports', element: withSuspense(ReportsPage) },
        { path: 'analytics', element: withSuspense(AnalyticsPage) },
        { path: 'replay', element: withSuspense(ReplayPage) },
        { path: 'backtesting', element: withSuspense(BacktestingPage) },
        { path: 'ai-partner', element: withSuspense(AiPartnerPage) },
        { path: 'risk', element: withSuspense(RiskPage) },
        { path: 'import', element: withSuspense(ImportPage) },
        { path: 'settings', element: withSuspense(SettingsPage) },
        { path: 'administration', element: <AdminRoute><PhasePlaceholder title='Administration' phase='4' description='Administrative APIs and user management are not available yet.' /></AdminRoute> },
        { path: 'root', element: <RootRoute><PhasePlaceholder title='Root administration' phase='4' description='Root administration is intentionally deferred until its backend policy is approved.' /></RootRoute> },
      ],
    },
  ]);
}

export const router = createRouter();

export default router;
