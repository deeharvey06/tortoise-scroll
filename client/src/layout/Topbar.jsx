import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import { checkHealth } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import GlobalFilterBar from '../components/GlobalFilterBar';
import ThemeModeSelector from '../components/ThemeModeSelector';
import { getRouteTitle } from './navigation';

export default function Topbar({ mobile = false, onOpenNavigation }) {
  const [status, setStatus] = useState('checking');
  const { user, clearSession } = useAuthStore();
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then(() => !cancelled && setStatus('online'))
      .catch(() => !cancelled && setStatus('offline'));
    return () => { cancelled = true; };
  }, []);

  const statusLabel = status === 'online' ? 'API connected' : status === 'offline' ? 'API unreachable' : 'Checking API';

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky', top: 0, zIndex: 'appBar', bgcolor: 'background.default',
        borderBottom: '1px solid', borderColor: 'divider',
      }}
    >
      <Box sx={{ minHeight: 52, px: { xs: 4, sm: 5, lg: 6 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          {mobile && (
            <IconButton edge="start" size="small" aria-label="Open navigation" onClick={onOpenNavigation}>
              <MenuIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.1 }}>Workspace</Typography>
            <Typography variant="body2" sx={{ fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getRouteTitle(pathname)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexShrink: 0 }}>
          <Tooltip title={statusLabel}>
            <Chip
              size="small"
              label={mobile ? '' : statusLabel}
              color={status === 'online' ? 'success' : status === 'offline' ? 'error' : 'default'}
              variant="outlined"
              sx={{
                minWidth: mobile ? 24 : undefined,
                '& .MuiChip-label': { display: mobile ? 'none' : 'block' },
                '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor', ml: mobile ? 0 : 2 },
              }}
            />
          </Tooltip>
          <ThemeModeSelector />
          {!mobile && <Typography variant="caption" color="text.secondary">{user?.displayName || 'Guest'}</Typography>}
          {user && (mobile ? (
            <Tooltip title="Log out"><IconButton size="small" aria-label="Log out" onClick={clearSession}><LogoutIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
          ) : (
            <Button size="small" color="inherit" startIcon={<LogoutIcon fontSize="small" />} onClick={clearSession}>Log out</Button>
          ))}
        </Box>
      </Box>
      <Box sx={{ px: { xs: 4, sm: 5, lg: 6 }, py: 2, borderTop: '1px solid', borderColor: 'var(--ts-border-subtle)', overflow: 'hidden' }}>
        <GlobalFilterBar compact={mobile} />
      </Box>
    </Box>
  );
}
