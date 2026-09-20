import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import api from '../services/api';
import { LoadingState, EmptyState } from './ui';

export default function GlobalSearch() {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [groups, setGroups] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setGroups([]);
      setBusy(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setBusy(true);
    setGroups([]);
    setError('');

    const timer = setTimeout(
      () =>
        api
          .get('/search', {
            params: { q: query.trim() },
            signal: controller.signal,
          })
          .then(({ data }) => {
            if (!controller.signal.aborted) setGroups(data.groups);
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setError('Search unavailable. Please retry.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setBusy(false);
          }),
      300
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, retry]);

  return (
    <>
      <IconButton aria-label='Search workspace' onClick={() => setOpen(true)}>
        <SearchIcon />
      </IconButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth='md'
        aria-labelledby='workspace-search-title'
        TransitionProps={{ onEntered: () => inputRef.current?.focus() }}
      >
        <DialogTitle id='workspace-search-title'>Search workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            inputRef={inputRef}
            fullWidth
            label='Search your trades, notes, The Scroll, strategies, playbooks, tags and symbols'
            value={query}
            inputProps={{ maxLength: 100 }}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error && (
            <Alert
              sx={{ mt: 2 }}
              severity='error'
              action={
                <Button onClick={() => setRetry((v) => v + 1)}>Retry</Button>
              }
            >
              {error}
            </Alert>
          )}
          {busy ? (
            <LoadingState label='Searching your workspace…' />
          ) : query.trim().length < 2 ? (
            <EmptyState title='Enter at least two characters' />
          ) : !error && !groups.some((g) => g.items.length) ? (
            <EmptyState
              title='No matching results'
              description='Try another name, symbol or phrase.'
            />
          ) : (
            groups
              .filter((g) => g.items.length)
              .map((g) => (
                <section key={g.type}>
                  <Typography variant='h6' sx={{ mt: 2 }}>
                    {
                      {
                        trade: 'Trades and notes',
                        scroll: 'The Scroll',
                        strategy: 'Strategies',
                        playbook: 'Playbooks',
                        tag: 'Tags',
                        symbol: 'Symbols',
                      }[g.type]
                    }
                  </Typography>
                  <List>
                    {g.items.map((item) => (
                      <ListItemButton
                        component={Link}
                        to={item.href}
                        key={item.id}
                        onClick={() => setOpen(false)}
                      >
                        <ListItemText
                          primary={item.label}
                          secondary={[
                            item.timestamp &&
                              new Date(item.timestamp).toLocaleString(),
                            item.excerpt,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          secondaryTypographyProps={{
                            sx: { overflowWrap: 'anywhere' },
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                  {g.hasMore && (
                    <Typography variant='caption'>
                      First 10 matches. Refine your search for more specific
                      results.
                    </Typography>
                  )}
                </section>
              ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
