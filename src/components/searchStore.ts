// src/components/searchStore.ts
import type { SearchStore } from '../types';

/** Creates a tiny external store shared between the palette list and the status bar. */
export function createSearchStore(): SearchStore {
  let query = '';
  let active = false;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const fn of listeners) fn();
  };
  return {
    getQuery: () => query,
    getActive: () => active,
    setQuery(q) {
      query = q;
      emit();
    },
    setActive(a) {
      active = a;
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
