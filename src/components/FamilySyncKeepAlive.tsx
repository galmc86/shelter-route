import { useFamilyGroupState } from '../hooks/useFamilyGroupState';

export function FamilySyncKeepAlive() {
  useFamilyGroupState();
  return null;
}
