import { useQuery } from '@tanstack/react-query';
import { checkHealth } from '@/services/api';

export default function useApiHealth() {
  const { isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
  });

  const status = isPending ? 'checking' : isError ? 'offline' : 'online';

  const label = {
    checking: 'Checking API',
    offline: 'API unreachable',
    online: 'API connected',
  }[status];

  return { status, label };
}
