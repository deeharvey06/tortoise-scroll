import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTortoiseTheme } from '../../theme/theme';
import useAuthStore from '../../store/useAuthStore';
import * as adminApi from '../../services/adminService';
import AdministrationPage from './AdministrationPage';

vi.mock('../../services/adminService', () => ({
  fetchUsers: vi.fn(),
  fetchAuditLog: vi.fn(),
  changeUserRole: vi.fn(),
  changeUserStatus: vi.fn(),
}));

const users = [
  {
    id: 'root',
    displayName: 'Root User',
    email: 'root@example.test',
    role: 'ROOT',
    status: 'ACTIVE',
  },
  {
    id: 'user',
    displayName: 'Regular User',
    email: 'user@example.test',
    role: 'USER',
    status: 'ACTIVE',
  },
];
const renderPage = () =>
  render(
    <ThemeProvider theme={createTortoiseTheme('light')}>
      <AdministrationPage />
    </ThemeProvider>,
  );

describe('Phase 4 administration UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.fetchUsers.mockResolvedValue({
      users,
      pagination: { page: 1, pages: 1, total: 2 },
    });
    adminApi.fetchAuditLog.mockResolvedValue({
      events: [],
      pagination: { page: 1, pages: 1, total: 0 },
    });
  });

  it('shows ROOT user controls and audit log access', async () => {
    useAuthStore.setState({ status: 'AUTHENTICATED', user: { ...users[0] } });
    renderPage();
    expect(await screen.findByText('Regular User')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Audit log' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeVisible();
    expect(screen.getByLabelText('Role for Regular User')).toBeVisible();
  });

  it('keeps ADMIN access read-only and hides the audit log', async () => {
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      user: { id: 'admin', role: 'ADMIN', displayName: 'Admin' },
    });
    adminApi.fetchUsers.mockResolvedValue({
      users: [users[1]],
      pagination: { page: 1, pages: 1, total: 1 },
    });
    renderPage();
    expect(await screen.findByText('Regular User')).toBeVisible();
    expect(
      screen.queryByRole('tab', { name: 'Audit log' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Suspend' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Read only')).toBeVisible());
  });
});
