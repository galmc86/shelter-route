import { useLanguage } from '../i18n';
import './EmergencyButton.css';

interface EmergencyButtonProps {
  onClick: () => void;
  anchorState?: 'collapsed' | 'expanded' | 'section';
  bottomOffsetPx?: number | null;
}

export function EmergencyButton({ onClick, anchorState = 'collapsed', bottomOffsetPx }: EmergencyButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      className={`emergency-fab${anchorState === 'expanded' ? ' fab-panel-expanded' : ''}${anchorState === 'section' ? ' fab-section-open' : ''}`}
      onClick={onClick}
      aria-label={t('emergency.findShelter')}
      title={t('emergency.findShelter')}
      style={bottomOffsetPx != null ? { bottom: `${bottomOffsetPx}px` } : undefined}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
          fill="white"
        />
        <path
          d="M12 7v6M12 15v1"
          stroke="#D32F2F"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
