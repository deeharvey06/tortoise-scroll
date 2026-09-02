import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import authService from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';
import { Panel } from '../../components/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await authService.login(email, password);
      setAuthenticatedUser(data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.error?.message || 'Invalid username or password',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--ts-accent-primary) 14%, transparent), transparent 38%)',
        p: 3,
      }}
    >
      <Panel sx={{ width: '100%', maxWidth: 420 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant='h4' fontWeight={700} sx={{ mb: 1 }}>
              Tortoise Scroll
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Your permanent record of patience, process, and progress.
            </Typography>
          </Box>

          {error && <Alert severity='error'>{error}</Alert>}

          <Box component='form' onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label='Email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                label='Password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
              <Button
                type='submit'
                variant='contained'
                disabled={loading}
                fullWidth
              >
                {loading ? 'Signing in...' : 'Log in'}
              </Button>
            </Stack>
          </Box>

          <Typography variant='caption' color='text.secondary'>
            by Tortoise Trader
            <br />
            <br />
            Sign in with your registered email address.
          </Typography>
        </Stack>
      </Panel>
    </Box>
  );
}
