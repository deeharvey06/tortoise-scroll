import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTortoiseTheme } from '../../theme/theme';
import ConfirmationDialog from './ConfirmationDialog';
import ProfitLossValue from './ProfitLossValue';
import RMultiple from './RMultiple';
import TradeDirection from './TradeDirection';

function renderWithTheme(node, mode = 'dark') {
  return render(<ThemeProvider theme={createTortoiseTheme(mode)}>{node}</ThemeProvider>);
}

describe('financial presentation components', () => {
  it('communicates P&L with sign, text, and semantic color', () => {
    renderWithTheme(<ProfitLossValue value={125.5} />);
    expect(screen.getByLabelText(/Profit:/)).toHaveTextContent('+$125.50');
  });

  it('formats R multiples and trade direction accessibly', () => {
    renderWithTheme(<><RMultiple value={-1.25} /><TradeDirection direction="short" /></>);
    expect(screen.getByLabelText('R multiple: -1.25 R')).toHaveTextContent('−1.25R');
    expect(screen.getByText('Short')).toBeVisible();
  });

  it('supports a labelled destructive confirmation', () => {
    renderWithTheme(<ConfirmationDialog open title="Delete trade?" description="This cannot be undone." onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Delete trade?' })).toBeVisible();
    expect(screen.getByText('This cannot be undone.')).toBeVisible();
  });
});
