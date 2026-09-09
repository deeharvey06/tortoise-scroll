import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createTortoiseTheme } from '../../theme/theme';
import useAuthStore from '../../store/useAuthStore';
import * as securityApi from '../../services/accountSecurityService';
import authService from '../../services/authService';
import AccountSecurityPage from './AccountSecurityPage';
import ForgotPasswordPage from '../Auth/ForgotPasswordPage';
import ResetPasswordPage from '../Auth/ResetPasswordPage';

vi.mock('../../services/accountSecurityService', () => ({
  fetchSessions: vi.fn(),
  changePassword: vi.fn(),
  revokeSession: vi.fn(),
  logoutOtherSessions: vi.fn(),
}));
vi.mock('../../services/authService', () => ({
  default: { forgotPassword: vi.fn(), resetPassword: vi.fn() },
}));
const user = {
  id: 'user-1',
  displayName: 'Test Trader',
  email: 'trader@example.test',
  role: 'USER',
  status: 'ACTIVE',
};
const renderPage = (node, path = '/') =>
  render(
    <ThemeProvider theme={createTortoiseTheme('light')}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </ThemeProvider>,
  );

describe('Phase 5 account and session security UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'AUTHENTICATED', user });
    securityApi.fetchSessions.mockResolvedValue({
      sessions: [
        {
          id: 'current',
          current: true,
          userAgent: 'Current browser',
          ipAddress: '127.0.0.1',
          lastSeenAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10000).toISOString(),
        },
        {
          id: 'other',
          current: false,
          userAgent: 'Other browser',
          ipAddress: '127.0.0.2',
          lastSeenAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10000).toISOString(),
        },
      ],
    });
  });

  it('renders account details, active sessions, and password controls', async () => {
    renderPage(<AccountSecurityPage />);
    expect(
      screen.getByRole('heading', { name: 'Account & security' }),
    ).toBeVisible();
    expect(await screen.findByText('Current browser')).toBeVisible();
    expect(screen.getByText('Other browser')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeVisible();
  });

  it('submits a password change and reports revoked sessions', async () => {
    securityApi.changePassword.mockResolvedValue({
      user,
      otherSessionsRevoked: 1,
    });
    renderPage(<AccountSecurityPage />);
    await screen.findByText('Current browser');
    fireEvent.change(screen.getByLabelText(/^Current password/), {
      target: { value: 'original-password-123' },
    });
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'new-password-value-123' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
      target: { value: 'new-password-value-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(securityApi.changePassword).toHaveBeenCalledWith(
        'original-password-123',
        'new-password-value-123',
      ),
    );
    expect(await screen.findByText(/1 other session/)).toBeVisible();
  });

  it('creates a development reset request without claiming email delivery', async () => {
    authService.forgotPassword.mockResolvedValue({
      message: 'Request created',
      deliveryConfigured: false,
      developmentResetToken: 'token-value',
    });
    renderPage(<ForgotPasswordPage />, '/forgot-password');
    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: user.email },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Request password reset' }),
    );
    expect(
      await screen.findByRole('link', { name: 'Open development reset link' }),
    ).toHaveAttribute('href', '/reset-password?token=token-value');
  });

  it('submits a reset token and confirms all sessions were signed out', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'Password reset' });
    renderPage(
      <ResetPasswordPage />,
      '/reset-password?token=valid-token-value-that-is-long-enough',
    );
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'reset-password-value-123' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
      target: { value: 'reset-password-value-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() => expect(authService.resetPassword).toHaveBeenCalled());
    expect(
      await screen.findByText(/All existing sessions were signed out/),
    ).toBeVisible();
  });
});
