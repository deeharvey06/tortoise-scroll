import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

export default function EmptyState({ title = 'Nothing to show', description, action, icon: Icon = InboxOutlinedIcon, compact = false, sx }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: compact ? 96 : 180, px: 4, py: compact ? 4 : 8, ...sx }}>
      <Icon aria-hidden="true" sx={{ fontSize: compact ? 24 : 30, color: 'text.disabled', mb: 3 }} />
      <Typography variant="h6">{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 440 }}>{description}</Typography>}
      {action && <Box sx={{ mt: 4 }}>{action}</Box>}
    </Box>
  );
}
