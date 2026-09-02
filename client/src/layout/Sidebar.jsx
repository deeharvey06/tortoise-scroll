import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { NAVIGATION_GROUPS } from './navigation';
import useAuthStore from '../store/useAuthStore';

export const SIDEBAR_EXPANDED_WIDTH = 228;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

function Brand({ collapsed, mobile, onClose }) {
  return (
    <Box
      sx={{
        height: 64,
        px: collapsed ? 2 : 3,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <Box
        aria-hidden='true'
        sx={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.dark',
          color: 'primary.light',
          border: '1px solid',
          borderColor: 'primary.main',
          fontFamily: 'var(--ts-font-numeric)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '-0.04em',
        }}
      >
        TS
      </Box>
      {!collapsed && (
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant='subtitle2'
            sx={{ fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' }}
          >
            Tortoise Scroll
          </Typography>
          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ whiteSpace: 'nowrap' }}
          >
            by Tortoise Trader
          </Typography>
        </Box>
      )}
      {mobile && (
        <IconButton
          size='small'
          aria-label='Close navigation'
          onClick={onClose}
        >
          <CloseIcon fontSize='small' />
        </IconButton>
      )}
    </Box>
  );
}

function NavigationItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;
  const button = (
    <ListItemButton
      component={NavLink}
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      sx={{
        minHeight: 36,
        px: collapsed ? 2 : 2.5,
        mx: 2,
        mb: 0.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 1,
        color: 'text.secondary',
        transition:
          'background-color var(--ts-transition-fast), color var(--ts-transition-fast)',
        '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
        '&.active': {
          bgcolor: 'action.selected',
          color: 'primary.main',
          boxShadow: 'inset 2px 0 0 var(--ts-brand-jade)',
          '& .MuiListItemIcon-root': { color: 'primary.main' },
        },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed ? 0 : 32,
          justifyContent: 'center',
          color: 'inherit',
        }}
      >
        <Icon sx={{ fontSize: 19 }} />
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontSize: 13,
            fontWeight: 500,
            noWrap: true,
          }}
        />
      )}
    </ListItemButton>
  );

  return collapsed ? (
    <Tooltip title={item.label} placement='right' arrow>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export default function Sidebar({
  collapsed = false,
  mobile = false,
  onToggle,
  onNavigate,
  onClose,
}) {
  const effectiveCollapsed = mobile ? false : collapsed;
  const role = useAuthStore((state) => state.user?.role);

  return (
    <Box
      component='nav'
      aria-label='Primary navigation'
      sx={{
        width: effectiveCollapsed
          ? SIDEBAR_COLLAPSED_WIDTH
          : SIDEBAR_EXPANDED_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'var(--ts-bg-sidebar)',
        borderRight: mobile ? 0 : '1px solid',
        borderColor: 'divider',
        transition: (theme) =>
          theme.transitions.create('width', {
            duration: theme.transitions.duration.complex,
          }),
      }}
    >
      <Brand collapsed={effectiveCollapsed} mobile={mobile} onClose={onClose} />
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 2 }}>
        {NAVIGATION_GROUPS.map((group, groupIndex) => (
          <Box
            key={group.label}
            sx={{ mb: groupIndex === NAVIGATION_GROUPS.length - 1 ? 0 : 2 }}
          >
            {effectiveCollapsed ? (
              groupIndex > 0 && <Divider sx={{ mx: 3, mb: 1.5 }} />
            ) : (
              <Typography
                variant='caption'
                color='text.disabled'
                sx={{
                  display: 'block',
                  px: 3,
                  mb: 1,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                }}
              >
                {group.label}
              </Typography>
            )}
            <List disablePadding>
              {group.items
                .filter((item) => !item.roles || item.roles.includes(role))
                .map((item) => (
                  <NavigationItem
                    key={item.to}
                    item={item}
                    collapsed={effectiveCollapsed}
                    onNavigate={onNavigate}
                  />
                ))}
            </List>
          </Box>
        ))}
      </Box>
      {!mobile && (
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Tooltip
            title={
              effectiveCollapsed ? 'Expand navigation' : 'Collapse navigation'
            }
            placement='right'
            arrow
          >
            <IconButton
              size='small'
              aria-label={
                effectiveCollapsed ? 'Expand navigation' : 'Collapse navigation'
              }
              onClick={onToggle}
              sx={{
                width: '100%',
                height: 32,
                borderRadius: 1,
                justifyContent: effectiveCollapsed ? 'center' : 'flex-end',
              }}
            >
              {effectiveCollapsed ? (
                <ChevronRightIcon fontSize='small' />
              ) : (
                <ChevronLeftIcon fontSize='small' />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
