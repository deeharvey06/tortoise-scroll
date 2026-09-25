import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@/test/render';
import { MemoryRouter } from 'react-router-dom';
import api from '@/services/api';
import SavedFilters from '@/components/SavedFilters';
import GlobalSearch from '@/components/GlobalSearch';
import ImportHistory from '@/pages/Import/ImportHistory';
import BulkEditDialog from '@/pages/Trades/BulkEditDialog';
import TableLayoutDialog from '@/pages/Trades/TableLayoutDialog';
import useFilterStore from '@/store/useFilterStore';
vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  useFilterStore.getState().reset();
});
afterEach(cleanup);
it('saved filters show empty/loading states, save current state and require delete confirmation', async () => {
  api.get.mockResolvedValue({ data: { savedFilters: [] } });
  api.put.mockImplementation(async (_, data) => ({ data }));
  useFilterStore.setState({ symbol: 'ES' });
  render(<SavedFilters />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
  expect(await screen.findByText('No saved filters')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Filter name'), {
    target: { value: 'ES Only' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save current filters' }));
  expect(await screen.findByText('ES Only')).toBeVisible();
  expect(api.put.mock.calls[0][1].savedFilters[0].filters.symbol).toBe('ES');
  fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
  expect(api.put).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Delete filter' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
  expect(api.put.mock.calls[1][1].savedFilters).toEqual([]);
});
it('failed preference reads cannot overwrite unknown saved filters', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  render(<SavedFilters />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
  expect(await screen.findByText(/Unable to load saved filters/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Filter name'), {
    target: { value: 'Example' },
  });
  expect(
    screen.getByRole('button', { name: 'Save current filters' })
  ).toBeDisabled();
});
it('global search has errors, retry, empty results and owned navigation links', async () => {
  api.get
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: { groups: [] } })
    .mockResolvedValue({
      data: {
        groups: [
          {
            type: 'trade',
            items: [
              {
                id: '1',
                label: 'ES',
                excerpt: 'Owned note',
                href: '/trades/1',
              },
            ],
          },
        ],
      },
    });
  render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Search workspace' }));
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'ES' } });
  expect(
    await screen.findByText('Search unavailable. Please retry.')
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No matching results')).toBeVisible();
  fireEvent.change(input, { target: { value: 'ES note' } });
  expect(
    await screen.findByRole('link', { name: /ES Owned note/ })
  ).toHaveAttribute('href', '/trades/1');
});
it('import history shows summaries and non-destructive duplicate review', async () => {
  const job = {
    _id: 'j',
    createdAt: '2026-01-01T00:00:00Z',
    originalFilename: 'sample.csv',
    broker: 'generic',
    accountName: 'Primary',
    summary: { imported: 1, duplicates: 1 },
    status: 'completed',
  };
  api.get.mockImplementation(async (path) => ({
    data: path.endsWith('/results')
      ? {
          ...job,
          rows: [
            {
              rowNumber: 2,
              outcome: 'duplicate',
              message: 'Skipped',
              tradeId: 't',
            },
          ],
        }
      : [job],
  }));
  render(
    <MemoryRouter>
      <ImportHistory />
    </MemoryRouter>
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'View results for sample.csv' })
  );
  expect(await screen.findByText('Skipped duplicate')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Review trade' })).toHaveAttribute(
    'href',
    '/trades/t'
  );
  expect(api.post).not.toHaveBeenCalled();
});
it('bulk edit needs explicit confirmation and sends only selected metadata', async () => {
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: { modifiedCount: 2 } });
  const done = vi.fn();
  render(<BulkEditDialog ids={['a', 'b']} onClose={() => {}} onSaved={done} />);
  await screen.findByLabelText('New value');
  fireEvent.change(screen.getByLabelText('New value'), {
    target: { value: 'H2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  await waitFor(() => expect(done).toHaveBeenCalledWith(2));
  expect(api.post).toHaveBeenCalledWith('/trades/bulk-edit', {
    ids: ['a', 'b'],
    changes: { setup: 'H2' },
  });
});
it('table ordering uses accessible buttons and protects required columns', () => {
  const setVisible = vi.fn();
  render(
    <TableLayoutDialog
      columns={[
        { id: 'entryTime', label: 'Date', required: true },
        { id: 'symbol', label: 'Symbol', required: true },
        { id: 'setup', label: 'Setup' },
      ]}
      visible={['entryTime', 'symbol', 'setup']}
      setVisible={setVisible}
      density='compact'
      setDensity={() => {}}
      onSave={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Table layout' }));
  expect(screen.getByRole('checkbox', { name: 'Date' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Move Setup earlier' }));
  expect(setVisible).toHaveBeenCalledWith(['entryTime', 'setup', 'symbol']);
});
