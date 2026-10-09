import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '@/services/analyticsService';
import { fetchStrategies } from '@/services/strategyService';
import { withStrategyLabels } from '@/utils/strategyLabels';
import { errorMessage } from '@/utils/errorMessage';

export default function useAnalytics(params) {
  const query = useQuery({
    placeholderData: (previous) => previous,
    queryKey: ['analytics', params],
    queryFn: async ({ signal }) => {
      const [data, strategies] = await Promise.all([
        fetchDashboard(params, signal),
        fetchStrategies(signal),
      ]);

      return withStrategyLabels(data, strategies);
    },
  });

  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: errorMessage(query.error),
  };
}
