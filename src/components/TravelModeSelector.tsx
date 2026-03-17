import { useLanguage } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { TravelMode } from '../types';

interface TravelModeSelectorProps {
  selected: TravelMode;
  onSelect: (mode: TravelMode) => void;
}

const MODES: { mode: TravelMode; icon: string; labelKey: TranslationKey }[] = [
  { mode: 'WALKING', icon: 'walk', labelKey: 'travel.walking' },
  { mode: 'BICYCLING', icon: 'bike', labelKey: 'travel.bicycling' },
  { mode: 'DRIVING', icon: 'car', labelKey: 'travel.driving' },
];

function ModeIcon({ type }: { type: string }) {
  switch (type) {
    case 'walk':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="4.5" r="2" />
          <path d="M10.5 8.5L8 21h2l1.5-7 2 2v5h2v-6.5l-2-2.5.5-3C15.5 10 17 11 19 11v-2c-1.5 0-3-1-3.5-2L14 5.5c-.5-1-1.5-1.5-2.5-1.5S9 5 8 6.5L6 10l4 2z" />
        </svg>
      );
    case 'bike':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zM10.8 8.5l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V7c-1.4 0-2.5-.5-3.4-1.4L13.4 3.5c-.5-.5-1.1-.8-1.9-.8-.6 0-1.2.2-1.6.7L7.2 6.1c-.4.4-.7 1-.7 1.6 0 .8.4 1.4.9 1.8L11 12.4V17h2v-6.2l-2.2-2.3z" />
        </svg>
      );
    case 'car':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
      );
    default:
      return null;
  }
}

export function TravelModeSelector({ selected, onSelect }: TravelModeSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="travel-modes">
      {MODES.map(({ mode, icon, labelKey }) => (
        <button
          key={mode}
          className={`mode-btn ${selected === mode ? 'active' : ''}`}
          onClick={() => onSelect(mode)}
        >
          <span className="mode-icon">
            <ModeIcon type={icon} />
          </span>
          <span className="mode-label">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
