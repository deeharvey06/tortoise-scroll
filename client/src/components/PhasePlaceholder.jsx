import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

/**
 * Honest placeholder for nav destinations not yet implemented. This is
 * intentionally NOT a fake dashboard with mock numbers — it states plainly
 * what's coming and when, per the project's "no placeholder buttons /
 * no fake data" rule.
 */
export default function PhasePlaceholder({ title, phase, description }) {
  return (
    <Box sx={{ maxWidth: 640 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="h5">{title}</Typography>
        <Chip size="small" label={`Phase ${phase}`} variant="outlined" color="warning" />
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {description ||
            `${title} is scaffolded with a real route but not yet built. It will be implemented in Phase ${phase} of the build plan, with real data and calculations — not a mock.`}
        </Typography>
      </Paper>
    </Box>
  );
}
