import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import AuthLayout from '../../components/auth/AuthLayout';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title='Password recovery' subtitle='Password reset is not available in this release.'>
      <Alert severity='info'>No reset request has been sent. Password recovery requires backend support planned for a later authentication phase.</Alert>
      <Button component={RouterLink} to='/login' variant='contained'>Return to sign in</Button>
    </AuthLayout>
  );
}
