import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ThemeModeSelector from '../../components/ThemeModeSelector';
import { Panel } from '../ui';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: { xs: 2, sm: 4 } }}>
      <Box sx={{ position: 'fixed', top: 16, right: 16 }}><ThemeModeSelector /></Box>
      <Panel component='main' sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Box>
            <Link component={RouterLink} to='/login' underline='none' color='inherit'>
              <Typography variant='overline' color='primary.main' fontWeight={700}>Tortoise Scroll</Typography>
            </Link>
            <Typography component='h1' variant='h4' fontWeight={700} sx={{ mt: 1 }}>{title}</Typography>
            {subtitle && <Typography color='text.secondary' variant='body2' sx={{ mt: 1 }}>{subtitle}</Typography>}
          </Box>
          {children}
          {footer && <Typography variant='body2' color='text.secondary' textAlign='center'>{footer}</Typography>}
        </Stack>
      </Panel>
    </Box>
  );
}
