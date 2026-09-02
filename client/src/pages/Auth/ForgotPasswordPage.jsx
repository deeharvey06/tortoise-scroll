import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import AuthLayout from '../../components/auth/AuthLayout';
import authService from '../../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResult(await authService.forgotPassword(email));
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Unable to create a reset request',
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout
      title='Password recovery'
      subtitle='Create a secure, expiring password-reset request.'
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
      {result ? (
        <>
          <Alert severity='success'>{result.message}</Alert>
          {!result.deliveryConfigured && !result.developmentResetToken && (
            <Alert severity='info'>
              Email delivery is not configured on this server. Contact the
              server administrator.
            </Alert>
          )}
          {result.developmentResetToken && (
            <Button
              component={RouterLink}
              to={`/reset-password?token=${encodeURIComponent(result.developmentResetToken)}`}
              variant='contained'
            >
              Open development reset link
            </Button>
          )}
        </>
      ) : (
        <Stack component='form' onSubmit={submit} spacing={2}>
          <TextField
            label='Email'
            type='email'
            autoComplete='email'
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
          <Button type='submit' variant='contained' disabled={loading}>
            {loading ? 'Creating request…' : 'Request password reset'}
          </Button>
        </Stack>
      )}
    </AuthLayout>
  );
}
