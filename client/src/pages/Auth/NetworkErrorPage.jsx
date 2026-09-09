import Button from '@mui/material/Button';
import AuthLayout from '../../components/auth/AuthLayout';

export default function NetworkErrorPage() {
  return <AuthLayout title='Connection unavailable' subtitle='Tortoise Scroll could not verify your session.'><Button onClick={() => window.location.reload()} variant='contained'>Try again</Button></AuthLayout>;
}
