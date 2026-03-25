import { useEffect, useState } from 'react';
import { getShelterDataStatus, subscribeShelterDataStatus } from '../services/shelterApi';

export function useShelterDataStatus() {
  const [status, setStatus] = useState(() => getShelterDataStatus());

  useEffect(() => {
    setStatus(getShelterDataStatus());
    return subscribeShelterDataStatus(() => {
      setStatus(getShelterDataStatus());
    });
  }, []);

  return status;
}
