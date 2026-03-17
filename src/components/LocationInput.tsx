import { useState, useRef, useCallback, useEffect } from 'react';
import { searchPlaces, type NominatimResult } from '../services/nominatimService';
import { useLanguage } from '../i18n';
import type { LocationPoint } from '../types';

interface LocationInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: NominatimResult) => void;
  isLoaded: boolean;
  icon: 'origin' | 'dest';
  currentLocation?: LocationPoint | null;
  onUseCurrentLocation?: () => void;
  showMyLocation?: boolean;
  isLoadingLocation?: boolean;
}

export function LocationInput({
  placeholder,
  value,
  onChange,
  onPlaceSelect,
  icon,
  onUseCurrentLocation,
  showMyLocation,
  isLoadingLocation,
}: LocationInputProps) {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleInputChange = useCallback(
    (text: string) => {
      onChange(text);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (text.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const results = await searchPlaces(text, controller.signal);
          if (!controller.signal.aborted) {
            setSuggestions(results);
            setShowDropdown(results.length > 0);
          }
        } catch {
          // Aborted or network error — ignore
        }
      }, 300);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (result: NominatimResult) => {
      onPlaceSelect(result);
      onChange(result.displayName);
      setSuggestions([]);
      setShowDropdown(false);
    },
    [onPlaceSelect, onChange]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="input-group-item" ref={wrapperRef}>
      <div className="input-wrapper">
        <span className={`input-icon ${icon}`}>
          {icon === 'origin' ? (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="5" fill="#43A047" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="5" fill="#E53935" />
            </svg>
          )}
        </span>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={(e) => e.key === 'Escape' && setShowDropdown(false)}
          className="location-input"
          autoComplete="off"
        />
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((result, i) => (
            <button
              key={i}
              className="autocomplete-item"
              onMouseDown={() => handleSelect(result)}
            >
              {result.displayName}
            </button>
          ))}
        </div>
      )}
      {showMyLocation && onUseCurrentLocation && (
        <button
          className="my-location-btn"
          onClick={onUseCurrentLocation}
          disabled={isLoadingLocation}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="#1565C0" />
            <circle cx="12" cy="12" r="8" stroke="#1565C0" strokeWidth="2" fill="none" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#1565C0" strokeWidth="2" />
          </svg>
          {isLoadingLocation ? t('location.locating') : t('location.useMyLocation')}
        </button>
      )}
    </div>
  );
}
