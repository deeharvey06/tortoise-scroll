import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mount a fresh provider when the authenticated user changes (see App).
export default function QueryProvider({ children }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            // Until all legacy mutations invalidate queries, refetch on navigation
            // and discard inactive results instead of showing outdated trade data.
            staleTime: 0,
            gcTime: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
