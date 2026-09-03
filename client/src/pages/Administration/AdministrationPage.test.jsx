import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const renderPage = (mode = 'light') =>
  render(
    <ThemeProvider theme={createTortoiseTheme(mode)}>
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

  it.each(['light', 'dark'])(
    'shows ROOT controls and audit access in %s theme without controls for ROOT',
    async (mode) => {
      useAuthStore.setState({ status: 'AUTHENTICATED', user: { ...users[0] } });
      renderPage(mode);
      expect(await screen.findByText('Regular User')).toBeVisible();
      expect(screen.getByRole('tab', { name: 'Audit log' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Suspend' })).toBeVisible();
      expect(screen.getByLabelText('Role for Regular User')).toBeVisible();
      expect(
        screen.queryByLabelText('Role for Root User'),
      ).not.toBeInTheDocument();
    },
  );

  it.each(['light', 'dark'])(
    'keeps ADMIN access read-only and hides audit in %s theme',
    async (mode) => {
      useAuthStore.setState({
        status: 'AUTHENTICATED',
        user: { id: 'admin', role: 'ADMIN', displayName: 'Admin' },
      });
      adminApi.fetchUsers.mockResolvedValue({
        users: [users[1]],
        pagination: { page: 1, pages: 1, total: 1 },
      });
      renderPage(mode);
      expect(await screen.findByText('Regular User')).toBeVisible();
      expect(
        screen.queryByRole('tab', { name: 'Audit log' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Suspend' }),
      ).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Read only')).toBeVisible());
    },
  );

  it('requires confirmation before ROOT suspends a user and refreshes the directory', async () => {
    useAuthStore.setState({ status: 'AUTHENTICATED', user: { ...users[0] } });
    adminApi.changeUserStatus.mockResolvedValue({
      ...users[1],
      status: 'SUSPENDED',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    expect(
      screen.getByRole('dialog', { name: 'Suspend this user?' }),
    ).toBeVisible();
    expect(adminApi.changeUserStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
    await waitFor(() =>
      expect(adminApi.changeUserStatus).toHaveBeenCalledWith(
        'user',
        'SUSPENDED',
      ),
    );
    await waitFor(() => expect(adminApi.fetchUsers).toHaveBeenCalledTimes(2));
  });

  it('loads the ROOT-only audit log tab', async () => {
    useAuthStore.setState({ status: 'AUTHENTICATED', user: { ...users[0] } });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Audit log' }));
    expect(await screen.findByText('No administrative changes')).toBeVisible();
    expect(adminApi.fetchAuditLog).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });
});
