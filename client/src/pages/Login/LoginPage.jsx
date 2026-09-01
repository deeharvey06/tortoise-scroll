import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import authService from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await authService.login(username, password);
      setSession(data.user, data.token);
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
        background: 'linear-gradient(135deg, #0f172a 0%, #111827 100%)',
        p: 3,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant='h4' fontWeight={700} sx={{ mb: 1 }}>
                Tortoise Scroll
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Sign in to continue
              </Typography>
            </Box>

            {error && <Alert severity='error'>{error}</Alert>}

            <Box component='form' onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label='Username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
              Demo account: demo / demo123
              <br />
              Root account: root / root123
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
