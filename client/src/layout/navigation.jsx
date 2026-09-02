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
import AdminIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SecurityIcon from '@mui/icons-material/ShieldOutlined';

export const NAVIGATION_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: DashboardIcon }],
  },
  {
    label: 'Trading',
    items: [
      { to: '/trades', label: 'Trades', icon: ListAltIcon },
      { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
      { to: '/journal', label: 'The Scroll', icon: JournalIcon },
    ],
  },
  {
    label: 'Edge',
    items: [
      { to: '/strategies', label: 'Strategies', icon: StrategyIcon },
      { to: '/playbooks', label: 'Playbooks', icon: PlaybookIcon },
      { to: '/reports', label: 'Reports', icon: ReportsIcon },
      { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/replay', label: 'Replay', icon: ReplayIcon },
      { to: '/backtesting', label: 'Backtesting', icon: BacktestIcon },
      { to: '/risk', label: 'Risk', icon: RiskIcon },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ to: '/ai-partner', label: 'Tortoise AI', icon: AiIcon }],
  },
  {
    label: 'System',
    items: [
      { to: '/import', label: 'Import', icon: ImportIcon },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
      { to: '/security', label: 'Security', icon: SecurityIcon },
      {
        to: '/administration',
        label: 'Administration',
        icon: AdminIcon,
        roles: ['ADMIN', 'ROOT'],
      },
    ],
  },
];

export const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/trades': 'Trades',
  '/calendar': 'Calendar',
  '/journal': 'The Scroll',
  '/strategies': 'Strategies',
  '/playbooks': 'Playbooks',
  '/reports': 'Reports',
  '/analytics': 'Analytics',
  '/replay': 'Replay',
  '/backtesting': 'Backtesting',
  '/risk': 'Risk',
  '/ai-partner': 'Tortoise AI',
  '/import': 'Import',
  '/settings': 'Settings',
  '/security': 'Account & Security',
  '/administration': 'Administration',
};

export function getRouteTitle(pathname) {
  if (pathname.startsWith('/trades/')) return 'Trade Detail';
  return ROUTE_TITLES[pathname] || 'Tortoise Scroll';
}
