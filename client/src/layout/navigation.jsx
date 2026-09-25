import { routes } from '@/config/routes';
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
import AccountsIcon from '@mui/icons-material/AccountBalanceWalletOutlined';

export const NAVIGATION_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: routes.dashboard, label: 'Dashboard', icon: DashboardIcon }],
  },
  {
    label: 'Trading',
    items: [
      { to: routes.trades, label: 'Trades', icon: ListAltIcon },
      { to: routes.accounts, label: 'Accounts', icon: AccountsIcon },
      { to: routes.calendar, label: 'Calendar', icon: CalendarIcon },
      { to: routes.journal, label: 'The Scroll', icon: JournalIcon },
    ],
  },
  {
    label: 'Edge',
    items: [
      {
        to: routes.knowledge,
        label: 'Methodology',
        icon: JournalIcon,
        roles: ['ROOT'],
      },
      { to: routes.strategies, label: 'Strategies', icon: StrategyIcon },
      { to: routes.playbooks, label: 'Playbooks', icon: PlaybookIcon },
      { to: routes.reports, label: 'Reports', icon: ReportsIcon },
      { to: routes.analytics, label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: routes.replay, label: 'Replay', icon: ReplayIcon },
      { to: routes.backtesting, label: 'Backtesting', icon: BacktestIcon },
      { to: routes.risk, label: 'Risk', icon: RiskIcon },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ to: routes.aiPartner, label: 'Tortoise AI', icon: AiIcon }],
  },
  {
    label: 'System',
    items: [
      { to: routes.import, label: 'Import', icon: ImportIcon },
      { to: routes.settings, label: 'Settings', icon: SettingsIcon },
      { to: routes.security, label: 'Security', icon: SecurityIcon },
      {
        to: routes.administration,
        label: 'Administration',
        icon: AdminIcon,
        roles: ['ADMIN', 'ROOT'],
      },
    ],
  },
];

export const ROUTE_TITLES = {
  [routes.dashboard]: 'Dashboard',
  [routes.trades]: 'Trades',
  [routes.accounts]: 'Accounts & Instruments',
  [routes.calendar]: 'Calendar',
  [routes.journal]: 'The Scroll',
  [routes.knowledge]: 'Methodology',
  [routes.strategies]: 'Strategies',
  [routes.playbooks]: 'Playbooks',
  [routes.reports]: 'Reports',
  [routes.analytics]: 'Analytics',
  [routes.replay]: 'Replay',
  [routes.backtesting]: 'Backtesting',
  [routes.risk]: 'Risk',
  [routes.aiPartner]: 'Tortoise AI',
  [routes.import]: 'Import',
  [routes.settings]: 'Settings',
  [routes.security]: 'Account & Security',
  [routes.administration]: 'Administration',
};

export function getRouteTitle(pathname) {
  if (pathname.startsWith(`${routes.trades}/`)) return 'Trade Detail';
  return ROUTE_TITLES[pathname] || 'Tortoise Scroll';
}
