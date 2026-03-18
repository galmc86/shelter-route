export type Language = 'he' | 'en';

export const translations = {
  he: {
    // App Header
    'header.title': 'Shelter Route',
    'header.subtitle': 'מצא מקלטים לאורך המסלול שלך',

    // Search Panel
    'search.ariaLabel': 'חיפוש מסלול ומקלטים',
    'search.panelCollapse': 'כווץ פאנל',
    'search.panelExpand': 'הרחב פאנל',
    'search.showMap': 'הצג מפה',
    'search.showDetails': 'מקלטים נמצאו — הצג פרטים',
    'search.planRoute': 'תכנן מסלול',
    'search.sectionRoute': 'תכנון מסלול',
    'search.sectionTransport': 'אמצעי תחבורה',
    'search.placeholder.origin': 'נקודת מוצא...',
    'search.placeholder.dest': 'יעד...',
    'search.button': 'חפש מסלול',
    'search.button.ariaEnabled': 'חפש מסלול',
    'search.button.ariaDisabled': 'הזן נקודת מוצא ויעד כדי לחפש',
    'search.searching': 'מחפש מסלול...',
    'search.myLocation': 'המיקום הנוכחי שלי',

    // Emergency
    'emergency.findShelter': 'מצא מקלט קרוב עכשיו',
    'emergency.bannerTitle': 'מצב חירום',
    'emergency.locating': 'מאתר מיקום...',
    'emergency.nearbyShelters': 'מקלטים קרובים אליך',
    'emergency.exit': 'חזור',
    'emergency.exitAriaLabel': 'צא ממצב חירום',

    // Route Info
    'route.details': 'פרטי מסלול',
    'route.sheltersAlongRoute': 'מקלטים ציבוריים לאורך המסלול',
    'route.sheltersLabel': 'מקלטים',

    // Shelters
    'shelters.noSheltersFound': 'לא נמצאו מקלטים בטווח 200 מטר מהמסלול',
    'shelters.nearYou': 'מקלטים קרובים אליך',
    'shelters.alongRoute': 'מקלטים במסלול',
    'shelters.meter': 'מ׳',
    'shelters.meters': 'מטר',
    'shelters.fromRoute': 'מהמסלול',
    'shelters.fromYou': 'ממיקומך',
    'shelters.publicShelter': 'מקלט ציבורי',
    'shelters.navigateToShelter': 'נווט למקלט',
    'shelters.loading': 'טוען',
    'search.button.tooltip': 'נא להזין נקודת התחלה ויעד',
    'shelters.distanceMeters': 'מ׳',

    // Location
    'location.useMyLocation': 'השתמש במיקום הנוכחי שלי',
    'location.locating': 'מאתר...',

    // Travel modes
    'travel.walking': 'הליכה',
    'travel.bicycling': 'אופניים',
    'travel.driving': 'רכב',

    // Hotline
    'hotline.label': 'פיקוד העורף: 100',
    'hotline.ariaLabel': 'התקשר לפיקוד העורף 100',

    // Map
    'map.loading': 'טוען מפה...',
    'map.loadingAriaLabel': 'טוען מפה',
    'map.ariaLabel': 'מפת מקלטים',
    'map.yourLocation': 'המיקום שלך',

    // Theme
    'theme.toggleDark': 'מצב כהה',
    'theme.toggleLight': 'מצב בהיר',
    'theme.toggleHighContrast': 'ניגודיות גבוהה',

    // Share
    'share.button': 'שתף מסלול',
    'share.copied': 'הקישור הועתק!',
    'share.title': 'מסלול מקלטים',
    'share.text': 'מסלול עם {{count}} מקלטים',
    'share.sharedLocation': 'מיקום משותף',

    // Offline / SW
    'offline.indicator': 'אין חיבור לאינטרנט — מצב לא מקוון',
    'sw.updateAvailable': 'גרסה חדשה זמינה',
    'sw.updateButton': 'עדכן',

    // Errors
    'error.mapLoad': 'שגיאה בטעינת המפה',
    'error.mapLoadDesc': 'ודא שמפתח OpenRouteService מוגדר בקובץ .env',
  },
  en: {
    // App Header
    'header.title': 'Shelter Route',
    'header.subtitle': 'Find shelters along your route',

    // Search Panel
    'search.ariaLabel': 'Search route and shelters',
    'search.panelCollapse': 'Collapse panel',
    'search.panelExpand': 'Expand panel',
    'search.showMap': 'Show map',
    'search.showDetails': 'shelters found — show details',
    'search.planRoute': 'Plan route',
    'search.sectionRoute': 'Plan Route',
    'search.sectionTransport': 'Travel Mode',
    'search.placeholder.origin': 'Starting point...',
    'search.placeholder.dest': 'Destination...',
    'search.button': 'Search route',
    'search.button.ariaEnabled': 'Search route',
    'search.button.ariaDisabled': 'Enter origin and destination to search',
    'search.searching': 'Searching route...',
    'search.myLocation': 'My current location',

    // Emergency
    'emergency.findShelter': 'Find nearest shelter now',
    'emergency.bannerTitle': 'Emergency Mode',
    'emergency.locating': 'Locating...',
    'emergency.nearbyShelters': 'shelters near you',
    'emergency.exit': 'Back',
    'emergency.exitAriaLabel': 'Exit emergency mode',

    // Route Info
    'route.details': 'Route Details',
    'route.sheltersAlongRoute': 'Public shelters along the route',
    'route.sheltersLabel': 'shelters',

    // Shelters
    'shelters.noSheltersFound': 'No shelters found within 200 meters of the route',
    'shelters.nearYou': 'Shelters near you',
    'shelters.alongRoute': 'Shelters on route',
    'shelters.meter': 'm',
    'shelters.meters': 'meters',
    'shelters.fromRoute': 'from route',
    'shelters.fromYou': 'from you',
    'shelters.publicShelter': 'Public shelter',
    'shelters.navigateToShelter': 'Navigate to shelter',
    'shelters.loading': 'Loading',
    'search.button.tooltip': 'Please enter start point and destination',
    'shelters.distanceMeters': 'm',

    // Location
    'location.useMyLocation': 'Use my current location',
    'location.locating': 'Locating...',

    // Travel modes
    'travel.walking': 'Walking',
    'travel.bicycling': 'Cycling',
    'travel.driving': 'Driving',

    // Hotline
    'hotline.label': 'Home Front Command: 100',
    'hotline.ariaLabel': 'Call Home Front Command 100',

    // Map
    'map.loading': 'Loading map...',
    'map.loadingAriaLabel': 'Loading map',
    'map.ariaLabel': 'Shelter map',
    'map.yourLocation': 'Your location',

    // Theme
    'theme.toggleDark': 'Dark mode',
    'theme.toggleLight': 'Light mode',
    'theme.toggleHighContrast': 'High contrast',

    // Share
    'share.button': 'Share route',
    'share.copied': 'Link copied!',
    'share.title': 'Shelter Route',
    'share.text': 'Route with {{count}} shelters',
    'share.sharedLocation': 'Shared location',

    // Offline / SW
    'offline.indicator': 'No internet connection — offline mode',
    'sw.updateAvailable': 'New version available',
    'sw.updateButton': 'Update',

    // Errors
    'error.mapLoad': 'Error loading map',
    'error.mapLoadDesc': 'Make sure the OpenRouteService key is set in the .env file',
  },
} as const;

export type TranslationKey = keyof typeof translations.he;
