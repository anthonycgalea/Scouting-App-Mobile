import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type BeginScoutingParams = {
  teamNumber?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
};

export default function BeginScoutingRoute() {
  const params = useLocalSearchParams<BeginScoutingParams>();

  const teamNumber = toSingleValue(params.teamNumber) ?? 'Unknown';
  const matchNumber = toSingleValue(params.matchNumber) ?? 'Unknown';
  const eventKey = toSingleValue(params.eventKey) ?? 'Unknown';

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <ThemedText type="title">Scouting Session</ThemedText>
        <View style={styles.detailRow}>
          <ThemedText type="defaultSemiBold">Team:</ThemedText>
          <ThemedText type="default">{teamNumber}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText type="defaultSemiBold">Match:</ThemedText>
          <ThemedText type="default">{matchNumber}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText type="defaultSemiBold">Event Key:</ThemedText>
          <ThemedText type="default">{eventKey}</ThemedText>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
