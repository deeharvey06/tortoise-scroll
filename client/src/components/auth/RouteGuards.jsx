import { routes } from '@/config/routes';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import useAuthStore from '@/store/useAuthStore';

export function AuthLoadingState() {
  return (
    <Box
      role='status'
      aria-live='polite'
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Box textAlign='center'>
        <CircularProgress size={26} />
        <Typography color='text.secondary' variant='body2' sx={{ mt: 2 }}>
          Verifying secure session…
        </Typography>
      </Box>
    </Box>
  );
}

function StateBoundary({ children }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  if (status === 'INITIALIZING') return <AuthLoadingState />;
  if (status === 'NETWORK_ERROR')
    return <Navigate to={routes.networkError} replace />;
  if (status === 'ACCOUNT_SUSPENDED')
    return <Navigate to={routes.accountSuspended} replace />;
  if (status === 'SESSION_EXPIRED')
    return <Navigate to={routes.sessionExpired} replace />;
  if (status === 'FORBIDDEN')
    return <Navigate to={routes.accessDenied} replace />;
  if (status !== 'AUTHENTICATED')
    return <Navigate to={routes.login} state={{ from: location }} replace />;
  return children;
}

export function ProtectedRoute({ children }) {
  return <StateBoundary>{children || <Outlet />}</StateBoundary>;
}

function RoleRoute({ roles, children }) {
  const user = useAuthStore((state) => state.user);
  return (
    <StateBoundary>
      {roles.includes(user?.role) ? (
        children || <Outlet />
      ) : (
        <Navigate to={routes.accessDenied} replace />
      )}
    </StateBoundary>
  );
}

export function AdminRoute({ children }) {
  return <RoleRoute roles={['ADMIN', 'ROOT']}>{children}</RoleRoute>;
}
export function RootRoute({ children }) {
  return <RoleRoute roles={['ROOT']}>{children}</RoleRoute>;
}

export default ProtectedRoute;

// Hide restricted embedded tools without redirecting their containing page.
export function RootOnly({ children }) {
  const role = useAuthStore((state) => state.user?.role);
  return role === 'ROOT' ? children : null;
}
