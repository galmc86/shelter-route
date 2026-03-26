import { useFamilyGroupState } from '../hooks/useFamilyGroupState';
import { useFamilyPushSubscription } from '../hooks/useFamilyPushSubscription';
import { useFamilySyncNotifications } from '../hooks/useFamilySyncNotifications';

export function FamilySyncKeepAlive() {
  useFamilyGroupState();
  useFamilyPushSubscription();
  useFamilySyncNotifications();
  return null;
}
