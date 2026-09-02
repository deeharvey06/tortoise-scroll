import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import {
  ConfirmationDialog,
  EmptyState,
  LoadingState,
  Panel,
  SectionHeader,
} from '../../components/ui';
import useAuthStore from '../../store/useAuthStore';
import * as securityApi from '../../services/accountSecurityService';

const message = (error) =>
  error.response?.data?.error?.message || error.message || 'Request failed';
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Unknown';

export default function AccountSecurityPage() {
  const user = useAuthStore((state) => state.user);
  const setAuthenticatedUser = useAuthStore(
    (state) => state.setAuthenticatedUser,
  );
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingSession, setPendingSession] = useState(null);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      setSessions((await securityApi.fetchSessions()).sessions);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword.length < 12)
      return setError('New password must be at least 12 characters');
    if (form.newPassword !== form.confirmPassword)
      return setError('Passwords do not match');
    setBusy(true);
    try {
      const data = await securityApi.changePassword(
        form.currentPassword,
        form.newPassword,
      );
      setAuthenticatedUser(data.user);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(
        `Password changed. ${data.otherSessionsRevoked} other session(s) signed out.`,
      );
      await loadSessions();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    setBusy(true);
    setError('');
    try {
      await securityApi.revokeSession(pendingSession.id);
      setPendingSession(null);
      setSuccess('Session revoked.');
      await loadSessions();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  const logoutOthers = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await securityApi.logoutOtherSessions();
      setSuccess(`${data.revoked} other session(s) signed out.`);
      await loadSessions();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <PageHeader
        eyebrow='Account'
        title='Account & security'
        description='Manage your password and signed-in devices.'
      />
      {error && (
        <Alert severity='error' onClose={() => setError('')} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity='success' onClose={() => setSuccess('')} sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      <Stack spacing={4} sx={{ maxWidth: 860 }}>
        <Panel>
          <SectionHeader
            title='Account'
            description='Safe identity information from your authenticated session.'
          />
          <Stack spacing={1}>
            <Typography fontWeight={650}>{user?.displayName}</Typography>
            <Typography variant='body2' color='text.secondary'>
              {user?.email}
            </Typography>
            <Box>
              <Chip size='small' label={user?.role} />
            </Box>
          </Stack>
        </Panel>
        <Panel>
          <SectionHeader
            title='Change password'
            description='Changing your password rotates this session and signs out every other device.'
          />
          <Stack
            component='form'
            onSubmit={changePassword}
            spacing={2}
            sx={{ maxWidth: 460 }}
          >
            <TextField
              label='Current password'
              type='password'
              autoComplete='current-password'
              required
              value={form.currentPassword}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  currentPassword: event.target.value,
                }))
              }
            />
            <TextField
              label='New password'
              type='password'
              autoComplete='new-password'
              required
              value={form.newPassword}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  newPassword: event.target.value,
                }))
              }
              helperText='Use at least 12 characters.'
            />
            <TextField
              label='Confirm new password'
              type='password'
              autoComplete='new-password'
              required
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  confirmPassword: event.target.value,
                }))
              }
            />
            <Button
              type='submit'
              variant='contained'
              disabled={busy}
              sx={{ alignSelf: 'flex-start' }}
            >
              Change password
            </Button>
          </Stack>
        </Panel>
        <Panel>
          <SectionHeader
            title='Active sessions'
            description='Review devices with access to your account.'
            actions={
              <Button
                size='small'
                variant='outlined'
                disabled={
                  busy || sessions.filter((item) => !item.current).length === 0
                }
                onClick={logoutOthers}
              >
                Sign out all other sessions
              </Button>
            }
          />
          {loading ? (
            <LoadingState compact label='Loading active sessions' />
          ) : sessions.length === 0 ? (
            <EmptyState
              title='No active sessions found'
              description='Your current session will appear after refresh.'
            />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {sessions.map((session) => (
                <Box
                  key={session.id}
                  sx={{
                    py: 2,
                    display: 'flex',
                    gap: 2,
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Box>
                    <Stack direction='row' spacing={1} alignItems='center'>
                      <Typography variant='body2' fontWeight={650}>
                        {session.userAgent || 'Unknown device'}
                      </Typography>
                      {session.current && (
                        <Chip size='small' color='primary' label='Current' />
                      )}
                    </Stack>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      display='block'
                    >
                      IP {session.ipAddress || 'Unknown'} · Last active{' '}
                      {formatDate(session.lastSeenAt)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Expires {formatDate(session.expiresAt)}
                    </Typography>
                  </Box>
                  {!session.current && (
                    <Button
                      size='small'
                      color='warning'
                      onClick={() => setPendingSession(session)}
                    >
                      Revoke
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Panel>
      </Stack>
      <ConfirmationDialog
        open={Boolean(pendingSession)}
        title='Revoke this session?'
        description='That device will be signed out and must authenticate again.'
        confirmLabel='Revoke session'
        onClose={() => setPendingSession(null)}
        onConfirm={revoke}
        loading={busy}
      />
    </Box>
  );
}
