import { LocationInput } from './LocationInput';
import { TravelModeSelector } from './TravelModeSelector';
import { SearchHistory } from './SearchHistory';
import type { TranslationKey } from '../i18n';
import type { PlaceResult, SearchHistoryEntry, TravelMode } from '../types';
import type { LocationPoint } from '../types';

interface SearchPanelRouteModeProps {
  t: (key: TranslationKey) => string;
  originText: string;
  destText: string;
  travelMode: TravelMode;
  isLoaded: boolean;
  isSearching: boolean;
  isLoadingLocation: boolean;
  currentLocation: LocationPoint | null;
  canSearch: boolean;
  historyEntries: SearchHistoryEntry[];
  onSetOriginText: (value: string) => void;
  onSetDestText: (value: string) => void;
  onSetOriginPlace: (place: PlaceResult | null) => void;
  onSetDestPlace: (place: PlaceResult | null) => void;
  onSetTravelMode: (mode: TravelMode) => void;
  onSetUseMyLocation: (value: boolean) => void;
  onUseCurrentLocation: () => void;
  onSearch: () => void;
  onHistorySelect: (entry: SearchHistoryEntry) => void;
  onRemoveHistory: (id: string) => void;
  onClearHistory: () => void;
  onToggleHistoryPin: (id: string) => void;
  onRenameHistory: (id: string, label: string) => void;
}

export function SearchPanelRouteMode({
  t,
  originText,
  destText,
  travelMode,
  isLoaded,
  isSearching,
  isLoadingLocation,
  currentLocation,
  canSearch,
  historyEntries,
  onSetOriginText,
  onSetDestText,
  onSetOriginPlace,
  onSetDestPlace,
  onSetTravelMode,
  onSetUseMyLocation,
  onUseCurrentLocation,
  onSearch,
  onHistorySelect,
  onRemoveHistory,
  onClearHistory,
  onToggleHistoryPin,
  onRenameHistory,
}: SearchPanelRouteModeProps) {
  return (
    <>
      <div className="panel-section">
        <div className="section-label" id="route-label">{t('search.sectionRoute')}</div>
        <div className="inputs-container" role="group" aria-labelledby="route-label">
          <LocationInput
            placeholder={t('search.placeholder.origin')}
            value={originText}
            onChange={(value) => {
              onSetOriginText(value);
              onSetUseMyLocation(false);
            }}
            onPlaceSelect={(place) => {
              onSetOriginPlace(place);
              onSetUseMyLocation(false);
            }}
            isLoaded={isLoaded}
            icon="origin"
            showMyLocation
            onUseCurrentLocation={onUseCurrentLocation}
            isLoadingLocation={isLoadingLocation}
            currentLocation={currentLocation}
          />
          <LocationInput
            placeholder={t('search.placeholder.dest')}
            value={destText}
            onChange={onSetDestText}
            onPlaceSelect={onSetDestPlace}
            isLoaded={isLoaded}
            icon="dest"
          />
        </div>
      </div>

      <div className="panel-section">
        <div className="section-label" id="travel-label">{t('search.sectionTransport')}</div>
        <TravelModeSelector
          selected={travelMode}
          onSelect={onSetTravelMode}
        />
      </div>

      <div className="search-btn-wrapper">
        <button
          className="search-btn"
          onClick={onSearch}
          disabled={!canSearch}
          title={!canSearch ? t('search.button.tooltip') : undefined}
          aria-label={canSearch ? t('search.button.ariaEnabled') : t('search.button.ariaDisabled')}
        >
          {isSearching ? (
            <>
              <span className="loading-spinner small" aria-hidden="true" />
              {t('search.searching')}
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="7" stroke="white" strokeWidth="2.5" />
                <path d="M16 16l5.5 5.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              {t('search.button')}
            </>
          )}
        </button>
        {!canSearch && (
          <span className="search-btn-tooltip" aria-hidden="true">
            {t('search.button.tooltip')}
          </span>
        )}
      </div>

      {historyEntries.length > 0 && (
        <SearchHistory
          entries={historyEntries}
          onSelect={onHistorySelect}
          onRemove={onRemoveHistory}
          onClearAll={onClearHistory}
          onTogglePin={onToggleHistoryPin}
          onRename={onRenameHistory}
        />
      )}
    </>
  );
}
