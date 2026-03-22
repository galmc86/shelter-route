import { useState, useCallback } from 'react';
import type { SearchHistoryEntry, TravelMode } from '../types';
import { useLanguage } from '../i18n';

interface SearchHistoryProps {
  entries: SearchHistoryEntry[];
  onSelect: (entry: SearchHistoryEntry) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, label: string) => void;
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

export function SearchHistory({ entries, onSelect, onRemove, onClearAll, onTogglePin, onRename }: SearchHistoryProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const handleClearAll = useCallback(() => {
    if (window.confirm(t('searchHistory.clearConfirm'))) {
      onClearAll();
    }
  }, [onClearAll, t]);

  const handleRename = useCallback((entry: SearchHistoryEntry) => {
    const newLabel = window.prompt(t('searchHistory.renamePrompt'), entry.label || '');
    if (newLabel !== null) {
      onRename(entry.id, newLabel);
    }
  }, [onRename, t]);

  if (entries.length === 0) return null;

  // Sort: pinned first, then by timestamp
  const sorted = [...entries].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0; // preserve insertion order within same pin status
  });

  const displayed = expanded ? sorted : sorted.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMore = sorted.length > INITIAL_DISPLAY_COUNT;

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
          const timeStr = formatRelativeTime(entry.timestamp, t as (key: string) => string);
          const modeLabel = travelModeLabel(entry.travelMode, t as (key: string) => string);
          const ariaLabel = t('searchHistory.itemAriaLabel')
            .replace('{{origin}}', entry.originName)
            .replace('{{dest}}', entry.destName)
            .replace('{{mode}}', modeLabel)
            .replace('{{time}}', timeStr);

          return (
            <div key={entry.id} className={`history-item ${entry.pinned ? 'history-item-pinned' : ''}`} role="listitem">
              <button
                className="history-item-btn"
                onClick={() => onSelect(entry)}
                aria-label={ariaLabel}
              >
                <span className="history-item-mode" aria-hidden="true">
                  <TravelModeIcon mode={entry.travelMode} />
                </span>
                <span className="history-item-route">
                  {entry.label ? (
                    <span className="history-item-label">{entry.label}</span>
                  ) : (
                    <span className="history-item-names">
                      <span className="history-item-origin">{entry.originName}</span>
                      <span className="history-item-arrow" aria-hidden="true">&rarr;</span>
                      <span className="history-item-dest">{entry.destName}</span>
                    </span>
                  )}
                  <span className="history-item-meta">
                    <span className="history-item-time">{timeStr}</span>
                    {entry.routeData ? (
                      <>
                        <span className="history-item-route-data">
                          <span className="history-item-route-stat">{entry.routeData.duration}</span>
                          <span className="history-item-route-sep">|</span>
                          <span className="history-item-route-stat">{entry.routeData.distance}</span>
                        </span>
                        <span className="history-item-shelters">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                          </svg>
                          {entry.routeData.shelterCount} {t('searchHistory.shelters')}
                        </span>
                        <span className="history-item-saved-badge">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                          {t('savedRoutes.saved')}
                        </span>
                      </>
                    ) : (
                      <>
                        {entry.shelterCount !== undefined && entry.shelterCount > 0 && (
                          <span className="history-item-shelters">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                            </svg>
                            {entry.shelterCount} {t('searchHistory.shelters')}
                          </span>
                        )}
                      </>
                    )}
                    {entry.pinned && (
                      <span className="history-item-pinned-badge">{t('searchHistory.pinned')}</span>
                    )}
                  </span>
                  {entry.label && (
                    <span className="history-item-names history-item-names-sub">
                      <span className="history-item-origin">{entry.originName}</span>
                      <span className="history-item-arrow" aria-hidden="true">&rarr;</span>
                      <span className="history-item-dest">{entry.destName}</span>
                    </span>
                  )}
                </span>
              </button>
              <div className="history-item-actions">
                <button
                  className={`history-pin-btn ${entry.pinned ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(entry.id);
                  }}
                  aria-label={
                    (entry.pinned ? t('searchHistory.unpinAriaLabel') : t('searchHistory.pinAriaLabel'))
                      .replace('{{origin}}', entry.originName)
                      .replace('{{dest}}', entry.destName)
                  }
                  aria-pressed={!!entry.pinned}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={entry.pinned ? 'currentColor' : 'none'} aria-hidden="true">
                    <path d="M16 4l-1.5 1.5L17 8l-4 4-5-1L6 13l5 5 2-2-1-5 4-4 2.5 2.5L20 8l-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 20l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  className="history-rename-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename(entry);
                  }}
                  aria-label={t('searchHistory.rename')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
