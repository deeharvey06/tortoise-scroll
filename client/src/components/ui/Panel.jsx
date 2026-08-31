import Paper from '@mui/material/Paper';

export default function Panel({ children, padding = 4, interactive = false, sx, ...props }) {
  return (
    <Paper
      {...props}
      sx={{
        p: padding,
        borderRadius: 2,
        bgcolor: 'background.paper',
        transition: interactive ? 'border-color var(--ts-transition-fast), background-color var(--ts-transition-fast)' : undefined,
        ...(interactive ? { '&:hover': { borderColor: 'var(--ts-border-strong)', bgcolor: 'var(--ts-surface-secondary)' } } : {}),
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
