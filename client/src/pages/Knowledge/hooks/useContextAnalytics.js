import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { compareContext } from '@/services/contextAnalyticsService';
import { errorMessage } from '@/utils/errorMessage';

export default function useContextAnalytics(initialIds, filters) {
  const [review, setReview] = useState({});
  const [knowledgeIds, setIds] = useState(initialIds);
  const [followedPlan, setPlan] = useState('');
  const [scenarioMatched, setScenario] = useState('');
  const [process, setProcess] = useState('');
  const params = {
    ...filters,
    review,
    knowledgeIds,
    followedPlan: followedPlan === '' ? null : followedPlan === 'true',
    scenarioMatched: scenarioMatched === '' ? null : scenarioMatched === 'true',
    process: process || undefined,
  };
  const key = JSON.stringify(params);
  const result = useMutation({
    mutationFn: ({ params }) => compareContext(params),
  });
  // Results only describe the submitted inputs. Derive visibility instead of
  // resetting state in an effect, including while an earlier request is pending.
  const matches = result.variables?.key === key;
  return {
    review,
    setReview,
    knowledgeIds,
    setIds,
    followedPlan,
    setPlan,
    scenarioMatched,
    setScenario,
    process,
    setProcess,
    data: matches ? result.data : null,
    error: matches ? errorMessage(result.error) : null,
    busy: matches && result.isPending,
    load: () => result.mutate({ params, key }),
  };
}
