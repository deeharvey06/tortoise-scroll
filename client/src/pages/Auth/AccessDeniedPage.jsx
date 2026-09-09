import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import AuthLayout from '../../components/auth/AuthLayout';
import useAuthStore from '../../store/useAuthStore';

export default function AccessDeniedPage() {
  const restoreAuthenticatedState = () => {
    const { user, setAuthenticatedUser } = useAuthStore.getState();
    if (user) setAuthenticatedUser(user);
  };
  return <AuthLayout title='Access denied' subtitle='Your account does not have permission to open this area.'><Button component={RouterLink} to='/' onClick={restoreAuthenticatedState} variant='contained'>Return to dashboard</Button></AuthLayout>;
}
