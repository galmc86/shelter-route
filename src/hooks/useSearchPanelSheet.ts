import { useCallback, useEffect, useRef } from 'react';
import type { TouchEvent } from 'react';

interface UseSearchPanelSheetOptions {
  panelExpanded: boolean;
  onTogglePanel?: () => void;
}

export function useSearchPanelSheet({
  panelExpanded,
  onTogglePanel,
}: UseSearchPanelSheetOptions) {
  const panelRef = useRef<HTMLElement>(null);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);
  const touchStartTime = useRef(0);
  const isDragging = useRef(false);
  const snapPointName = useRef<'peek' | 'half' | 'full'>(panelExpanded ? 'half' : 'peek');

  const getSnapPoints = useCallback(() => {
    const vh = window.innerHeight;
    return {
      peek: 80,
      half: vh * 0.4,
      full: vh * 0.85,
    };
  }, []);

  const setPanelHeight = useCallback((height: number, animate: boolean) => {
    const element = panelRef.current;
    if (!element) return;
    element.style.transition = animate
      ? 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';
    element.style.maxHeight = `${height}px`;
  }, []);

  const snapTo = useCallback((point: 'peek' | 'half' | 'full', animate = true) => {
    const snapPoints = getSnapPoints();
    snapPointName.current = point;
    setPanelHeight(snapPoints[point], animate);

    if (point === 'peek' && panelExpanded && onTogglePanel) {
      onTogglePanel();
    } else if (point !== 'peek' && !panelExpanded && onTogglePanel) {
      onTogglePanel();
    }
  }, [getSnapPoints, onTogglePanel, panelExpanded, setPanelHeight]);

  useEffect(() => {
    if (window.innerWidth >= 769) return;

    if (panelExpanded && snapPointName.current === 'peek') {
      snapPointName.current = 'half';
      setPanelHeight(getSnapPoints().half, true);
    } else if (!panelExpanded && snapPointName.current !== 'peek') {
      snapPointName.current = 'peek';
      setPanelHeight(getSnapPoints().peek, true);
    }
  }, [getSnapPoints, panelExpanded, setPanelHeight]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (window.innerWidth >= 769) return;
    const touch = event.touches[0];
    touchStartY.current = touch.clientY;
    touchCurrentY.current = touch.clientY;
    touchStartTime.current = Date.now();
    isDragging.current = true;

    const element = panelRef.current;
    if (element) {
      element.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!isDragging.current || window.innerWidth >= 769) return;
    const touch = event.touches[0];
    touchCurrentY.current = touch.clientY;

    const delta = touchStartY.current - touch.clientY;
    const snapPoints = getSnapPoints();
    const currentHeight = snapPoints[snapPointName.current];
    const newHeight = Math.max(snapPoints.peek, Math.min(snapPoints.full, currentHeight + delta));

    const element = panelRef.current;
    if (element) {
      element.style.maxHeight = `${newHeight}px`;
    }
  }, [getSnapPoints]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || window.innerWidth >= 769) return;
    isDragging.current = false;

    const delta = touchStartY.current - touchCurrentY.current;
    const elapsed = (Date.now() - touchStartTime.current) / 1000;
    const velocity = elapsed > 0 ? delta / elapsed : 0;
    const snapPoints = getSnapPoints();
    const currentHeight = snapPoints[snapPointName.current] + delta;
    const velocityThreshold = 400;

    let target: 'peek' | 'half' | 'full';

    if (Math.abs(velocity) > velocityThreshold) {
      const ordered: Array<'peek' | 'half' | 'full'> = ['peek', 'half', 'full'];
      const currentIndex = ordered.indexOf(snapPointName.current);
      target = velocity > 0
        ? ordered[Math.min(currentIndex + 1, ordered.length - 1)]
        : ordered[Math.max(currentIndex - 1, 0)];
    } else {
      const distances = {
        peek: Math.abs(currentHeight - snapPoints.peek),
        half: Math.abs(currentHeight - snapPoints.half),
        full: Math.abs(currentHeight - snapPoints.full),
      };
      target = (Object.entries(distances) as Array<['peek' | 'half' | 'full', number]>)
        .sort((a, b) => a[1] - b[1])[0][0];
    }

    snapTo(target, true);
  }, [getSnapPoints, snapTo]);

  const handleHandleClick = useCallback(() => {
    if (window.innerWidth < 769) {
      const ordered: Array<'peek' | 'half' | 'full'> = ['peek', 'half', 'full'];
      const currentIndex = ordered.indexOf(snapPointName.current);
      snapTo(ordered[(currentIndex + 1) % ordered.length], true);
    } else if (onTogglePanel) {
      onTogglePanel();
    }
  }, [onTogglePanel, snapTo]);

  return {
    panelRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleHandleClick,
  };
}
