import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import {
  ConfirmationDialog,
  EmptyState,
  LoadingState,
  Panel,
} from '../../components/ui';
import useAuthStore from '../../store/useAuthStore';
import * as adminApi from '../../services/adminService';

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Never';
const errorMessage = (error) =>
  error.response?.data?.error?.message || error.message || 'Request failed';

function UsersTab({ isRoot }) {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const data = await adminApi.fetchUsers({
          page,
          limit: 25,
          search: search || undefined,
        });
        setUsers(data.users);
        setPagination(data.pagination);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [search],
  );
  useEffect(() => {
    load(1);
  }, [load]);

  const apply = async () => {
    setSaving(true);
    setError('');
    try {
      if (pending.kind === 'role')
        await adminApi.changeUserRole(pending.user.id, pending.value);
      else await adminApi.changeUserStatus(pending.user.id, pending.value);
      setPending(null);
      await load(pagination.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Panel padding={0}>
        <Box
          sx={{
            p: 3,
            display: 'flex',
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <TextField
            size='small'
            label='Search users'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && load(1)}
            sx={{ maxWidth: 360, flex: 1 }}
          />
          <Button variant='outlined' onClick={() => load(1)}>
            Search
          </Button>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ ml: { sm: 'auto' } }}
          >
            {pagination.total} users
          </Typography>
        </Box>
        {error && (
          <Alert severity='error' sx={{ mx: 3, mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <LoadingState label='Loading users' />
        ) : users.length === 0 ? (
          <EmptyState
            title='No users found'
            description='Try a different search.'
          />
        ) : (
          <TableContainer>
            <Table size='small' aria-label='Users'>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last login</TableCell>
                  <TableCell align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography variant='body2' fontWeight={650}>
                        {user.displayName}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        label={user.role}
                        color={
                          user.role === 'ROOT'
                            ? 'secondary'
                            : user.role === 'ADMIN'
                              ? 'primary'
                              : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        variant='outlined'
                        label={user.status}
                        color={user.status === 'ACTIVE' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                    <TableCell align='right'>
                      {isRoot && user.role !== 'ROOT' ? (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 1,
                          }}
                        >
                          <TextField
                            select
                            size='small'
                            aria-label={`Role for ${user.displayName}`}
                            value={user.role}
                            onChange={(event) =>
                              setPending({
                                kind: 'role',
                                value: event.target.value,
                                user,
                              })
                            }
                            sx={{ minWidth: 105 }}
                          >
                            <MenuItem value='USER'>USER</MenuItem>
                            <MenuItem value='ADMIN'>ADMIN</MenuItem>
                          </TextField>
                          <Button
                            size='small'
                            color={
                              user.status === 'ACTIVE' ? 'warning' : 'success'
                            }
                            onClick={() =>
                              setPending({
                                kind: 'status',
                                value:
                                  user.status === 'ACTIVE'
                                    ? 'SUSPENDED'
                                    : 'ACTIVE',
                                user,
                              })
                            }
                          >
                            {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant='caption' color='text.secondary'>
                          Read only
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {pagination.pages > 1 && (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={pagination.pages}
              page={pagination.page}
              onChange={(_event, page) => load(page)}
            />
          </Box>
        )}
      </Panel>
      <ConfirmationDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={apply}
        loading={saving}
        tone={
          pending?.kind === 'status' && pending?.value === 'SUSPENDED'
            ? 'danger'
            : 'primary'
        }
        title={
          pending?.kind === 'role'
            ? 'Change user role?'
            : pending?.value === 'SUSPENDED'
              ? 'Suspend this user?'
              : 'Activate this user?'
        }
        description={
          pending
            ? `${pending.user.displayName} (${pending.user.email}) will be changed to ${pending.value}. This action is recorded in the audit log.`
            : ''
        }
        confirmLabel='Confirm change'
      />
    </>
  );
}

function AuditLogTab() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.fetchAuditLog({ page, limit: 25 });
      setEvents(data.events);
      setPagination(data.pagination);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load(1);
  }, [load]);
  return (
    <Panel padding={0}>
      {error && (
        <Alert severity='error' sx={{ m: 3 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <LoadingState label='Loading audit log' />
      ) : events.length === 0 ? (
        <EmptyState
          title='No administrative changes'
          description='Role and account-status changes will appear here.'
        />
      ) : (
        <TableContainer>
          <Table size='small' aria-label='Audit log'>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event._id} hover>
                  <TableCell>{formatDate(event.createdAt)}</TableCell>
                  <TableCell>
                    {event.actorUserId?.displayName || 'Unknown'}
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      display='block'
                    >
                      {event.actorUserId?.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{event.action.replaceAll('_', ' ')}</TableCell>
                  <TableCell>
                    {event.targetUserId?.displayName || 'Unknown'}
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      display='block'
                    >
                      {event.targetUserId?.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='caption'>
                      {JSON.stringify(event.before)} →{' '}
                      {JSON.stringify(event.after)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {pagination.pages > 1 && (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={pagination.pages}
            page={pagination.page}
            onChange={(_event, page) => load(page)}
          />
        </Box>
      )}
    </Panel>
  );
}

export default function AdministrationPage() {
  const user = useAuthStore((state) => state.user);
  const isRoot = user?.role === 'ROOT';
  const [tab, setTab] = useState('users');
  return (
    <Box>
      <PageHeader
        eyebrow='System'
        title='Administration'
        description={
          isRoot
            ? 'Manage user access and review privileged changes.'
            : 'View the user directory. Account and role changes require ROOT access.'
        }
      />
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        sx={{ mb: 3 }}
      >
        <Tab value='users' label='Users' />
        {isRoot && <Tab value='audit' label='Audit log' />}
      </Tabs>
      {tab === 'users' ? <UsersTab isRoot={isRoot} /> : <AuditLogTab />}
    </Box>
  );
}
