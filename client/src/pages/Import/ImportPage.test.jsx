import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImportPage from './ImportPage';
import * as importApi from '../../services/importService';
import * as tradeApi from '../../services/tradeService';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../../services/importService', () => ({
  fetchAdapters: vi.fn(),
  previewCsv: vi.fn(),
  commitCsv: vi.fn(),
}));
vi.mock('../../services/tradeService', () => ({ fetchAccounts: vi.fn() }));

describe('ImportPage execution workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importApi.fetchAdapters.mockResolvedValue([
      { key: 'generic', label: 'Generic CSV', mode: 'trade' },
      { key: 'thinkorswim', label: 'Thinkorswim', mode: 'execution' },
    ]);
    tradeApi.fetchAccounts.mockResolvedValue([{ _id: 'a1', name: 'Main' }]);
  });

  it('shows execution-level validation instead of completed-trade mapping for Thinkorswim', async () => {
    importApi.previewCsv.mockResolvedValue({
      mode: 'execution',
      headers: ['Exec Time', 'Side', 'Qty', 'Symbol', 'Price'],
      totalRows: 3,
      previewRows: [
        {
          'Exec Time': '09/01/2026 09:30:00',
          Side: 'BOT',
          Qty: '2',
          Symbol: '/ESU26',
          Price: '6000',
        },
      ],
      suggestedMapping: {},
      executionSummary: { executionsDetected: 3, rejectedRows: 0, warnings: 0 },
      validationErrors: [],
      validationWarnings: [],
    });

    const { container } = render(<ImportPage />);
    await waitFor(() => expect(importApi.fetchAdapters).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByLabelText('Broker format'));
    fireEvent.click(await screen.findByRole('option', { name: 'Thinkorswim' }));

    const input = container.querySelector('input[type="file"]');
    const file = new File(['Trade History'], 'tos.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('Execution format detected')).toBeVisible();
    expect(screen.getByText(/3 valid executions/)).toBeVisible();
    expect(
      screen.queryByText('Direction (long/short) *')
    ).not.toBeInTheDocument();
  });

  it('renders execution reconstruction result counts', async () => {
    importApi.previewCsv.mockResolvedValue({
      mode: 'execution',
      headers: ['Exec Time', 'Side', 'Qty', 'Symbol', 'Price'],
      totalRows: 3,
      previewRows: [
        {
          'Exec Time': 't',
          Side: 'BOT',
          Qty: '2',
          Symbol: '/ESU26',
          Price: '6000',
        },
      ],
      suggestedMapping: {},
      executionSummary: { executionsDetected: 3, rejectedRows: 0, warnings: 0 },
      validationErrors: [],
      validationWarnings: [],
    });
    importApi.commitCsv.mockResolvedValue({
      mode: 'execution',
      summary: {
        imported: 1,
        duplicates: 0,
        errors: 0,
        executionsDetected: 3,
        executionsImported: 3,
        tradesReconstructed: 1,
        tradesUpdated: 0,
        openPositions: 0,
        warnings: 0,
        rejectedRows: 0,
      },
      rows: [],
    });
    const { container } = render(<ImportPage />);
    await waitFor(() => expect(importApi.fetchAdapters).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByLabelText('Broker format'));
    fireEvent.click(await screen.findByRole('option', { name: 'Thinkorswim' }));
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'tos.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('Execution format detected');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /Import into account/ })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Main' }));
    fireEvent.click(screen.getByRole('button', { name: /^Import 3 rows$/ }));

    expect(await screen.findByText('3 executions detected')).toBeVisible();
    expect(screen.getByText('1 trades reconstructed')).toBeVisible();
    expect(screen.getByText('0 open positions')).toBeVisible();
  });
});
