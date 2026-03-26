import { useFamilyGroupState } from '../hooks/useFamilyGroupState';
import { useFamilyPushRefresh } from '../hooks/useFamilyPushRefresh';
import { useFamilyPushSubscription } from '../hooks/useFamilyPushSubscription';
import { useFamilySyncNotifications } from '../hooks/useFamilySyncNotifications';

export function FamilySyncKeepAlive() {
  useFamilyGroupState();
  useFamilyPushRefresh();
  useFamilyPushSubscription();
  useFamilySyncNotifications();
  return null;
}
