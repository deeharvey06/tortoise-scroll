import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ListAltIcon from '@mui/icons-material/ListAltOutlined';
import CalendarIcon from '@mui/icons-material/CalendarMonthOutlined';
import JournalIcon from '@mui/icons-material/MenuBookOutlined';
import StrategyIcon from '@mui/icons-material/AccountTreeOutlined';
import PlaybookIcon from '@mui/icons-material/RuleFolderOutlined';
import ReportsIcon from '@mui/icons-material/SummarizeOutlined';
import AnalyticsIcon from '@mui/icons-material/InsightsOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import BacktestIcon from '@mui/icons-material/ScienceOutlined';
import AiIcon from '@mui/icons-material/AutoAwesomeOutlined';
import RiskIcon from '@mui/icons-material/GppMaybeOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import ImportIcon from '@mui/icons-material/UploadFileOutlined';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { to: '/trades', label: 'Trades', icon: <ListAltIcon fontSize="small" /> },
  { to: '/calendar', label: 'Calendar', icon: <CalendarIcon fontSize="small" /> },
  { to: '/journal', label: 'Journal', icon: <JournalIcon fontSize="small" /> },
  { to: '/strategies', label: 'Strategies', icon: <StrategyIcon fontSize="small" /> },
  { to: '/playbooks', label: 'Playbooks', icon: <PlaybookIcon fontSize="small" /> },
  { to: '/reports', label: 'Reports', icon: <ReportsIcon fontSize="small" /> },
  { to: '/analytics', label: 'Analytics', icon: <AnalyticsIcon fontSize="small" /> },
  { to: '/replay', label: 'Replay', icon: <ReplayIcon fontSize="small" /> },
  { to: '/backtesting', label: 'Backtesting', icon: <BacktestIcon fontSize="small" /> },
  { to: '/ai-partner', label: 'AI Trading Partner', icon: <AiIcon fontSize="small" /> },
  { to: '/risk', label: 'Risk', icon: <RiskIcon fontSize="small" /> },
  { to: '/import', label: 'Import', icon: <ImportIcon fontSize="small" /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon fontSize="small" /> },
];

export default function Sidebar() {
  return (
    <Box
      component="nav"
      sx={{
        width: 232,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
          Trading Journal
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Local instance
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.to === '/'}
            sx={{
              mx: 1,
              mb: 0.25,
              borderRadius: 1,
              '&.active': {
                backgroundColor: 'rgba(76, 141, 255, 0.12)',
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5 }}>{item.label}</ListItemText>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
