import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import AuthLayout from '../../components/auth/AuthLayout';
import authService from '../../services/authService';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!token) return setError('Reset token is missing');
    if (form.password.length < 12)
      return setError('Password must be at least 12 characters');
    if (form.password !== form.confirm)
      return setError('Passwords do not match');
    setLoading(true);
    try {
      await authService.resetPassword(token, form.password);
      setComplete(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout
      title='Reset password'
      subtitle='This link is single-use and expires.'
      footer={
        <Link component={RouterLink} to='/login'>
          Return to sign in
        </Link>
      }
    >
      {error && (
        <Alert severity='error' role='alert'>
          {error}
        </Alert>
      )}
      {complete ? (
        <>
          <Alert severity='success'>
            Password reset. All existing sessions were signed out.
          </Alert>
          <Button component={RouterLink} to='/login' variant='contained'>
            Sign in
          </Button>
        </>
      ) : (
        <Stack component='form' onSubmit={submit} spacing={2}>
          <TextField
            label='New password'
            type='password'
            autoComplete='new-password'
            value={form.password}
            onChange={(event) =>
              setForm((value) => ({ ...value, password: event.target.value }))
            }
            required
            helperText='Use at least 12 characters.'
          />
          <TextField
            label='Confirm new password'
            type='password'
            autoComplete='new-password'
            value={form.confirm}
            onChange={(event) =>
              setForm((value) => ({ ...value, confirm: event.target.value }))
            }
            required
          />
          <Button type='submit' variant='contained' disabled={loading}>
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>
        </Stack>
      )}
    </AuthLayout>
  );
}
