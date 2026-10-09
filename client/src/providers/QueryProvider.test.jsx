import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import QueryProvider from '@/providers/QueryProvider';

it('isolates query data when the session provider is replaced, including StrictMode', async () => {
  const load = vi.fn().mockResolvedValueOnce('First user');
  function Consumer() {
    const { data } = useQuery({ queryKey: ['private-data'], queryFn: load });
    return <div>{data || 'Loading'}</div>;
  }
  const view = (session) => (
    <StrictMode>
      <QueryProvider key={session}>
        <Consumer />
      </QueryProvider>
    </StrictMode>
  );
  const { rerender } = render(view('first'));
  expect(await screen.findByText('First user')).toBeVisible();
  load.mockImplementation(() => new Promise(() => {}));
  rerender(view('second'));
  expect(screen.queryByText('First user')).not.toBeInTheDocument();
  expect(screen.getByText('Loading')).toBeVisible();
  await waitFor(() => expect(load.mock.calls.length).toBeGreaterThan(1));
});
