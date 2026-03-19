import { useState, useCallback } from 'react';
import type { SearchHistoryEntry, TravelMode } from '../types';
import { useLanguage } from '../i18n';

interface SearchHistoryProps {
  entries: SearchHistoryEntry[];
  onSelect: (entry: SearchHistoryEntry) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

const INITIAL_DISPLAY_COUNT = 5;

function TravelModeIcon({ mode }: { mode: TravelMode }) {
  switch (mode) {
    case 'WALKING':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="4" r="2" />
          <path d="M14 7h-4l-1 5h6l-1-5zM10 12l-2 10h2l1.5-5h1l1.5 5h2l-2-10" />
        </svg>
      );
    case 'BICYCLING':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5.5" cy="17.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18.5" cy="17.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 17.5l4-8.5h4l2 4.5h3M15 5h2l-1 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="4" r="1.5" />
        </svg>
      );
    case 'DRIVING':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11v6a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-6M5 11h14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="14" r="1" />
          <circle cx="16" cy="14" r="1" />
        </svg>
      );
  }
}

function formatRelativeTime(timestamp: number, t: (key: string) => string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('searchHistory.justNow');
  if (minutes < 60) return t('history.minutesAgo').replace('{{count}}', String(minutes));
  if (hours < 24) return t('history.hoursAgo').replace('{{count}}', String(hours));
  if (days === 1) return t('searchHistory.yesterday');
  return t('searchHistory.daysAgo').replace('{{count}}', String(days));
}

function travelModeLabel(mode: TravelMode, t: (key: string) => string): string {
  switch (mode) {
    case 'WALKING': return t('travel.walking');
    case 'BICYCLING': return t('travel.bicycling');
    case 'DRIVING': return t('travel.driving');
  }
}

export function SearchHistory({ entries, onSelect, onRemove, onClearAll }: SearchHistoryProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const handleClearAll = useCallback(() => {
    if (window.confirm(t('searchHistory.clearConfirm'))) {
      onClearAll();
    }
  }, [onClearAll, t]);

  if (entries.length === 0) return null;

  const displayed = expanded ? entries : entries.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMore = entries.length > INITIAL_DISPLAY_COUNT;

  return (
    <div className="history-section">
      <div className="history-header">
        <span className="history-title">{t('searchHistory.title')}</span>
        <button
          className="history-clear-btn"
          onClick={handleClearAll}
          aria-label={t('searchHistory.clearAll')}
        >
          {t('searchHistory.clearAll')}
        </button>
      </div>
      <div className="history-list" role="list">
        {displayed.map((entry) => {
          const timeStr = formatRelativeTime(entry.timestamp, t);
          const modeLabel = travelModeLabel(entry.travelMode, t);
          const ariaLabel = t('searchHistory.itemAriaLabel')
            .replace('{{origin}}', entry.originName)
            .replace('{{dest}}', entry.destName)
            .replace('{{mode}}', modeLabel)
            .replace('{{time}}', timeStr);

          return (
            <div key={entry.id} className="history-item" role="listitem">
              <button
                className="history-item-btn"
                onClick={() => onSelect(entry)}
                aria-label={ariaLabel}
              >
                <span className="history-item-mode" aria-hidden="true">
                  <TravelModeIcon mode={entry.travelMode} />
                </span>
                <span className="history-item-route">
                  <span className="history-item-names">
                    <span className="history-item-origin">{entry.originName}</span>
                    <span className="history-item-arrow" aria-hidden="true">&rarr;</span>
                    <span className="history-item-dest">{entry.destName}</span>
                  </span>
                  <span className="history-item-time">{timeStr}</span>
                </span>
              </button>
              <button
                className="history-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(entry.id);
                }}
                aria-label={t('searchHistory.deleteAriaLabel')
                  .replace('{{origin}}', entry.originName)
                  .replace('{{dest}}', entry.destName)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          className="history-toggle-btn"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? t('searchHistory.showLess') : t('searchHistory.showMore')}
        </button>
      )}
    </div>
  );
}
