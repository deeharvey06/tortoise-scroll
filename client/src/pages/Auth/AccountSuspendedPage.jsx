import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import AuthLayout from '../../components/auth/AuthLayout';

export default function AccountSuspendedPage() {
  return <AuthLayout title='Account unavailable' subtitle='This account is suspended or disabled and cannot access the application.'><Button component={RouterLink} to='/login' variant='outlined'>Return to sign in</Button></AuthLayout>;
}
