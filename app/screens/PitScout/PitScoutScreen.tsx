import { useEffect, useState } from 'react';

import { apiClient } from '@/app/services/api/client';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

export function PitScoutScreen() {
  const [pingResponse, setPingResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPing = async () => {
      if (!isMounted) {
        return;
      }

      setPingResponse(null);
      setError(null);

      try {
        const { data } = await apiClient.get('/ping');

        if (!isMounted) {
          return;
        }

        setPingResponse(JSON.stringify(data, null, 2));
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Unexpected error while fetching ping response.');
      }
    };

    loadPing();

    return () => {
      isMounted = false;
    };
  }, []);

  const isLoading = !pingResponse && !error;

  return (
    <ScreenContainer>
      <ThemedText type="title">Pit Scouting</ThemedText>
      <ThemedText>
        Capture robot configurations, drivetrain specifications, and pre-match notes while visiting the pit.
      </ThemedText>
      <ThemedText type="subtitle" style={{ marginTop: 24 }}>
        API Connectivity Check
      </ThemedText>
      <ThemedText selectable style={{ marginTop: 8 }}>
        {isLoading && 'Loading ping response...'}
        {error && !isLoading && `Error loading ping response: ${error}`}
        {pingResponse && !isLoading && pingResponse}
      </ThemedText>
    </ScreenContainer>
  );
}
