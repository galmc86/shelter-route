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
    'route.alternatives': 'מסלולים חלופיים',
    'route.optionLabel': 'מסלול',
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
    'hotline.label': 'פיקוד העורף: 104',
    'hotline.ariaLabel': 'התקשר לפיקוד העורף 104',

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

    // Sorting
    'sort.label': 'מיון לפי',
    'sort.distance': 'מרחק',
    'sort.walkingTime': 'זמן הליכה',

    // Walking time
    'shelters.walkingTime': '~{{minutes}} דק׳ הליכה',

    // Accessibility
    'accessibility.filterLabel': 'נגישים בלבד',
    'accessibility.accessible': 'נגיש לכיסא גלגלים',
    'accessibility.notAccessible': 'לא נגיש',
    'accessibility.hasElevator': 'מעלית',
    'accessibility.floor': 'קומה {{level}}',
    'accessibility.groundFloor': 'קומת קרקע',

    // Routes (alternatives)
    'routes.alternativeRoutes': 'מסלולים חלופיים',
    'routes.selectRoute': 'בחר מסלול',
    'routes.route': 'מסלול',
    'routes.mostShelters': 'הכי הרבה מקלטים',

    // Capacity
    'capacity.title': 'תפוסה',
    'capacity.occupancy': 'תפוסה',
    'capacity.available': 'פנוי',
    'capacity.full': 'מלא',
    'capacity.low': 'תפוסה נמוכה',
    'capacity.medium': 'תפוסה בינונית',
    'capacity.high': 'תפוסה גבוהה',
    'capacity.unknown': 'תפוסה לא ידועה',
    'capacity.of': 'מתוך',
    'capacity.lastUpdated': 'עודכן לאחרונה',
    'capacity.legend': 'מקרא תפוסה',
    'capacity.legendLow': 'פנוי (מתחת ל-50%)',
    'capacity.legendMedium': 'תפוסה בינונית (50%-80%)',
    'capacity.legendHigh': 'תפוסה גבוהה (מעל 80%)',
    'capacity.legendUnknown': 'לא ידוע',
    'capacity.walkingTime': 'הליכה',
    'capacity.minutes': 'דק׳',

    // Search attribution
    'search.poweredByGoogle': 'מופעל ע"י Google',

    // Units (duration & distance)
    'units.lessThanMinute': 'פחות מדקה',
    'units.minute': 'דקה {{n}}',
    'units.minutes': '{{n}} דקות',
    'units.hour': 'שעה {{n}}',
    'units.hourMinutes': 'שעה ו-{{m}} דק\'',
    'units.hours': '{{n}} שעות',
    'units.meters': '{{n}} מ\'',
    'units.km': '{{n}} ק"מ',

    // OREF Alerts
    'alert.active': 'התרעה פעילה!',
    'alert.title': 'התרעת צבע אדום',
    'alert.countdown': ':זמן להגיע למקלט',
    'alert.findShelter': 'מצא מקלט עכשיו',
    'alert.dismiss': 'סגור',
    'alert.region': ':התרעה באזור',
    'alert.seconds': 'שניות',
    'alert.expired': 'הכנס למקלט מיד!',
    'alert.settings': 'התראות',

    // Route Risk
    'risk.none': 'אין התרעות אחרונות',
    'risk.low': 'התרעות ישנות במסלול',
    'risk.moderate': 'התרעות אחרונות במסלול',
    'risk.high': 'התרעות פעילות במסלול!',
    'risk.alertCount': '{{count}} התרעות ב-{{hours}} שעות',
    'risk.lastAlert': 'אחרונה: {{time}}',
    'risk.alerts': 'התרעות',
    'history.1h': 'שעה',
    'history.6h': '6 שעות',
    'history.24h': '24 שעות',
    'history.timeRange': 'טווח זמן',
    'history.ago': 'לפני {{time}}',
    'history.hoursAgo': 'לפני {{count}} שעות',
    'history.minutesAgo': 'לפני {{count}} דקות',

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
    'search.sectionRoute': 'Route Planning',
    'search.sectionTransport': 'Travel Mode',
    'search.placeholder.origin': 'Starting point...',
    'search.placeholder.dest': 'Destination...',
    'search.button': 'Search route',
    'search.button.ariaEnabled': 'Search route',
    'search.button.ariaDisabled': 'Enter origin and destination to search',
    'search.searching': 'Searching for route...',
    'search.myLocation': 'My current location',

    // Emergency
    'emergency.findShelter': 'Find nearest shelter now',
    'emergency.bannerTitle': 'Emergency Mode',
    'emergency.locating': 'Locating your position...',
    'emergency.nearbyShelters': 'shelters near you',
    'emergency.exit': 'Back',
    'emergency.exitAriaLabel': 'Exit emergency mode',

    // Route Info
    'route.details': 'Route Details',
    'route.alternatives': 'Alternative routes',
    'route.optionLabel': 'Route',
    'route.sheltersAlongRoute': 'Public shelters along the route',
    'route.sheltersLabel': 'shelters',

    // Shelters
    'shelters.noSheltersFound': 'No shelters found within 200 meters of the route',
    'shelters.nearYou': 'Shelters near you',
    'shelters.alongRoute': 'Shelters along the route',
    'shelters.meter': 'm',
    'shelters.meters': 'meters',
    'shelters.fromRoute': 'from the route',
    'shelters.fromYou': 'from your location',
    'shelters.publicShelter': 'Public shelter',
    'shelters.navigateToShelter': 'Navigate to shelter',
    'shelters.loading': 'Loading',
    'shelters.distanceMeters': 'm',
    'search.button.tooltip': 'Please enter a starting point and destination',

    // Location
    'location.useMyLocation': 'Use my current location',
    'location.locating': 'Locating...',

    // Travel modes
    'travel.walking': 'Walking',
    'travel.bicycling': 'Cycling',
    'travel.driving': 'Driving',

    // Hotline
    'hotline.label': 'Home Front Command: 104',
    'hotline.ariaLabel': 'Call Home Front Command 104',

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

    // Sorting
    'sort.label': 'Sort by',
    'sort.distance': 'Distance',
    'sort.walkingTime': 'Walking time',

    // Walking time
    'shelters.walkingTime': '~{{minutes}} min walk',

    // Accessibility
    'accessibility.filterLabel': 'Accessible only',
    'accessibility.accessible': 'Wheelchair accessible',
    'accessibility.notAccessible': 'Not accessible',
    'accessibility.hasElevator': 'Elevator',
    'accessibility.floor': 'Floor {{level}}',
    'accessibility.groundFloor': 'Ground floor',

    // Routes (alternatives)
    'routes.alternativeRoutes': 'Alternative Routes',
    'routes.selectRoute': 'Select route',
    'routes.route': 'Route',
    'routes.mostShelters': 'Most shelters',

    // Capacity
    'capacity.title': 'Capacity',
    'capacity.occupancy': 'Occupancy',
    'capacity.available': 'Available',
    'capacity.full': 'Full',
    'capacity.low': 'Low occupancy',
    'capacity.medium': 'Medium occupancy',
    'capacity.high': 'High occupancy',
    'capacity.unknown': 'Capacity unknown',
    'capacity.of': 'of',
    'capacity.lastUpdated': 'Last updated',
    'capacity.legend': 'Capacity Legend',
    'capacity.legendLow': 'Available (under 50%)',
    'capacity.legendMedium': 'Medium occupancy (50%-80%)',
    'capacity.legendHigh': 'High occupancy (over 80%)',
    'capacity.legendUnknown': 'Unknown',
    'capacity.walkingTime': 'Walking',
    'capacity.minutes': 'min',

    // Search attribution
    'search.poweredByGoogle': 'Powered by Google',

    // Units (duration & distance)
    'units.lessThanMinute': 'Less than a minute',
    'units.minute': '{{n}} min',
    'units.minutes': '{{n}} min',
    'units.hour': '{{n}} hr',
    'units.hourMinutes': '{{n}} hr {{m}} min',
    'units.hours': '{{n}} hrs',
    'units.meters': '{{n}} m',
    'units.km': '{{n}} km',

    // OREF Alerts
    'alert.active': 'Active alert!',
    'alert.title': 'Rocket Alert',
    'alert.countdown': 'Time to shelter:',
    'alert.findShelter': 'Find shelter now',
    'alert.dismiss': 'Dismiss',
    'alert.region': 'Alert in:',
    'alert.seconds': 'seconds',
    'alert.expired': 'Get to shelter immediately!',
    'alert.settings': 'Alert notifications',

    // Route Risk
    'risk.none': 'No recent alerts',
    'risk.low': 'Older alerts on route',
    'risk.moderate': 'Recent alerts on route',
    'risk.high': 'Active alerts on route!',
    'risk.alertCount': '{{count}} alerts in {{hours}} hours',
    'risk.lastAlert': 'Last: {{time}}',
    'risk.alerts': 'alerts',
    'history.1h': '1h',
    'history.6h': '6h',
    'history.24h': '24h',
    'history.timeRange': 'Time range',
    'history.ago': '{{time}} ago',
    'history.hoursAgo': '{{count}} hours ago',
    'history.minutesAgo': '{{count}} min ago',

    // Errors
    'error.mapLoad': 'Error loading map',
    'error.mapLoadDesc': 'Make sure the OpenRouteService key is set in the .env file',
  },
} as const;

export type TranslationKey = keyof typeof translations.he;
