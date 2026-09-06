import { useQuery } from '@tanstack/react-query';
import { caseService } from '../services/api';

const POLL_INTERVAL = 2000;
const MAX_INTERVAL = 10000;

export function useJobPolling(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => caseService.getJob(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL;
      if (data.status === 'succeeded' || data.status === 'failed') {
        return false; // 停止轮询
      }
      return POLL_INTERVAL;
    },
    staleTime: 1000,
  });
}
