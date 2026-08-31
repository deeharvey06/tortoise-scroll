import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';
import Sidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from './Sidebar';
import Topbar from './Topbar';
import useUIStore from '../store/useUIStore';

export default function AppShell() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const mobileNavigationOpen = useUIStore((state) => state.mobileNavigationOpen);
  const openMobileNavigation = useUIStore((state) => state.openMobileNavigation);
  const closeMobileNavigation = useUIStore((state) => state.closeMobileNavigation);
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed', top: 2, left: 2, zIndex: 'tooltip', px: 3, py: 2,
          bgcolor: 'background.paper', color: 'text.primary', border: '1px solid', borderColor: 'primary.main',
          borderRadius: 1, transform: 'translateY(-140%)', transition: 'transform var(--ts-transition-fast)',
          '&:focus': { transform: 'translateY(0)' },
        }}
      >
        Skip to content
      </Box>
      {mobile ? (
        <Drawer
          open={mobileNavigationOpen}
          onClose={closeMobileNavigation}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: SIDEBAR_EXPANDED_WIDTH, bgcolor: 'var(--ts-bg-sidebar)', backgroundImage: 'none' } }}
        >
          <Sidebar mobile onClose={closeMobileNavigation} onNavigate={closeMobileNavigation} />
        </Drawer>
      ) : (
        <Box
          component="aside"
          sx={{
            width: sidebarWidth, height: '100vh', position: 'sticky', top: 0, flexShrink: 0,
            transition: theme.transitions.create('width', { duration: theme.transitions.duration.complex }),
          }}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar mobile={mobile} onOpenNavigation={openMobileNavigation} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flex: 1, minWidth: 0, width: '100%',
            px: { xs: 4, sm: 5, lg: 6, xl: 8 }, py: { xs: 4, sm: 5, lg: 6 },
            outline: 'none',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
