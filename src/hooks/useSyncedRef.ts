import { useRef, useEffect } from 'react';

/** A ref that stays in sync with the given state value. */
export function useSyncedRef<T>(state: T) {
  const ref = useRef(state);
  useEffect(() => { ref.current = state; }, [state]);
  return ref;
}
