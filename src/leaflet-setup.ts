import L from 'leaflet';

// leaflet.markercluster expects L as a global variable
(window as unknown as Record<string, unknown>).L = L;
