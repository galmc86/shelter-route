import { useFamilyGroupState } from '../hooks/useFamilyGroupState';
import { useFamilySyncNotifications } from '../hooks/useFamilySyncNotifications';

export function FamilySyncKeepAlive() {
  useFamilyGroupState();
  useFamilySyncNotifications();
  return null;
}
