import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ComputerIcon from '@mui/icons-material/ComputerOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import useUIStore, { THEME_MODES } from '../store/useUIStore';

const OPTIONS = {
  system: { label: 'System theme', icon: ComputerIcon },
  light: { label: 'Light theme', icon: LightModeIcon },
  dark: { label: 'Dark theme', icon: DarkModeIcon },
};

export default function ThemeModeSelector() {
  const [anchorEl, setAnchorEl] = useState(null);
  const themeMode = useUIStore((state) => state.themeMode);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const ActiveIcon = OPTIONS[themeMode].icon;

  const chooseMode = (mode) => {
    setThemeMode(mode);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={OPTIONS[themeMode].label}>
        <IconButton size="small" aria-label={`Theme: ${OPTIONS[themeMode].label}`} onClick={(event) => setAnchorEl(event.currentTarget)}>
          <ActiveIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {THEME_MODES.map((mode) => {
          const Icon = OPTIONS[mode].icon;
          return (
            <MenuItem key={mode} selected={mode === themeMode} onClick={() => chooseMode(mode)} sx={{ minWidth: 184 }}>
              <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
              <ListItemText>{OPTIONS[mode].label}</ListItemText>
              {mode === themeMode && <CheckIcon color="primary" sx={{ ml: 2, fontSize: 18 }} />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
