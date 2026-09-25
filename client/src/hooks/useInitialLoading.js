import { useState } from 'react';

// Refreshes keep their content mounted; only the first request uses a skeleton.
// A different resource identity must start with its own loading state.
export default function useInitialLoading(loading, identity = 'page') {
  const [state, setState] = useState({ identity, settled: !loading });

  if (state.identity !== identity) {
    setState({ identity, settled: !loading });
    return loading;
  }

  if (!loading && !state.settled) {
    setState({ identity, settled: true });
  }

  return loading && !state.settled;
}
