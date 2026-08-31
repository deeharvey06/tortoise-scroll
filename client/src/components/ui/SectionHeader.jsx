import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function SectionHeader({ title, description, actions, component = 'h2', sx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, mb: 4, ...sx }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component={component} variant="h6">{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{description}</Typography>}
      </Box>
      {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}
