import { useState, useEffect } from 'react';
import { outboxService, SyncStatus } from '../services/outbox.ts';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => outboxService.getStatus());

  useEffect(() => {
    return outboxService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  return status;
}

