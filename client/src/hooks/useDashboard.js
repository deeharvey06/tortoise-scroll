import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '@/services/analyticsService';
import { errorMessage } from '@/utils/errorMessage';

export default function useDashboard(params) {
  const query = useQuery({
    placeholderData: (previous) => previous,
    queryKey: ['dashboard', params],
    queryFn: ({ signal }) => fetchDashboard(params, signal),
  });

  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: errorMessage(query.error),
  };
}
