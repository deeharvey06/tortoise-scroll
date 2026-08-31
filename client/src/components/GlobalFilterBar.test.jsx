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

vi.mock('../services/tradeService', () => ({
  fetchAccounts: vi
    .fn()
    .mockResolvedValue([{ _id: 'account-1', name: 'Primary account' }]),
}));

describe('GlobalFilterBar', () => {
  afterEach(() => {
    useFilterStore.getState().reset();
  });

  it('loads accounts and applies an account filter', async () => {
    render(<GlobalFilterBar />);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Filters' })));
    const accountSelect = await screen.findByLabelText('Account');
    act(() => fireEvent.mouseDown(accountSelect));
    const accountOption = await screen.findByRole('option', {
      name: 'Primary account',
    });
    act(() => fireEvent.click(accountOption));

    await waitFor(() => {
      expect(useFilterStore.getState().accountId).toBe('account-1');
    });
    expect(
      screen.getByText('Primary account', { selector: '.MuiChip-label' }),
    ).toBeVisible();
  });
});
