import { lazy, Suspense } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary, { PageErrorBoundary } from '@/components/ErrorBoundary';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function Broken() {
  throw new Error('Private diagnostic information');
}

it('renders healthy children without a fallback', () => {
  render(
    <ErrorBoundary>
      <div>Healthy view</div>
    </ErrorBoundary>
  );
  expect(screen.getByText('Healthy view')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('contains rendering errors and retries without exposing error details', () => {
  let broken = true;
  function Recoverable() {
    return broken ? <Broken /> : <div>Recovered view</div>;
  }
  render(
    <ErrorBoundary>
      <Recoverable />
    </ErrorBoundary>
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'This view couldn’t be displayed'
  );
  expect(screen.queryByText(/Private diagnostic/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
  broken = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByText('Recovered view')).toBeVisible();
});

it('keeps navigation mounted and clears a page error on navigation', () => {
  render(
    <MemoryRouter initialEntries={['/broken']}>
      <Link to='/healthy'>Open healthy page</Link>
      <PageErrorBoundary>
        <Routes>
          <Route path='/broken' element={<Broken />} />
          <Route path='/healthy' element={<div>Healthy destination</div>} />
        </Routes>
      </PageErrorBoundary>
    </MemoryRouter>
  );
  expect(screen.getByRole('alert')).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Open healthy page' }));
  expect(screen.getByText('Healthy destination')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('catches rejected lazy imports and offers a full reload', async () => {
  const FailedImport = lazy(() =>
    Promise.reject(new Error('Chunk unavailable'))
  );
  render(
    <ErrorBoundary>
      <Suspense fallback={<div>Opening page</div>}>
        <FailedImport />
      </Suspense>
    </ErrorBoundary>
  );
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
});
