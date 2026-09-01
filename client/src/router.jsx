import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AppLayout from './layout/AppLayout';
import useAuthStore from './store/useAuthStore';

const LoginPage = lazy(() => import('./pages/Login/LoginPage'));

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
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress size={28} />
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

function ProtectedLayout() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to='/login' replace />;
  return <AppLayout />;
}

function PublicOnlyLayout() {
  const user = useAuthStore((state) => state.user);
  if (user) return <Navigate to='/' replace />;
  return <Outlet />;
}

export function createRouter() {
  return createBrowserRouter([
    {
      path: '/login',
      element: (
        <PublicOnlyLayout>
          <Outlet />
        </PublicOnlyLayout>
      ),
      children: [{ index: true, element: withSuspense(LoginPage) }],
    },
    {
      path: '/',
      element: <ProtectedLayout />,
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
      ],
    },
  ]);
}

export const router = createRouter();

export default router;
