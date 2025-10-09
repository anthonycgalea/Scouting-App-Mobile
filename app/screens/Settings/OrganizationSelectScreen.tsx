import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useOrganization } from '@/hooks/use-organization';

const ORGANIZATIONS = ['Team 2471', 'Team 971', 'Team 1678'];

export function OrganizationSelectScreen() {
  const { selectedOrganization, setSelectedOrganization } = useOrganization();
  const data = useMemo(() => ORGANIZATIONS.map((name) => ({ key: name })), []);

  return (
    <ScreenContainer>
      <ThemedText type="title">Organization</ThemedText>
      <ThemedText>Select which team or organization you are scouting for.</ThemedText>
      <FlatList
        data={data}
        renderItem={({ item }) => {
          const isActive = item.key === selectedOrganization;
          return (
            <Pressable
              style={[styles.option, isActive ? styles.optionActive : undefined]}
              onPress={() => setSelectedOrganization(item.key)}
            >
              <ThemedText type={isActive ? 'defaultSemiBold' : 'default'}>{item.key}</ThemedText>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 8,
  },
  optionActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#e6f6fb',
  },
});
