import { useQuery } from '@tanstack/react-query';
import { fetchReport } from '@/services/reportsService';
import { fetchStrategies } from '@/services/strategyService';
import { withStrategyLabels } from '@/utils/strategyLabels';
import { errorMessage } from '@/utils/errorMessage';

export default function useReport(category, params) {
  const query = useQuery({
    placeholderData: (previous, query) =>
      query?.queryKey[1] === category ? previous : undefined,
    queryKey: ['reports', category, params],
    queryFn: async ({ signal }) => {
      if (category !== 'market') return fetchReport(category, params, signal);
      const [report, strategies] = await Promise.all([
        fetchReport(category, params, signal),
        fetchStrategies(signal),
      ]);
      return withStrategyLabels(report, strategies);
    },
  });
  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: errorMessage(query.error),
  };
}
