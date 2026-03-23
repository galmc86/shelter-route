import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng, PlaceResult, SearchHistoryEntry, TravelMode } from '../types';
import type { ShelterWithDistance } from './useShelters';
import type { TranslationKey } from '../i18n/translations';

interface UseSearchPanelRoutePlannerOptions {
  routeInfo: unknown;
  sheltersLoading: boolean;
  nearbyShelters: ShelterWithDistance[];
  shareOrigin: LatLng | null;
  shareDestination: LatLng | null;
  shareTravelMode: TravelMode;
  currentLocation: LatLng | null;
  onSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  onGetLocation: () => void;
  addHistoryEntry: (entry: {
    origin: LatLng;
    destination: LatLng;
    originName: string;
    destName: string;
    travelMode: TravelMode;
  }) => void;
  updateHistoryShelterCount: (
    origin: LatLng,
    destination: LatLng,
    travelMode: TravelMode,
    shelterCount: number
  ) => void;
  t: (key: TranslationKey) => string;
}

export function useSearchPanelRoutePlanner({
  routeInfo,
  sheltersLoading,
  nearbyShelters,
  shareOrigin,
  shareDestination,
  shareTravelMode,
  currentLocation,
  onSearch,
  onGetLocation,
  addHistoryEntry,
  updateHistoryShelterCount,
  t,
}: UseSearchPanelRoutePlannerOptions) {
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originPlace, setOriginPlace] = useState<PlaceResult | null>(null);
  const [destPlace, setDestPlace] = useState<PlaceResult | null>(null);
  const [travelMode, setTravelModeState] = useState<TravelMode>('WALKING');
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const hasSearchedRef = useRef(false);

  const currentOrigin = useMemo<LatLng | null>(() => {
    if (shareOrigin) return shareOrigin;
    if (useMyLocation && currentLocation) {
      return { lat: currentLocation.lat, lng: currentLocation.lng };
    }
    if (originPlace) {
      return { lat: originPlace.lat, lng: originPlace.lng };
    }
    return null;
  }, [shareOrigin, useMyLocation, currentLocation, originPlace]);

  const currentDestination = useMemo<LatLng | null>(() => {
    if (shareDestination) return shareDestination;
    if (destPlace) {
      return { lat: destPlace.lat, lng: destPlace.lng };
    }
    return null;
  }, [shareDestination, destPlace]);

  useEffect(() => {
    if (routeInfo) {
      hasSearchedRef.current = true;
    }
  }, [routeInfo]);

  useEffect(() => {
    if (routeInfo && !sheltersLoading && nearbyShelters.length > 0 && currentOrigin && currentDestination) {
      updateHistoryShelterCount(currentOrigin, currentDestination, travelMode, nearbyShelters.length);
    }
  }, [
    currentDestination,
    currentOrigin,
    nearbyShelters.length,
    routeInfo,
    sheltersLoading,
    travelMode,
    updateHistoryShelterCount,
  ]);

  useEffect(() => {
    if (!showCopiedToast) return;
    const timer = setTimeout(() => setShowCopiedToast(false), 2000);
    return () => clearTimeout(timer);
  }, [showCopiedToast]);

  const handleShare = useCallback(async () => {
    if (!shareOrigin || !shareDestination) return;

    const params = new URLSearchParams({
      from: `${shareOrigin.lat},${shareOrigin.lng}`,
      to: `${shareDestination.lat},${shareDestination.lng}`,
      mode: shareTravelMode || 'WALKING',
    });

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const shelterCount = nearbyShelters.length;
    const origin = originText || t('search.myLocation');
    const destination = destText || '';
    const shareText = t('share.richText')
      .replace('{{count}}', String(shelterCount))
      .replace('{{origin}}', origin)
      .replace('{{destination}}', destination);

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('share.title'),
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopiedToast(true);
    } catch {
      alert(shareUrl);
    }
  }, [destText, nearbyShelters.length, originText, shareDestination, shareOrigin, shareTravelMode, t]);

  const setTravelMode = useCallback((newMode: TravelMode) => {
    setTravelModeState(newMode);

    if (!hasSearchedRef.current || !currentOrigin || !currentDestination) return;
    onSearch(currentOrigin, currentDestination, newMode);
  }, [currentDestination, currentOrigin, onSearch]);

  const handleUseCurrentLocation = useCallback(() => {
    onGetLocation();
    setUseMyLocation(true);
    setOriginText(t('search.myLocation'));
  }, [onGetLocation, t]);

  const handleSearch = useCallback(() => {
    if (!currentOrigin || !currentDestination) return;

    hasSearchedRef.current = true;
    onSearch(currentOrigin, currentDestination, travelMode);
    addHistoryEntry({
      origin: currentOrigin,
      destination: currentDestination,
      originName: originText || t('search.myLocation'),
      destName: destText,
      travelMode,
    });
  }, [addHistoryEntry, currentDestination, currentOrigin, destText, onSearch, originText, t, travelMode]);

  const handleHistorySelect = useCallback((entry: SearchHistoryEntry) => {
    setOriginText(entry.originName);
    setDestText(entry.destName);
    setOriginPlace({ lat: entry.origin.lat, lng: entry.origin.lng, displayName: entry.originName });
    setDestPlace({ lat: entry.destination.lat, lng: entry.destination.lng, displayName: entry.destName });
    setTravelModeState(entry.travelMode);
    setUseMyLocation(false);
    hasSearchedRef.current = true;
    onSearch(entry.origin, entry.destination, entry.travelMode);
  }, [onSearch]);

  return {
    originText,
    setOriginText,
    destText,
    setDestText,
    originPlace,
    setOriginPlace,
    destPlace,
    setDestPlace,
    travelMode,
    setTravelMode,
    useMyLocation,
    setUseMyLocation,
    showCopiedToast,
    currentOrigin,
    currentDestination,
    handleShare,
    handleUseCurrentLocation,
    handleSearch,
    handleHistorySelect,
  };
}
