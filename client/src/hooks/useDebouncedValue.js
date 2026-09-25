import { useEffect, useState } from 'react';

export default function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  // Synchronize a browser timer; requests belong to query hooks.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
