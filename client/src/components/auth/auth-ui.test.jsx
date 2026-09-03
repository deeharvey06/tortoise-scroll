import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import authService from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';
import { createTortoiseTheme } from '../../theme/theme';
import LoginPage from '../../pages/Login/LoginPage';
import RegisterPage from '../../pages/Auth/RegisterPage';
import AccessDeniedPage from '../../pages/Auth/AccessDeniedPage';
import SessionExpiredPage from '../../pages/Auth/SessionExpiredPage';
import AccountSuspendedPage from '../../pages/Auth/AccountSuspendedPage';
import CurrentUserMenu from './CurrentUserMenu';
import {
  AdminRoute,
  AuthLoadingState,
  ProtectedRoute,
  RootRoute,
} from './RouteGuards';

vi.mock('../../services/authService', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));
const user = {
  id: '1',
  email: 'user@example.com',
  displayName: 'Test User',
  role: 'USER',
  status: 'ACTIVE',
};
const renderAt = (node, { path = '/', mode = 'light' } = {}) =>
  render(
    <ThemeProvider theme={createTortoiseTheme(mode)}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </ThemeProvider>,
  );

describe('Phase 2 authentication UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'UNAUTHENTICATED', user: null });
  });

  it.each(['light', 'dark'])('renders Sign In in %s theme', (mode) => {
    renderAt(<LoginPage />, { path: '/login', mode });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.getByLabelText(/^Email/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toBeVisible();
  });

  it.each(['light', 'dark'])(
    'renders Register in %s theme without privilege controls',
    (mode) => {
      renderAt(<RegisterPage />, { path: '/register', mode });
      expect(screen.getByLabelText(/^Display name/)).toBeVisible();
      expect(
        screen.queryByLabelText(/role|admin|root|status/i),
      ).not.toBeInTheDocument();
    },
  );

  it('validates registration fields and password confirmation', () => {
    renderAt(<RegisterPage />, { path: '/register' });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm password/), {
      target: { value: 'different-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Display name is required')).toBeVisible();
    expect(screen.getByText('Enter a valid email address')).toBeVisible();
    expect(screen.getByText('Passwords do not match')).toBeVisible();
  });

  it('displays server registration errors', async () => {
    authService.register.mockRejectedValue({
      response: {
        data: {
          error: { message: 'An account with that email already exists' },
        },
      },
    });
    renderAt(<RegisterPage />, { path: '/register' });
    fireEvent.change(screen.getByLabelText(/^Display name/), {
      target: { value: 'Trader' },
    });
    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: 'trader@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm password/), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'already exists',
    );
  });

  it('redirects unauthenticated users away from ProtectedRoute', () => {
    renderAt(
      <Routes>
        <Route path='/login' element={<div>Sign in destination</div>} />
        <Route
          path='/private'
          element={
            <ProtectedRoute>
              <div>Private</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { path: '/private' },
    );
    expect(screen.getByText('Sign in destination')).toBeVisible();
  });

  it.each(['USER', 'ADMIN', 'ROOT'])(
    'allows authenticated %s through ProtectedRoute',
    (role) => {
      useAuthStore.setState({
        status: 'AUTHENTICATED',
        user: { ...user, role },
      });
      renderAt(
        <ProtectedRoute>
          <div>Private content</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('Private content')).toBeVisible();
    },
  );

  it.each([
    ['USER', '/admin', 'AdminRoute'],
    ['USER', '/root', 'RootRoute'],
    ['ADMIN', '/root', 'RootRoute'],
  ])('denies %s access through %s', (role, path, guard) => {
    useAuthStore.setState({ status: 'AUTHENTICATED', user: { ...user, role } });
    const Gate = guard === 'AdminRoute' ? AdminRoute : RootRoute;
    renderAt(
      <Routes>
        <Route path='/403' element={<div>Denied</div>} />
        <Route
          path={path}
          element={
            <Gate>
              <div>Allowed</div>
            </Gate>
          }
        />
      </Routes>,
      { path },
    );
    expect(screen.getByText('Denied')).toBeVisible();
  });

  it.each([
    ['ADMIN', AdminRoute],
    ['ROOT', AdminRoute],
    ['ROOT', RootRoute],
  ])('allows %s through its authorized route', (role, Gate) => {
    useAuthStore.setState({ status: 'AUTHENTICATED', user: { ...user, role } });
    renderAt(
      <Gate>
        <div>Allowed</div>
      </Gate>,
    );
    expect(screen.getByText('Allowed')).toBeVisible();
  });

  it.each([
    ['NETWORK_ERROR', '/network-error', 'Network error destination'],
    ['ACCOUNT_SUSPENDED', '/account-suspended', 'Suspended destination'],
    ['SESSION_EXPIRED', '/session-expired', 'Expired destination'],
    ['FORBIDDEN', '/403', 'Forbidden destination'],
  ])(
    'routes %s authentication state to its dedicated page',
    (status, destination, label) => {
      useAuthStore.setState({ status, user: null });
      renderAt(
        <Routes>
          <Route
            path='/private'
            element={
              <ProtectedRoute>
                <div>Private</div>
              </ProtectedRoute>
            }
          />
          <Route path={destination} element={<div>{label}</div>} />
        </Routes>,
        { path: '/private' },
      );
      expect(screen.getByText(label)).toBeVisible();
    },
  );

  it('shows current user data and signs out from the account menu', async () => {
    useAuthStore.setState({ status: 'AUTHENTICATED', user });
    authService.logout.mockResolvedValue();
    renderAt(<CurrentUserMenu />);
    fireEvent.click(screen.getByLabelText('Open account menu'));
    expect(screen.getByText(user.email)).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(authService.logout).toHaveBeenCalled());
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
  });

  it('renders access, session, suspended, and loading states', () => {
    const { rerender } = renderAt(<AccessDeniedPage />);
    expect(
      screen.getByRole('heading', { name: 'Access denied' }),
    ).toBeVisible();
    rerender(
      <ThemeProvider theme={createTortoiseTheme('light')}>
        <MemoryRouter>
          <SessionExpiredPage />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Session expired' }),
    ).toBeVisible();
    rerender(
      <ThemeProvider theme={createTortoiseTheme('light')}>
        <MemoryRouter>
          <AccountSuspendedPage />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Account unavailable' }),
    ).toBeVisible();
    rerender(
      <ThemeProvider theme={createTortoiseTheme('light')}>
        <MemoryRouter>
          <AuthLoadingState />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toBeVisible();
  });
});
