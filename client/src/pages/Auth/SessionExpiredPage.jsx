import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import AuthLayout from '../../components/auth/AuthLayout';

export default function SessionExpiredPage() {
  return <AuthLayout title='Session expired' subtitle='Your secure session ended. Sign in again to continue.'><Button component={RouterLink} to='/login' variant='contained'>Sign in again</Button></AuthLayout>;
}
