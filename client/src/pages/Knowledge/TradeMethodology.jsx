import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '../../services/api';
import { Panel } from '../../components/ui';
import {
  KnowledgeCards,
  KnowledgePicker,
  message,
  allApproved,
} from './shared';

import ContextAnalytics from './ContextAnalytics';

const questions = {
  contextCorrect: 'Was the context classified correctly?',
  setupPresent: 'Was the setup present?',
  entryValid: 'Was the entry valid for the selected playbook?',
  signalAcceptable: 'Was the signal bar acceptable?',
  entryFollowed: 'Was the planned entry followed?',
  riskFollowed: 'Was risk followed?',
  managementFollowed: 'Was management consistent with plan?',
  scenarioMatched: 'Did this match the pre-market scenario?',
};

const planFields = [
  'entry',
  'stop',
  'target',
  'exit',
  'size',
  'risk',
  'maxAdverseEntryDeviation',
  'maxEntryFills',
];

export default function TradeMethodology({ tradeId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [plans, setPlans] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setForm(null);

    Promise.all([
      api.get(`/knowledge/trades/${tradeId}`),
      api.get('/journal', { params: { type: 'pre-market' } }),
      api.get('/strategies'),
      api.get('/playbooks'),
      allApproved(),
    ])
      .then(([r, j, s, p, c]) => {
        if (!active) return;
        setData(r.data);
        const m = r.data.methodology;

        setForm({
          knowledgeIds: m.knowledgeIds || [],
          journalId: m.journalId || null,
          scenarioId: m.scenarioId || null,
          plan: m.plan || null,
          actualEntryType: m.actualEntryType || null,
          review: m.review || {},
          notes: m.notes || '',
          revision: m.revision || 0,
        });

        setPlans(j.data);
        setStrategies(s.data);
        setPlaybooks(p.data);
        setCatalog(c);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });

    return () => {
      active = false;
    };
  }, [tradeId]);

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.put(`/knowledge/trades/${tradeId}`, form);
      const r = await api.get(`/knowledge/trades/${tradeId}`);
      setData(r.data);
      setForm((f) => ({
        ...f,
        revision: r.data.methodology.revision,
        knowledgeIds: r.data.methodology.knowledgeIds,
      }));

      setNotice('Context, execution plan and manual review saved.');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const displayComparison = (field, value) => {
    if (value == null) return 'unknown';

    const choices =
      field === 'entryType'
        ? catalog
        : field === 'strategy'
          ? strategies
          : field === 'playbook'
            ? playbooks
            : null;

    if (!choices) return value;

    const match = choices.find((item) => item._id === value);

    return (
      match?.name || match?.setupName || 'Historical reference unavailable'
    );
  };

  const setPlan = (key, value) =>
    setForm({ ...form, plan: { ...form.plan, [key]: value } });

  return (
    <Panel sx={{ my: 3 }}>
      <Typography variant='h6'>Price action &amp; process review</Typography>
      {error && <Alert severity='error'>{error}</Alert>}
      {notice && <Alert severity='success'>{notice}</Alert>}
      {!form && !error && (
        <Typography role='status'>Loading methodology review…</Typography>
      )}
      {form && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <KnowledgePicker
            value={form.knowledgeIds}
            onChange={(knowledgeIds) => setForm({ ...form, knowledgeIds })}
            label='Actual market context / pattern / signal / Trade Entry'
          />
          {data.methodology.snapshot?.length > 0 && (
            <>
              <Typography fontWeight={600}>
                Recorded classification snapshot
              </Typography>
              <KnowledgeCards
                items={data.methodology.snapshot.map((i) => ({
                  ...i,
                  _id: i.knowledgeId,
                }))}
              />
            </>
          )}
          <Typography>
            Actual Strategy: {data.strategy?.name || 'Not assigned'} · Playbook:{' '}
            {data.playbook?.setupName || 'Not assigned'}
          </Typography>
          <TextField
            select
            label='Pre-market plan'
            value={form.journalId || ''}
            onChange={(e) =>
              setForm({
                ...form,
                journalId: e.target.value || null,
                scenarioId: null,
              })
            }
          >
            <MenuItem value=''>None</MenuItem>
            {plans.map((p) => (
              <MenuItem key={p._id} value={p._id}>
                {p.title || 'Pre-market plan'} ·{' '}
                {new Date(p.date).toLocaleDateString()}
              </MenuItem>
            ))}
          </TextField>
          {form.journalId && (
            <TextField
              select
              label='Pre-market scenario'
              value={form.scenarioId || ''}
              onChange={(e) =>
                setForm({ ...form, scenarioId: e.target.value || null })
              }
            >
              <MenuItem value=''>Plan only</MenuItem>
              {plans
                .find((p) => p._id === form.journalId)
                ?.preparation?.scenarios?.map((s) => (
                  <MenuItem key={s._id} value={s._id}>
                    {s.name}
                  </MenuItem>
                ))}
            </TextField>
          )}
          {data.methodology.scenario && (
            <Alert severity='info'>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                {data.methodology.scenario.content}
              </Typography>
              {data.methodology.scenario.selected &&
                Object.entries(data.methodology.scenario.selected)
                  .filter(([k, v]) => typeof v === 'string' && k !== '_id')
                  .map(([k, v]) => (
                    <Typography key={k}>
                      {k}: {v}
                    </Typography>
                  ))}
              <Button component={Link} to='/journal'>
                Open The Scroll
              </Button>
            </Alert>
          )}
          <Typography variant='h6'>Planned vs actual execution</Typography>
          <Alert severity='info'>
            Plans saved after entry are labeled retrospective. Blank values
            remain unknown. Entry quantity is the aggregate filled quantity, not
            peak simultaneous exposure.
          </Alert>
          {!form.plan ? (
            <Button
              onClick={() => setForm({ ...form, plan: { knowledgeIds: [] } })}
            >
              Record execution plan
            </Button>
          ) : (
            <Stack spacing={2}>
              {planFields.map((key) => (
                <TextField
                  key={key}
                  label={`Planned ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                  type='number'
                  value={form.plan[key] ?? ''}
                  onChange={(e) =>
                    setPlan(
                      key,
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
              ))}
              {['earliestEntry', 'latestEntry'].map((key) => (
                <TextField
                  key={key}
                  label={
                    key === 'earliestEntry'
                      ? 'Earliest entry (ISO timestamp with timezone)'
                      : 'Latest entry (ISO timestamp with timezone)'
                  }
                  value={form.plan[key] || ''}
                  onChange={(e) => setPlan(key, e.target.value || null)}
                />
              ))}
              {[
                ['strategy', strategies, 'name'],
                ['playbook', playbooks, 'setupName'],
                [
                  'entryType',
                  catalog.filter((i) => i.dimension === 'entry_mechanism'),
                  'name',
                ],
              ].map(([key, options, label]) => (
                <TextField
                  key={key}
                  select
                  label={`Planned ${key}`}
                  value={form.plan[key] || ''}
                  onChange={(e) => setPlan(key, e.target.value || null)}
                >
                  <MenuItem value=''>Unknown</MenuItem>
                  {options.map((o) => (
                    <MenuItem key={o._id} value={o._id}>
                      {o[label]}
                    </MenuItem>
                  ))}
                </TextField>
              ))}
              <KnowledgePicker
                label='Planned market context'
                value={form.plan.knowledgeIds}
                onChange={(value) => setPlan('knowledgeIds', value)}
              />
              <TextField
                label='Plan notes'
                multiline
                value={form.plan.notes || ''}
                onChange={(e) => setPlan('notes', e.target.value)}
              />
              <Button onClick={() => setForm({ ...form, plan: null })}>
                Clear plan (prior version retained)
              </Button>
            </Stack>
          )}
          <TextField
            select
            label='Actual entry mechanism (manual observation)'
            value={form.actualEntryType || ''}
            onChange={(e) =>
              setForm({ ...form, actualEntryType: e.target.value || null })
            }
          >
            <MenuItem value=''>Unknown</MenuItem>
            {catalog
              .filter((i) => i.dimension === 'entry_mechanism')
              .map((i) => (
                <MenuItem key={i._id} value={i._id}>
                  {i.name}
                </MenuItem>
              ))}
          </TextField>
          {data.process.comparisons.map((c) => (
            <Typography key={c.field}>
              {c.field}: planned {displayComparison(c.field, c.planned)} /
              actual {displayComparison(c.field, c.actual)}
            </Typography>
          ))}
          <Typography variant='caption'>{data.process.limitation}</Typography>
          {data.process.planTiming && (
            <Typography>
              Plan timing: {data.process.planTiming.replaceAll('_', ' ')}
            </Typography>
          )}
          {data.process.findings.map((f) => (
            <Alert key={f.code} severity='warning'>
              <strong>{f.code}</strong>
              <Typography>{f.definition}</Typography>
              <Typography variant='caption'>
                {Object.entries(f.evidence)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </Typography>
            </Alert>
          ))}
          {!data.process.findings.length && (
            <Typography>
              No deterministic deviations established from available inputs.
            </Typography>
          )}
          <Typography variant='h6'>Manual process review</Typography>
          {Object.entries(questions).map(([key, label]) => (
            <TextField
              key={key}
              select
              label={label}
              value={form.review[key] == null ? '' : String(form.review[key])}
              onChange={(e) =>
                setForm({
                  ...form,
                  review: {
                    ...form.review,
                    [key]:
                      e.target.value === '' ? null : e.target.value === 'true',
                  },
                })
              }
            >
              <MenuItem value=''>Not reviewed / unknown</MenuItem>
              <MenuItem value='true'>Yes</MenuItem>
              <MenuItem value='false'>No</MenuItem>
            </TextField>
          ))}
          <TextField
            label='Review reasoning'
            multiline
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button disabled={busy} variant='contained' onClick={save}>
            {busy ? 'Saving…' : 'Save methodology review'}
          </Button>
          <Typography variant='h6'>
            Related approved methodology &amp; Star Points
          </Typography>
          <KnowledgeCards items={data.knowledge} />
          <ContextAnalytics
            key={form.knowledgeIds.join(':')}
            initialIds={form.knowledgeIds}
          />
        </Stack>
      )}
    </Panel>
  );
}
