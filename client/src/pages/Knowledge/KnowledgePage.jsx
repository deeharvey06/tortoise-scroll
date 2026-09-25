import RefreshStatus from '@/components/ui/RefreshStatus';
import { knowledgePath, routes } from '@/config/routes';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '@/services/api';
import PageHeader from '@/components/PageHeader';
import { Panel } from '@/components/ui';
import { KnowledgeCards, message } from '@/pages/Knowledge/shared';

const detailFields = [
  'definition',
  'required_context',
  'favorable_context',
  'unfavorable_context',
  'setup',
  'pattern',
  'signal',
  'confirmation',
  'trigger',
  'entry_mechanism',
  'stop',
  'target',
  'management',
  'invalidation',
  'warnings',
  'exceptions',
  'trade_intent',
];

const blank = {
  name: '',
  kind: 'concept',
  dimension: '',
  classification: '',
  interpretation: '',
  details: {},
  probability: null,
  references: [],
  reviewNotes: '',
};

function editable(item) {
  return Object.fromEntries(
    Object.keys(blank).map((key) => [key, item[key] ?? blank[key]])
  );
}

const cleanReferences = (refs) =>
  refs.map(({ sourceId, sectionId }) => ({ sourceId, sectionId }));

export default function KnowledgePage() {
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [sources, setSources] = useState([]);
  const [list, setList] = useState({ items: [], total: 0 });
  const [filter, setFilter] = useState({
    search: '',
    kind: '',
    status: '',
    page: 1,
  });

  const [source, setSource] = useState(null);
  const [section, setSection] = useState('');
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [upload, setUpload] = useState({
    sourceType: 'PERSONAL_NOTES',
    title: '',
    text: '',
    file: null,
    incomplete: false,
  });

  const [targets, setTargets] = useState({ strategy: [], playbook: [] });
  const [targetType, setTargetType] = useState('playbook');
  const [targetId, setTargetId] = useState('');
  const [relations, setRelations] = useState([]);
  const [relation, setRelation] = useState({
    to: '',
    type: 'related_to',
    evidence: '',
  });

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [m, s, i, st, pb] = await Promise.all([
      api.get('/knowledge/metadata'),
      api.get('/knowledge/sources'),
      api.get('/knowledge/items', { params: filter }),
      api.get('/strategies'),
      api.get('/playbooks'),
    ]);
    setMeta(m.data);
    setSources(s.data);
    setList(i.data);
    setTargets({ strategy: st.data, playbook: pb.data });
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [refresh]);

  const sourceId = params.get('source');
  const itemId = params.get('item');
  const sectionId = params.get('section');

  useEffect(() => {
    let active = true;
    if (sourceId)
      api
        .get(`/knowledge/sources/${sourceId}`)
        .then((r) => {
          if (active) {
            setSource(r.data);
            setSection(sectionId || r.data.sections[0]?.id || '');
          }
        })
        .catch((e) => setError(message(e)));

    return () => {
      active = false;
    };
  }, [sourceId, sectionId]);

  useEffect(() => {
    let active = true;
    if (itemId)
      Promise.all([
        api.get(`/knowledge/items/${itemId}`),
        api.get('/knowledge/relationships', { params: { itemId } }),
      ])
        .then(([i, r]) => {
          if (active) {
            setItem(i.data);
            setRelations(r.data);
            setEditing(false);
            setVerified(false);
          }
        })
        .catch((e) => setError(message(e)));

    return () => {
      active = false;
    };
  }, [itemId]);

  const run = async (task) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await task();
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const addSource = () =>
    run(async () => {
      const data = new FormData();
      for (const key of ['sourceType', 'title', 'text', 'incomplete'])
        data.append(key, String(upload[key]));
      if (upload.file) data.append('file', upload.file);
      const result = await api.post('/knowledge/sources', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setNotice(
        result.data.results
          .map(
            (r) =>
              `${r.title}: ${r.error || (r.duplicate ? 'already preserved' : 'preserved; needs review')}`
          )
          .join('\n')
      );
    });

  const save = () =>
    run(async () => {
      const value = { ...form, references: cleanReferences(form.references) };
      const r =
        item && editing
          ? await api.put(`/knowledge/items/${item._id}`, {
              ...value,
              revision: item.revision,
            })
          : await api.post('/knowledge/items', value);

      setItem(r.data);
      setEditing(false);
      setVerified(false);
      setParams({ item: r.data._id });
      setNotice('Saved as Needs Review. Editing withdraws prior approval.');
    });

  const review = (status) =>
    run(async () => {
      const r = await api.post(`/knowledge/items/${item._id}/review`, {
        revision: item.revision,
        status,
        verification: verified || undefined,
        note: form.reviewNotes || '',
      });

      setItem(r.data);
      setVerified(false);
      setNotice(`Knowledge is now ${status.replaceAll('_', ' ')}.`);
    });

  const selectedSection = source?.sections.find((s) => s.id === section);

  return (
    <Box>
      <PageHeader
        title='Methodology'
        description='Private source-backed knowledge, reviewed by you. Personal performance remains separate.'
      />
      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity='success' sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
          {notice}
        </Alert>
      )}
      <RefreshStatus refreshing={loading} />
      <Stack spacing={3}>
        <Panel>
          <Typography variant='h6'>Add source notes</Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              select
              label='Source type'
              value={upload.sourceType}
              onChange={(e) =>
                setUpload({ ...upload, sourceType: e.target.value })
              }
            >
              {(meta?.sourceTypes || ['PERSONAL_NOTES']).map((t) => (
                <MenuItem key={t} value={t}>
                  {t.replaceAll('_', ' ')}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label='Source title'
              value={upload.title}
              onChange={(e) => setUpload({ ...upload, title: e.target.value })}
            />
            <TextField
              label='Original source text (or select a file)'
              multiline
              minRows={3}
              value={upload.text}
              onChange={(e) => setUpload({ ...upload, text: e.target.value })}
            />
            <Button component='label' variant='outlined'>
              Select PDF, TXT or ZIP
              <input
                hidden
                type='file'
                accept='.pdf,.txt,.zip'
                onChange={(e) =>
                  setUpload({ ...upload, file: e.target.files?.[0] || null })
                }
              />
            </Button>
            {upload.file && <Typography>{upload.file.name}</Typography>}
            <FormControlLabel
              control={
                <Checkbox
                  checked={
                    upload.incomplete ||
                    upload.sourceType === 'PRICE_ACTION_BONUS'
                  }
                  onChange={(e) =>
                    setUpload({ ...upload, incomplete: e.target.checked })
                  }
                />
              }
              label='Source material is incomplete'
            />
            <Button
              disabled={busy || (!upload.file && !upload.text.trim())}
              onClick={addSource}
              variant='contained'
            >
              Preserve and extract source
            </Button>
          </Stack>
        </Panel>
        <Panel>
          <Typography variant='h6'>Source library</Typography>
          {!sources.length && <Typography>No sources yet.</Typography>}
          <TextField
            fullWidth
            select
            label='Browse source'
            value={sourceId || ''}
            onChange={(e) => setParams({ source: e.target.value })}
            sx={{ mt: 2 }}
          >
            <MenuItem value=''>Select source</MenuItem>
            {sources.map((s) => (
              <MenuItem key={s._id} value={s._id}>
                {s.title}
                {s.incomplete ? ' · incomplete' : ''}
              </MenuItem>
            ))}
          </TextField>
          {source && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {source.warnings.map((w, i) => (
                <Alert key={i} severity='warning'>
                  {w}
                </Alert>
              ))}
              <Button
                component='a'
                href={`/api/knowledge/sources/${source._id}/original`}
              >
                Download preserved original
              </Button>
              <TextField
                select
                label='Source page / section'
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                {source.sections.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    p. {s.page} · {s.heading}
                  </MenuItem>
                ))}
              </TextField>
              <Typography
                sx={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {selectedSection?.text ||
                  'No text extracted; inspect original.'}
              </Typography>
              <Button
                disabled={!selectedSection?.text || busy}
                onClick={() => {
                  setItem(null);
                  setForm({
                    ...blank,
                    name: selectedSection.heading,
                    references: [{ sourceId: source._id, sectionId: section }],
                  });
                  setEditing(true);
                }}
              >
                Create knowledge candidate from this section
              </Button>
            </Stack>
          )}
        </Panel>
        <Panel>
          <Typography variant='h6'>Knowledge explorer</Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ my: 2 }}
          >
            <TextField
              label='Search names, chapters, sections or source'
              value={filter.search}
              onChange={(e) =>
                setFilter({ ...filter, search: e.target.value, page: 1 })
              }
            />
            {['kind', 'status'].map((key) => (
              <TextField
                key={key}
                select
                label={key === 'kind' ? 'Knowledge type' : 'Review status'}
                value={filter[key]}
                onChange={(e) =>
                  setFilter({ ...filter, [key]: e.target.value, page: 1 })
                }
                sx={{ minWidth: 180 }}
              >
                <MenuItem value=''>All</MenuItem>
                {(meta?.[key === 'kind' ? 'kinds' : 'statuses'] || []).map(
                  (v) => (
                    <MenuItem key={v} value={v}>
                      {v.replaceAll('_', ' ')}
                    </MenuItem>
                  )
                )}
              </TextField>
            ))}
          </Stack>
          <TextField
            fullWidth
            select
            label='Filter by source'
            value={filter.sourceId || ''}
            onChange={(e) =>
              setFilter({ ...filter, sourceId: e.target.value, page: 1 })
            }
            sx={{ mb: 2 }}
          >
            <MenuItem value=''>All sources</MenuItem>
            {sources.map((s) => (
              <MenuItem key={s._id} value={s._id}>
                {s.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label='Filter context dimension'
            value={filter.dimension || ''}
            onChange={(e) =>
              setFilter({ ...filter, dimension: e.target.value, page: 1 })
            }
            sx={{ mb: 2 }}
          />
          {!list.items.length && !loading && (
            <Typography>
              No matching knowledge. Add a source and create a review candidate.
            </Typography>
          )}
          {list.items.map((i) => (
            <Button
              key={i._id}
              onClick={() => setParams({ item: i._id })}
              sx={{ display: 'block', textAlign: 'left' }}
            >
              {i.name} · {i.kind.replaceAll('_', ' ')} ·{' '}
              {i.status.replaceAll('_', ' ')}
            </Button>
          ))}
          <Typography>
            {list.total} items · page {filter.page}
          </Typography>
          <Button
            disabled={filter.page === 1}
            onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
          >
            Previous
          </Button>
          <Button
            disabled={filter.page * 100 >= list.total}
            onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
          >
            Next
          </Button>
        </Panel>
        {(editing || item) && (
          <Panel>
            <Typography variant='h6'>
              {editing ? 'Edit knowledge interpretation' : 'Review knowledge'}
            </Typography>
            {editing ? (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label='Knowledge name'
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <TextField
                  select
                  label='Knowledge kind'
                  value={form.kind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kind: e.target.value,
                      probability:
                        e.target.value === 'probability'
                          ? form.probability || {
                              statement: '',
                              value: null,
                              range: null,
                              event: '',
                              conditions: '',
                              context: '',
                              timeframe: '',
                              qualifications: '',
                              exceptions: '',
                            }
                          : form.probability,
                    })
                  }
                >
                  {meta?.kinds.map((k) => (
                    <MenuItem key={k} value={k}>
                      {k.replaceAll('_', ' ')}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label='Context dimension (extensible)'
                  value={form.dimension}
                  onChange={(e) =>
                    setForm({ ...form, dimension: e.target.value })
                  }
                />
                <TextField
                  label='Classification (e.g. guideline or risk reminder)'
                  value={form.classification}
                  onChange={(e) =>
                    setForm({ ...form, classification: e.target.value })
                  }
                />
                <TextField
                  label='Reviewed interpretation'
                  multiline
                  minRows={3}
                  value={form.interpretation}
                  onChange={(e) =>
                    setForm({ ...form, interpretation: e.target.value })
                  }
                />
                {detailFields.map((k) => (
                  <TextField
                    key={k}
                    label={k.replaceAll('_', ' ')}
                    multiline
                    value={form.details[k] || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        details: { ...form.details, [k]: e.target.value },
                      })
                    }
                  />
                ))}
                {form.probability && (
                  <>
                    <Alert severity='warning'>
                      Retain conditions and qualifications. Retracement
                      percentages are not outcome probabilities.
                    </Alert>
                    {[
                      'statement',
                      'event',
                      'conditions',
                      'context',
                      'timeframe',
                      'qualifications',
                      'exceptions',
                    ].map((k) => (
                      <TextField
                        key={k}
                        label={`Probability ${k}`}
                        multiline
                        value={form.probability[k] || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            probability: {
                              ...form.probability,
                              [k]: e.target.value,
                            },
                          })
                        }
                      />
                    ))}
                    {[0, 1].map((index) => (
                      <TextField
                        key={index}
                        label={
                          index === 0
                            ? 'Probability range minimum (optional)'
                            : 'Probability range maximum (optional)'
                        }
                        type='number'
                        value={form.probability.range?.[index] ?? ''}
                        onChange={(e) => {
                          const range = [
                            ...(form.probability.range || [0, 100]),
                          ];
                          range[index] =
                            e.target.value === ''
                              ? null
                              : Number(e.target.value);
                          setForm({
                            ...form,
                            probability: {
                              ...form.probability,
                              range: range.some((v) => v == null)
                                ? null
                                : range,
                            },
                          });
                        }}
                      />
                    ))}
                    <TextField
                      label='Probability percentage (optional)'
                      type='number'
                      value={form.probability.value ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          probability: {
                            ...form.probability,
                            value:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </>
                )}
                <TextField
                  label='Review notes / ambiguity'
                  multiline
                  value={form.reviewNotes}
                  onChange={(e) =>
                    setForm({ ...form, reviewNotes: e.target.value })
                  }
                />
                <Button disabled={busy} onClick={save} variant='contained'>
                  Save as Needs Review
                </Button>
              </Stack>
            ) : (
              <>
                <KnowledgeCards items={[item]} />
                {item.reviewNotes && (
                  <Alert severity='warning'>{item.reviewNotes}</Alert>
                )}
                <Button
                  onClick={() => {
                    setForm(editable(item));
                    setEditing(true);
                  }}
                >
                  Edit interpretation
                </Button>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={verified}
                      onChange={(e) => setVerified(e.target.checked)}
                    />
                  }
                  label='I verified this interpretation and its qualifications against the source'
                />
                <Stack direction='row' flexWrap='wrap'>
                  {['approved', 'rejected', 'superseded'].map((status) => (
                    <Button
                      key={status}
                      disabled={busy || (status === 'approved' && !verified)}
                      onClick={() => review(status)}
                    >
                      {status === 'approved'
                        ? 'Approve'
                        : status === 'rejected'
                          ? 'Reject'
                          : 'Supersede'}
                    </Button>
                  ))}
                </Stack>
                {item.status === 'approved' && (
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <Typography variant='h6'>
                      Strategy / Playbook building block
                    </Typography>
                    <TextField
                      select
                      label='Destination type'
                      value={targetType}
                      onChange={(e) => {
                        setTargetType(e.target.value);
                        setTargetId('');
                      }}
                    >
                      {['strategy', 'playbook'].map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label='Enrich existing or create draft'
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    >
                      <MenuItem value=''>Create inactive draft</MenuItem>
                      {targets[targetType].map((t) => (
                        <MenuItem key={t._id} value={t._id}>
                          {t.name || t.setupName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api.post('/knowledge/attach', {
                            type: targetType,
                            targetId: targetId || null,
                            knowledgeIds: [item._id],
                          });
                          setNotice(
                            'Approved knowledge linked. New drafts are inactive; repeat requests reuse the draft.'
                          );
                        })
                      }
                    >
                      Link approved knowledge
                    </Button>
                    <Button
                      component={Link}
                      to={
                        targetType === 'strategy'
                          ? routes.strategies
                          : routes.playbooks
                      }
                    >
                      Open {targetType}s
                    </Button>
                  </Stack>
                )}
                <Typography variant='h6' sx={{ mt: 3 }}>
                  Source-backed relationships
                </Typography>
                {relations.map((r) => (
                  <Box key={r._id}>
                    <Typography>
                      {r.type.replaceAll('_', ' ')} · {r.status}
                    </Typography>
                    <Typography>{r.evidence}</Typography>
                    <Button
                      onClick={() =>
                        setRelation({
                          to: r.to,
                          from: r.from,
                          type: r.type,
                          evidence: r.evidence,
                          _id: r._id,
                          revision: r.revision,
                          references: r.references,
                        })
                      }
                    >
                      Edit relationship
                    </Button>
                    {['rejected', 'superseded'].map((status) => (
                      <Button
                        key={status}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api.post(
                              `/knowledge/relationships/${r._id}/review`,
                              { revision: r.revision, status }
                            );
                            setRelations(
                              (
                                await api.get('/knowledge/relationships', {
                                  params: { itemId: item._id },
                                })
                              ).data
                            );
                            setNotice(`Relationship ${status}.`);
                          })
                        }
                      >
                        {status === 'rejected'
                          ? 'Reject relationship'
                          : 'Supersede relationship'}
                      </Button>
                    ))}
                    <Button
                      component={Link}
                      to={knowledgePath({
                        item: r.from === item._id ? r.to : r.from,
                      })}
                    >
                      Related knowledge
                    </Button>
                    {r.status !== 'approved' && (
                      <Button
                        disabled={busy || !verified}
                        onClick={() =>
                          run(async () => {
                            await api.post(
                              `/knowledge/relationships/${r._id}/review`,
                              {
                                revision: r.revision,
                                status: 'approved',
                                verification: true,
                              }
                            );
                            setRelations(
                              (
                                await api.get('/knowledge/relationships', {
                                  params: { itemId: item._id },
                                })
                              ).data
                            );
                            setNotice('Relationship approved.');
                          })
                        }
                      >
                        Approve verified relationship
                      </Button>
                    )}
                  </Box>
                ))}
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    select
                    label='Related item'
                    value={relation.to}
                    onChange={(e) =>
                      setRelation({ ...relation, to: e.target.value })
                    }
                  >
                    <MenuItem value=''>Select another item</MenuItem>
                    {list.items
                      .filter((i) => i._id !== (relation.from || item._id))
                      .map((i) => (
                        <MenuItem key={i._id} value={i._id}>
                          {i.name}
                        </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                    select
                    label='Relationship'
                    value={relation.type}
                    onChange={(e) =>
                      setRelation({ ...relation, type: e.target.value })
                    }
                  >
                    {meta?.relationshipTypes.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t.replaceAll('_', ' ')}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label='Explicit source evidence for this relationship'
                    multiline
                    value={relation.evidence}
                    onChange={(e) =>
                      setRelation({ ...relation, evidence: e.target.value })
                    }
                  />
                  <Button
                    disabled={busy || !relation.to || !relation.evidence.trim()}
                    onClick={() =>
                      run(async () => {
                        const payload = {
                          from: relation.from || item._id,
                          to: relation.to,
                          type: relation.type,
                          evidence: relation.evidence,
                          references: cleanReferences(
                            relation.references || item.references
                          ),
                        };
                        if (relation._id)
                          await api.put(
                            `/knowledge/relationships/${relation._id}`,
                            { ...payload, revision: relation.revision }
                          );
                        else
                          await api.post('/knowledge/relationships', payload);
                        setRelation({
                          to: '',
                          type: 'related_to',
                          evidence: '',
                        });
                        setRelations(
                          (
                            await api.get('/knowledge/relationships', {
                              params: { itemId: item._id },
                            })
                          ).data
                        );
                        setNotice('Relationship saved for review.');
                      })
                    }
                  >
                    Save relationship for review
                  </Button>
                </Stack>
                {item.history?.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant='h6'>Review history</Typography>
                    {item.history.map((h, i) => (
                      <Typography key={i}>
                        Revision {h.revision}: {h.action} ·{' '}
                        {new Date(h.at).toLocaleString()} {h.note}
                      </Typography>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Panel>
        )}
      </Stack>
    </Box>
  );
}
