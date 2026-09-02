import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import AuthLayout from '../../components/auth/AuthLayout';
import authService from '../../services/authService';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  const validate = () => {
    const next = {};
    if (!form.displayName.trim()) next.displayName = 'Display name is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (form.password.length < 12) next.password = 'Password must be at least 12 characters';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match';
    setErrors(next); return Object.keys(next).length === 0;
  };
  const submit = async (event) => {
    event.preventDefault(); setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.register({ displayName: form.displayName.trim(), email: form.email.trim(), password: form.password });
      navigate('/login', { replace: true, state: { registrationComplete: true } });
    } catch (error) { setServerError(error?.response?.data?.error?.message || 'Registration could not be completed'); }
    finally { setLoading(false); }
  };
  return (
    <AuthLayout title='Create your account' subtitle='Begin a private record of your trading process.' footer={<>Already registered? <Link component={RouterLink} to='/login'>Sign in</Link></>}>
      {serverError && <Alert severity='error' role='alert'>{serverError}</Alert>}
      <Stack component='form' onSubmit={submit} spacing={2} noValidate>
        <TextField label='Display name' autoComplete='name' value={form.displayName} onChange={update('displayName')} error={Boolean(errors.displayName)} helperText={errors.displayName} required />
        <TextField label='Email' type='email' autoComplete='email' value={form.email} onChange={update('email')} error={Boolean(errors.email)} helperText={errors.email} required />
        <TextField label='Password' type='password' autoComplete='new-password' value={form.password} onChange={update('password')} error={Boolean(errors.password)} helperText={errors.password || 'Use at least 12 characters.'} required />
        <TextField label='Confirm password' type='password' autoComplete='new-password' value={form.confirmPassword} onChange={update('confirmPassword')} error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword} required />
        <Button type='submit' variant='contained' size='large' disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button>
      </Stack>
    </AuthLayout>
  );
}
