import { useEffect, useRef } from 'react';
import { useLanguage, type TranslationKey } from '../i18n';
import { type FamilyGroup } from '../services/familySafetyService';
import { getFamilySyncNotificationEvents } from '../services/familySyncNotificationService';
import { isFamilyPushRegisteredForGroup } from '../services/familyPushNotificationService';
import { showLocalNotification } from '../services/pushNotificationService';
import { useFamilyGroupState } from './useFamilyGroupState';

export function useFamilySyncNotifications(): void {
  const { t } = useLanguage();
  const { group } = useFamilyGroupState();
  const previousGroupRef = useRef<FamilyGroup | null>(null);

  useEffect(() => {
    const previousGroup = previousGroupRef.current;
    previousGroupRef.current = group;

    if (isFamilyPushRegisteredForGroup(group?.groupCode)) {
      return;
    }

    const events = getFamilySyncNotificationEvents(previousGroup, group);
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      void showLocalNotification(
        t('family.notifications.title'),
        getNotificationBody(event, t),
        event.notificationKey
      );
    }
  }, [group, t]);
}

function getNotificationBody(
  event: ReturnType<typeof getFamilySyncNotificationEvents>[number],
  t: (key: TranslationKey) => string
): string {
  switch (event.type) {
    case 'member_joined':
      return t('family.notifications.memberJoined').replace('{{name}}', event.memberName);
    case 'member_left':
      return t('family.notifications.memberLeft').replace('{{name}}', event.memberName);
    case 'member_safe':
      return t('family.notifications.memberSafe').replace('{{name}}', event.memberName);
    case 'member_needs_check_in':
      return t('family.notifications.memberNeedsCheckIn').replace('{{name}}', event.memberName);
    default:
      return event.memberName;
  }
}
