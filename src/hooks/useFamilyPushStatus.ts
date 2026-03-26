import { useEffect, useState } from 'react';
import {
  getFamilyPushStatus,
  subscribeToFamilyPushStatusChanges,
  type FamilyPushStatus,
} from '../services/familyPushStatusService';

export function useFamilyPushStatus(): FamilyPushStatus {
  const [status, setStatus] = useState<FamilyPushStatus>(() => getFamilyPushStatus());

  useEffect(() => {
    const handleStatusChange = () => {
      setStatus(getFamilyPushStatus());
    };

    handleStatusChange();
    return subscribeToFamilyPushStatusChanges(handleStatusChange);
  }, []);

  return status;
}
