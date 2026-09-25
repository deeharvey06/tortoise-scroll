import { useQuery } from '@tanstack/react-query';
import { fetchAccounts } from '@/services/tradeService';
import { fetchStrategies } from '@/services/strategyService';

export default function useFilterOptions(open) {
  const accounts = useQuery({
    queryKey: ['filterAccounts'],
    queryFn: ({ signal }) => fetchAccounts(signal),
  });

  const strategies = useQuery({
    queryKey: ['filterStrategies'],
    queryFn: ({ signal }) => fetchStrategies(signal),
    enabled: open,
  });

  return {
    accounts: accounts.data ?? [],
    strategies: strategies.data ?? [],
    optionsError: strategies.isError
      ? 'Strategies unavailable. Close and reopen filters to retry.'
      : '',
  };
}
