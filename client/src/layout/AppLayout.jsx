import Box from '@mui/material/Box';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <Box component="main" sx={{ flex: 1, p: 3, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
