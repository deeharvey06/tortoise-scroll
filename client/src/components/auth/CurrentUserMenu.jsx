import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import authService from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';

export default function CurrentUserMenu() {
  const [anchor, setAnchor] = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const initials = String(user?.displayName || user?.email || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const go = (path) => {
    setAnchor(null);
    navigate(path);
  };
  const logout = async () => {
    setAnchor(null);
    try {
      await authService.logout();
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  };
  return (
    <>
      <Tooltip title='Account menu'>
        <IconButton
          aria-label='Open account menu'
          onClick={(event) => setAnchor(event.currentTarget)}
          size='small'
        >
          <Avatar
            sx={{
              width: 30,
              height: 30,
              fontSize: 12,
              bgcolor: 'primary.main',
            }}
          >
            {initials}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 260 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography fontWeight={650}>{user?.displayName}</Typography>
          <Typography variant='caption' color='text.secondary'>
            {user?.email}
          </Typography>
          <Typography variant='caption' color='primary.main' display='block'>
            {user?.role}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => go('/security')}>
          <ListItemIcon>
            <SettingsOutlined fontSize='small' />
          </ListItemIcon>
          Account & security
        </MenuItem>
        {['ADMIN', 'ROOT'].includes(user?.role) && (
          <MenuItem onClick={() => go('/administration')}>
            <ListItemIcon>
              <AdminPanelSettingsOutlined fontSize='small' />
            </ListItemIcon>
            Administration
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={logout}>
          <ListItemIcon>
            <LogoutOutlined fontSize='small' />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
