import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <Box
      component="header"
      sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, mb: 6 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="caption" color="primary.main" sx={{ display: 'block', mb: 1, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {eyebrow}
          </Typography>
        )}
        <Typography component="h1" variant="h4">{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>{description}</Typography>}
      </Box>
      {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}
