import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';

interface TeamListItem {
  number: number;
  name: string;
  location: string;
}

const TEAM_LIST: TeamListItem[] = [
  { number: 999, name: 'MechaRAMS', location: 'Cheshire, Connecticut, USA' },
  { number: 1156, name: 'Under Control', location: 'Novo Hamburgo, Rio Grande do Sul, Brazil' },
  { number: 1772, name: 'The Brazilian Trail Blazers', location: 'Gravataí, Rio Grande do Sul, Brazil' },
  { number: 1860, name: 'Alphabots', location: 'São José dos Campos, São Paulo, Brazil' },
  { number: 2996, name: 'Magic Island Robotics', location: 'FLORIANÓPOLIS, Santa Catarina, Brazil' },
  { number: 6404, name: 'Brazilian Storm', location: 'Curitiba, Paraná, Brazil' },
  { number: 6903, name: 'Manna Roosters 7033', location: 'São José dos Campos, São Paulo, Brazil' },
  { number: 8276, name: 'OPTRON#8276', location: 'Curitiba, Paraná, Brazil' },
  { number: 8576, name: 'SESI SENAI STEAMPUNK MONKEY FRC', location: 'Curitiba, Paraná, Brazil' },
  { number: 9014, name: 'SESI SENAI Atomic', location: 'Curitiba, Paraná, Brazil' },
  { number: 9056, name: 'Tucanus', location: 'São José dos Campos, São Paulo, Brazil' },
  { number: 9106, name: 'SESI SENAI Atomic', location: 'Curitiba, Paraná, Brazil' },
  { number: 9166, name: 'Teckob', location: 'São Leopoldo, Rio Grande do Sul, Brazil' },
];

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function PitScoutScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const backgroundCard = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const searchBackground = useThemeColor({ light: '#F1F5F9', dark: '#1F2937' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const placeholderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.45)', dark: 'rgba(148, 163, 184, 0.65)' },
    'text'
  );
  const mutedTextColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.6)', dark: 'rgba(226, 232, 240, 0.65)' },
    'text'
  );
  const inputTextColor = useThemeColor({}, 'text');

  const filteredTeams = useMemo(() => {
    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      return TEAM_LIST;
    }

    const normalizedSearch = normalizeText(trimmedSearch);

    return TEAM_LIST.filter((team) => {
      const normalizedName = normalizeText(team.name);
      const normalizedLocation = normalizeText(team.location);
      const normalizedNumber = String(team.number);

      return (
        normalizedName.includes(normalizedSearch) ||
        normalizedLocation.includes(normalizedSearch) ||
        normalizedNumber.includes(normalizedSearch)
      );
    });
  }, [searchTerm]);

  const handleTeamPress = (team: TeamListItem) => {
    router.push({
      pathname: '/(drawer)/pit-scout/team-details',
      params: {
        teamNumber: String(team.number),
        teamName: team.name,
      },
    });
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchContainer, { backgroundColor: searchBackground, borderColor }]}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search"
            placeholderTextColor={placeholderColor}
            style={[styles.searchInput, { color: inputTextColor }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.listContainer}>
          {filteredTeams.map((team) => (
            <Pressable
              key={team.number}
              accessibilityRole="button"
              onPress={() => handleTeamPress(team)}
              style={({ pressed }) => [
                styles.teamRow,
                {
                  backgroundColor: backgroundCard,
                  borderColor,
                  opacity: pressed ? 0.95 : 1,
                },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.teamNumber}>
                {team.number}
              </ThemedText>
              <View style={styles.teamDetails}>
                <ThemedText type="defaultSemiBold" style={styles.teamName}>
                  {team.name}
                </ThemedText>
                <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                  {team.location}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
    gap: 24,
  },
  searchContainer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    fontSize: 18,
  },
  listContainer: {
    gap: 12,
  },
  teamRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  teamNumber: {
    fontSize: 20,
    minWidth: 64,
  },
  teamDetails: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    marginBottom: 4,
  },
  teamLocation: {
    fontSize: 14,
  },
});
