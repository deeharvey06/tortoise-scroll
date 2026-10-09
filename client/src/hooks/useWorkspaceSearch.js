import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { searchWorkspace } from '@/services/searchService';

export default function useWorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 300);
  const enabled = open && trimmed.length >= 2 && trimmed === debounced;

  const result = useQuery({
    queryKey: ['workspaceSearch', debounced],
    queryFn: ({ signal }) => searchWorkspace(debounced, signal),
    enabled,
  });

  return {
    open,
    setOpen,
    query,
    setQuery,
    groups: enabled ? (result.data ?? []) : [],
    busy: open && trimmed.length >= 2 && (!enabled || result.isFetching),
    error: enabled && result.isError ? 'Search unavailable. Please retry.' : '',
    retry: () => result.refetch(),
  };
}
