import { Button, Stack, TextField, Typography } from '@mui/material';
import { KnowledgePicker } from '@/pages/Knowledge/shared';

const empty = {
  knowledgeIds: [],
  priorDay: '',
  overnight: '',
  gap: '',
  openingExpectation: '',
  riskConsiderations: '',
  levels: [],
  scenarios: [],
};

export default function PreparationEditor({ value, onChange }) {
  const state = { ...empty, ...value };
  const set = (key, v) => onChange({ ...state, [key]: v });

  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Typography variant='h6'>Structured pre-market preparation</Typography>
      <KnowledgePicker
        value={state.knowledgeIds}
        onChange={(v) => set('knowledgeIds', v)}
      />
      {[
        ['priorDay', 'Prior-day context'],
        ['overnight', 'Overnight / Globex context'],
        ['gap', 'Gap context'],
        ['openingExpectation', 'Expected opening behavior'],
        ['riskConsiderations', 'Risk considerations'],
      ].map(([key, label]) => (
        <TextField
          key={key}
          label={label}
          multiline
          value={state[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      ))}

      <Typography fontWeight={600}>Important levels</Typography>
      {state.levels.map((level, i) => (
        <Stack key={i} spacing={1} direction={{ xs: 'column', sm: 'row' }}>
          {['label', 'price', 'timeframe'].map((key) => (
            <TextField
              key={key}
              label={`Level ${key}`}
              type={key === 'price' ? 'number' : 'text'}
              value={level[key]}
              onChange={(e) =>
                set(
                  'levels',
                  state.levels.map((v, n) =>
                    n === i
                      ? {
                          ...v,
                          [key]:
                            key === 'price'
                              ? Number(e.target.value)
                              : e.target.value,
                        }
                      : v
                  )
                )
              }
            />
          ))}

          <Button
            onClick={() =>
              set(
                'levels',
                state.levels.filter((_, n) => n !== i)
              )
            }
          >
            Remove level
          </Button>
        </Stack>
      ))}

      <Button
        onClick={() =>
          set('levels', [
            ...state.levels,
            { label: '', price: 0, timeframe: '' },
          ])
        }
      >
        Add important level
      </Button>
      <Typography fontWeight={600}>Scenarios</Typography>
      {state.scenarios.map((scenario, i) => (
        <Stack key={scenario._id || i} spacing={2}>
          {[
            ['name', 'Scenario name'],
            ['condition', 'IF'],
            ['context', 'THEN CONTEXT'],
            ['lookFor', 'LOOK FOR'],
            ['avoid', 'AVOID'],
            ['invalidatedBy', 'INVALIDATED BY'],
          ].map(([key, label]) => (
            <TextField
              key={key}
              label={label}
              multiline
              value={scenario[key]}
              onChange={(e) =>
                set(
                  'scenarios',
                  state.scenarios.map((v, n) =>
                    n === i ? { ...v, [key]: e.target.value } : v
                  )
                )
              }
            />
          ))}
          <KnowledgePicker
            value={scenario.knowledgeIds}
            onChange={(ids) =>
              set(
                'scenarios',
                state.scenarios.map((v, n) =>
                  n === i ? { ...v, knowledgeIds: ids } : v
                )
              )
            }
            label='Scenario methodology / planned setups'
          />
          <Button
            onClick={() =>
              set(
                'scenarios',
                state.scenarios.filter((_, n) => n !== i)
              )
            }
          >
            Remove scenario
          </Button>
        </Stack>
      ))}
      <Button
        onClick={() =>
          set('scenarios', [
            ...state.scenarios,
            {
              name: '',
              condition: '',
              context: '',
              lookFor: '',
              avoid: '',
              invalidatedBy: '',
              knowledgeIds: [],
            },
          ])
        }
      >
        Add scenario
      </Button>
    </Stack>
  );
}

export function PreparationSummary({ value }) {
  if (!value) return null;

  return (
    <Stack spacing={1} sx={{ mt: 2 }}>
      <Typography fontWeight={600}>Structured preparation</Typography>
      {[
        ['priorDay', 'Prior day'],
        ['overnight', 'Overnight'],
        ['gap', 'Gap'],
        ['openingExpectation', 'Opening expectation'],
        ['riskConsiderations', 'Risk considerations'],
      ]
        .filter(([key]) => value[key])
        .map(([key, label]) => (
          <Typography key={key} sx={{ whiteSpace: 'pre-wrap' }}>
            {label}: {value[key]}
          </Typography>
        ))}
      {value.levels?.map((level, i) => (
        <Typography key={i}>
          {level.label}: {level.price} {level.timeframe}
        </Typography>
      ))}
      {value.scenarios?.map((s) => (
        <Stack key={s._id || s.name} spacing={0.5}>
          <Typography fontWeight={600}>{s.name}</Typography>
          {[
            ['condition', 'IF'],
            ['context', 'THEN CONTEXT'],
            ['lookFor', 'LOOK FOR'],
            ['avoid', 'AVOID'],
            ['invalidatedBy', 'INVALIDATED BY'],
          ]
            .filter(([key]) => s[key])
            .map(([key, label]) => (
              <Typography key={key} sx={{ whiteSpace: 'pre-wrap' }}>
                {label}: {s[key]}
              </Typography>
            ))}
        </Stack>
      ))}
    </Stack>
  );
}
