import { useState, useCallback } from 'react';
import type { SearchHistoryEntry } from '../types';
import {
  loadHistory,
  saveHistory,
  addToHistory,
  removeFromHistory,
  clearHistory as clearHistoryEntries,
  togglePin as togglePinEntry,
} from '../services/searchHistoryService';

export interface UseSearchHistoryReturn {
  entries: SearchHistoryEntry[];
  addEntry: (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  togglePin: (id: string) => void;
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>(() => loadHistory());

  const addEntry = useCallback(
    (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => {
      setEntries((prev) => {
        const updated = addToHistory(prev, entry);
        saveHistory(updated);
        return updated;
      });
    },
    []
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = removeFromHistory(prev, id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries((prev) => {
      const updated = clearHistoryEntries(prev);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = togglePinEntry(prev, id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  return { entries, addEntry, removeEntry, clearAll, togglePin };
}
