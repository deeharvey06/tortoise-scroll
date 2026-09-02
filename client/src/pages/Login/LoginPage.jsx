import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';

import authService from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';
import AuthLayout from '../../components/auth/AuthLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.error?.message || 'Unable to sign in. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title='Welcome back' subtitle='Continue your permanent record of patience, process, and progress.' footer={<>New to Tortoise Scroll? <Link component={RouterLink} to='/register'>Create an account</Link></>}>
          {location.state?.registrationComplete && <Alert severity='success'>Account created. You can now sign in.</Alert>}
          {error && <Alert severity='error' role='alert'>{error}</Alert>}
          <Stack component='form' onSubmit={handleSubmit} noValidate spacing={2}>
            <Stack spacing={2}>
              <TextField
                label='Email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoFocus
                autoComplete='email'
                required
              />
              <TextField
                label='Password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete='current-password'
                required
              />
              <Link component={RouterLink} to='/forgot-password' alignSelf='flex-end' variant='body2'>Forgot password?</Link>
              <Button
                type='submit'
                variant='contained'
                disabled={loading}
                fullWidth
              >
                {loading ? 'Signing in...' : 'Log in'}
              </Button>
            </Stack>
          </Stack>
    </AuthLayout>
  );
}
