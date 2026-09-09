import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GlobalFilterBar from './GlobalFilterBar';
import useFilterStore from '../store/useFilterStore';

const { fetchAccounts } = vi.hoisted(() => ({ fetchAccounts: vi.fn() }));

vi.mock('../services/tradeService', () => ({
  fetchAccounts,
}));

describe('GlobalFilterBar', () => {
  afterEach(() => {
    useFilterStore.getState().reset();
  });

  it('loads accounts and applies an account filter', async () => {
    fetchAccounts.mockResolvedValue([
      { _id: 'account-1', name: 'Primary account' },
    ]);
    render(<GlobalFilterBar />);
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    });
    const accountSelect = await screen.findByLabelText('Account');
    await act(async () => {
      fireEvent.mouseDown(accountSelect);
    });
    const accountOption = await screen.findByRole('option', {
      name: 'Primary account',
    });
    await act(async () => {
      fireEvent.click(accountOption);
    });

    await waitFor(() => {
      expect(useFilterStore.getState().accountId).toBe('account-1');
    });
    expect(
      screen.getByText('Primary account', { selector: '.MuiChip-label' }),
    ).toBeVisible();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });
    await waitFor(() =>
      expect(accountSelect).toHaveAttribute('aria-expanded', 'false'),
    );
  });
});
