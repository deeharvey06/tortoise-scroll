import { knowledgePath, routes } from '@/config/routes';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '@/services/api';
import { Panel } from '@/components/ui';

export const message = (error) =>
  error.response?.data?.error?.message || error.message;

export async function allApproved() {
  const items = [];
  let page = 1;
  let total;

  do {
    const { data } = await api.get('/knowledge/items', {
      params: { status: 'approved', page },
    });

    items.push(...data.items);
    total = data.total;
    page++;
  } while (items.length < total);

  return items;
}

export function KnowledgePicker({
  value = [],
  onChange,
  label = 'Approved methodology',
}) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    allApproved()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Stack spacing={1}>
      {error && <Alert severity='error'>{error}</Alert>}
      <Autocomplete
        multiple
        options={items}
        getOptionLabel={(item) =>
          `${item.name}${item.dimension ? ` · ${item.dimension}` : ''}`
        }
        value={items.filter((i) => value.includes(i._id))}
        onChange={(_, next) => onChange(next.map((i) => i._id))}
        isOptionEqualToValue={(a, b) => a._id === b._id}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            helperText={
              items.length
                ? 'Only reviewed, approved knowledge can be selected.'
                : 'Approve source-backed knowledge in Methodology to populate this catalog.'
            }
          />
        )}
      />
    </Stack>
  );
}

export function KnowledgeCards({ items = [] }) {
  return (
    <Stack spacing={2}>
      {items.map((item) => (
        <Panel key={item._id}>
          <Typography
            component={Link}
            to={knowledgePath({ item: item._id })}
            variant='h6'
          >
            {item.name}
          </Typography>
          <Stack direction='row' spacing={1} sx={{ my: 1 }}>
            <Chip size='small' label={item.kind.replaceAll('_', ' ')} />
            <Chip size='small' label={item.status || 'historical snapshot'} />
          </Stack>
          {item.interpretation && (
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>
              {item.interpretation}
            </Typography>
          )}
          {Object.entries(item.details || {})
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <Box key={key} sx={{ mt: 1 }}>
                <Typography fontWeight={600}>
                  {key.replaceAll('_', ' ')}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{value}</Typography>
              </Box>
            ))}
          {item.probability && (
            <Alert severity='info' sx={{ mt: 2 }}>
              <strong>
                Methodology probability — contextual, not a prediction
              </strong>
              {Object.entries(item.probability)
                .filter(([, v]) => v !== null && v !== '')
                .map(([k, v]) => (
                  <Typography key={k} variant='body2'>
                    {k}: {Array.isArray(v) ? v.join('–') : String(v)}
                  </Typography>
                ))}
            </Alert>
          )}
          {(item.references || []).map((ref, index) => (
            <Button
              key={index}
              component={Link}
              to={knowledgePath({
                source: ref.sourceId,
                section: ref.sectionId,
              })}
              size='small'
              sx={{ mt: 1, textAlign: 'left', overflowWrap: 'anywhere' }}
            >
              {ref.sourceType} · {ref.heading || ref.location} · p. {ref.page}
            </Button>
          ))}
        </Panel>
      ))}
    </Stack>
  );
}

export function MethodologyLinks({ type, targetId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get(`/knowledge/targets/${type}/${targetId}`)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [type, targetId]);

  return (
    <Box sx={{ my: 3 }}>
      <Typography variant='h6' sx={{ mb: 2 }}>
        Approved methodology
      </Typography>
      {error && <Alert severity='error'>{error}</Alert>}
      {!data && !error && (
        <Typography role='status'>Loading methodology…</Typography>
      )}
      {data?.inactive?.length > 0 && (
        <Alert severity='warning'>
          Some linked knowledge awaits review or is inactive; it is excluded
          from active methodology.
        </Alert>
      )}
      {data && !data.items.length && (
        <Typography color='text.secondary'>
          No approved knowledge linked yet.
        </Typography>
      )}
      <KnowledgeCards items={data?.items} />
      <Button component={Link} to={routes.knowledge}>
        Browse and link knowledge
      </Button>
    </Box>
  );
}
