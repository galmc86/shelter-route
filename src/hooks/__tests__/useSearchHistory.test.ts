import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '../useSearchHistory';

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.entries).toEqual([]);
  });

  it('adds an entry', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addEntry({
        origin: { lat: 32.0, lng: 34.78 },
        destination: { lat: 32.1, lng: 34.79 },
        originName: 'Tel Aviv',
        destName: 'Jerusalem',
        travelMode: 'WALKING',
      });
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].originName).toBe('Tel Aviv');
    expect(result.current.entries[0].id).toBeTruthy();
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addEntry({
        origin: { lat: 32.0, lng: 34.78 },
        destination: { lat: 32.1, lng: 34.79 },
        originName: 'A',
        destName: 'B',
        travelMode: 'DRIVING',
      });
    });

    const raw = localStorage.getItem('shelter-route:search-history');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.entries).toHaveLength(1);
  });

  it('loads entries from localStorage on mount', () => {
    localStorage.setItem(
      'shelter-route:search-history',
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'loaded',
            origin: { lat: 32.0, lng: 34.78 },
            destination: { lat: 32.1, lng: 34.79 },
            originName: 'Saved',
            destName: 'Route',
            travelMode: 'WALKING',
            timestamp: Date.now(),
          },
        ],
      })
    );

    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].originName).toBe('Saved');
  });

  it('removes an entry', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addEntry({
        origin: { lat: 32.0, lng: 34.78 },
        destination: { lat: 32.1, lng: 34.79 },
        originName: 'A',
        destName: 'B',
        travelMode: 'WALKING',
      });
    });

    const id = result.current.entries[0].id;

    act(() => {
      result.current.removeEntry(id);
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it('clears all entries', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addEntry({
        origin: { lat: 32.0, lng: 34.78 },
        destination: { lat: 32.1, lng: 34.79 },
        originName: 'A',
        destName: 'B',
        travelMode: 'WALKING',
      });
      result.current.addEntry({
        origin: { lat: 33.0, lng: 35.0 },
        destination: { lat: 33.1, lng: 35.1 },
        originName: 'C',
        destName: 'D',
        travelMode: 'DRIVING',
      });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it('toggles pin on entry', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addEntry({
        origin: { lat: 32.0, lng: 34.78 },
        destination: { lat: 32.1, lng: 34.79 },
        originName: 'A',
        destName: 'B',
        travelMode: 'WALKING',
      });
    });

    const id = result.current.entries[0].id;

    act(() => {
      result.current.togglePin(id);
    });

    expect(result.current.entries[0].pinned).toBe(true);

    act(() => {
      result.current.togglePin(id);
    });

    expect(result.current.entries[0].pinned).toBe(false);
  });

  it('deduplicates same search', () => {
    const { result } = renderHook(() => useSearchHistory());
    const entry = {
      origin: { lat: 32.0, lng: 34.78 },
      destination: { lat: 32.1, lng: 34.79 },
      originName: 'A',
      destName: 'B',
      travelMode: 'WALKING' as const,
    };

    act(() => {
      result.current.addEntry(entry);
    });

    act(() => {
      result.current.addEntry(entry);
    });

    expect(result.current.entries).toHaveLength(1);
  });
});
