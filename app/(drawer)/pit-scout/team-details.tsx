import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { and, eq } from 'drizzle-orm';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { StacklessHeader } from '@/components/layout/StacklessHeader';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useOrganization } from '@/hooks/use-organization';
import { getDbOrThrow, schema } from '@/db';
import type { NewPitData2026 } from '@/db/schema';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { submitPitScoutData, syncAlreadyPitScoutedEntries } from '@/app/services/pit-scouting';

const DRIVETRAIN_OPTIONS = [
  { label: 'Tank', value: 'TANK' },
  { label: 'Swerve', value: 'SWERVE' },
  { label: 'Mecanum', value: 'MECANUM' },
  { label: 'H-Drive', value: 'H-DRIVE' },
  { label: 'Other', value: 'OTHER' },
] as const;

const TAB_OPTIONS = [
  { key: 'general', label: 'General' },
  { key: 'auto', label: 'Autonomous' },
  { key: 'teleop', label: 'Teleop' },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['key'];
type ToggleState<T extends string> = Record<T, boolean>;

const START_POSITIONS = [
  { key: 'TRENCH_LEFT', label: 'Trench Left' },
  { key: 'BUMP_LEFT', label: 'Bump Left' },
  { key: 'CENTER', label: 'Center' },
  { key: 'BUMP_RIGHT', label: 'Bump Right' },
  { key: 'TRENCH_RIGHT', label: 'Trench Right' },
] as const;

const ENDGAME_OPTIONS = [
  { key: 'NONE', label: 'None' },
  { key: 'L1', label: 'L1' },
  { key: 'L2', label: 'L2' },
  { key: 'L3', label: 'L3' },
] as const;

type StartPositionKey = (typeof START_POSITIONS)[number]['key'];
type EndgameKey = (typeof ENDGAME_OPTIONS)[number]['key'];

const createInitialToggleState = <T extends string>(values: readonly { key: T }[]): ToggleState<T> => {
  const initialState = Object.create(null) as ToggleState<T>;
  values.forEach((value) => {
    initialState[value.key] = false;
  });
  return initialState;
};

const parseOptionalInteger = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeText = (value: string) => value.trim();

export default function PitScoutTeamDetailsScreen() {
  const params = useLocalSearchParams<{ teamNumber?: string | string[]; teamName?: string | string[] }>();
  const router = useRouter();
  const { selectedOrganization } = useOrganization();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabKey>('general');
  const [drivetrain, setDrivetrain] = useState<(typeof DRIVETRAIN_OPTIONS)[number]['value']>('TANK');
  const [showDrivetrainOptions, setShowDrivetrainOptions] = useState(false);
  const [robotWeight, setRobotWeight] = useState('');
  const [driveTeam, setDriveTeam] = useState('');
  const [hopperCapacity, setHopperCapacity] = useState('');
  const [pickupGround, setPickupGround] = useState(false);
  const [pickupFeeder, setPickupFeeder] = useState(false);
  const [trenchBot, setTrenchBot] = useState(false);
  const [bumpBot, setBumpBot] = useState(false);

  const [autoStartPositions, setAutoStartPositions] = useState<ToggleState<StartPositionKey>>(() =>
    createInitialToggleState(START_POSITIONS)
  );
  const [autoPickupCorral, setAutoPickupCorral] = useState(false);
  const [autoPickupOutpost, setAutoPickupOutpost] = useState(false);
  const [autoFuel, setAutoFuel] = useState(false);
  const [autoFuelCount, setAutoFuelCount] = useState('');
  const [autoPass, setAutoPass] = useState(false);
  const [autoPassCount, setAutoPassCount] = useState('');
  const [autoClimb, setAutoClimb] = useState(false);
  const [autoNotes, setAutoNotes] = useState('');

  const [teleFuel, setTeleFuel] = useState(false);
  const [telePass, setTelePass] = useState(false);
  const [teleNotes, setTeleNotes] = useState('');
  const [endgameSelection, setEndgameSelection] = useState<EndgameKey>('NONE');
  const [overallNotes, setOverallNotes] = useState('');

  const teamNumber = Array.isArray(params.teamNumber) ? params.teamNumber[0] : params.teamNumber;
  const teamName = Array.isArray(params.teamName) ? params.teamName[0] : params.teamName;
  const headerTitle = [teamNumber, teamName].filter(Boolean).join(' - ') || 'Team';

  const primaryButtonBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const primaryButtonText = '#F8FAFC';
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#0F172A' }, 'background');
  const borderColor = useThemeColor({ light: '#CBD5F5', dark: '#334155' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const tabContainerBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');
  const toggleActiveBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const toggleActiveTextColor = '#F8FAFC';
  const tabInactiveTextColor = useThemeColor({ light: '#334155', dark: '#CBD5F5' }, 'text');
  const placeholderColor = useThemeColor({ light: '#64748B', dark: '#94A3B8' }, 'text');

  const drivetrainLabel = useMemo(() => {
    const match = DRIVETRAIN_OPTIONS.find((option) => option.value === drivetrain);
    return match?.label ?? 'Tank';
  }, [drivetrain]);

  const handleCloseInputs = () => {
    Keyboard.dismiss();
    setShowDrivetrainOptions(false);
  };

  const toggleSelection = <T extends string>(updater: Dispatch<SetStateAction<ToggleState<T>>>, key: T) => {
    updater((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    handleCloseInputs();

    const eventKey = getActiveEvent();

    if (!eventKey) {
      Alert.alert('Select an event', 'Choose an event before submitting pit scouting data.');
      return;
    }

    if (!selectedOrganization) {
      Alert.alert('Select an organization', 'Choose the organization you are scouting for before submitting pit scouting data.');
      return;
    }

    const parsedTeamNumber = teamNumber ? Number.parseInt(teamNumber, 10) : Number.NaN;

    if (Number.isNaN(parsedTeamNumber)) {
      Alert.alert('Missing team number', 'A valid team number is required before submitting pit data.');
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDbOrThrow();

      const pitDataValues: NewPitData2026 = {
        season: 2,
        eventKey,
        teamNumber: parsedTeamNumber,
        organizationId: selectedOrganization.id,
        userId: '',
        robotWeight: parseOptionalInteger(robotWeight),
        drivetrain,
        driveteam: normalizeText(driveTeam),
        hopperCapacity: parseOptionalInteger(hopperCapacity),
        pickupGround: pickupGround ? 1 : 0,
        pickupFeeder: pickupFeeder ? 1 : 0,
        trenchBot: trenchBot ? 1 : 0,
        bumpBot: bumpBot ? 1 : 0,
        startPositionTrenchLeft: autoStartPositions.TRENCH_LEFT ? 1 : 0,
        startPositionBumpLeft: autoStartPositions.BUMP_LEFT ? 1 : 0,
        startPositionCenter: autoStartPositions.CENTER ? 1 : 0,
        startPositionBumpRight: autoStartPositions.BUMP_RIGHT ? 1 : 0,
        startPositionTrenchRight: autoStartPositions.TRENCH_RIGHT ? 1 : 0,
        autoPickupCorral: autoPickupCorral ? 1 : 0,
        autoPickupOutpost: autoPickupOutpost ? 1 : 0,
        autoFuel: autoFuel ? 1 : 0,
        autoFuelCount: autoFuel ? parseOptionalInteger(autoFuelCount) : 0,
        autoPass: autoPass ? 1 : 0,
        autoPassCount: autoPass ? parseOptionalInteger(autoPassCount) : 0,
        autoClimb: autoClimb ? 1 : 0,
        autoNotes: normalizeText(autoNotes),
        teleFuel: teleFuel ? 1 : 0,
        telePass: telePass ? 1 : 0,
        teleNotes: normalizeText(teleNotes),
        endgame: endgameSelection,
        overallNotes: normalizeText(overallNotes),
      };

      const { eventKey: _ignoredEventKey, teamNumber: _ignoredTeamNumber, ...pitDataUpdateValues } = pitDataValues;

      await db
        .insert(schema.pitData2026)
        .values(pitDataValues)
        .onConflictDoUpdate({
          target: [schema.pitData2026.eventKey, schema.pitData2026.teamNumber],
          set: pitDataUpdateValues,
        })
        .run();

      await db
        .insert(schema.alreadyPitScouteds)
        .values({
          eventCode: eventKey,
          teamNumber: parsedTeamNumber,
          organizationId: selectedOrganization.id,
        })
        .onConflictDoNothing()
        .run();

      const [pitRow] = await db
        .select()
        .from(schema.pitData2026)
        .where(and(eq(schema.pitData2026.eventKey, eventKey), eq(schema.pitData2026.teamNumber, parsedTeamNumber)))
        .limit(1);

      if (!pitRow) {
        throw new Error('Failed to retrieve submitted pit data.');
      }

      try {
        await submitPitScoutData(pitRow);

        try {
          await syncAlreadyPitScoutedEntries(selectedOrganization.id);
        } catch (syncError) {
          console.error('Failed to refresh already pit scouted entries from API', syncError);
        }
      } catch (submissionError) {
        console.error('Failed to submit pit data to API', submissionError);
      }

      router.replace('/(drawer)/pit-scout');
    } catch (error) {
      console.error('Failed to mark pit scouting as completed', error);
      Alert.alert(
        'Unable to submit',
        error instanceof Error ? error.message : 'An unexpected error occurred while submitting pit scouting data.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBooleanQuestion = (
    label: string,
    value: boolean,
    onToggle: () => void,
  ) => (
    <View style={styles.fieldGroup}>
      <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <View style={styles.toggleRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onToggle}
          style={({ pressed }) => [
            styles.toggleButton,
            {
              backgroundColor: value ? toggleActiveBackground : 'transparent',
              borderColor: value ? toggleActiveBackground : borderColor,
            },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={[styles.toggleButtonText, { color: value ? toggleActiveTextColor : tabInactiveTextColor }]}
          >
            {value ? 'Yes' : 'No'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <StacklessHeader title={headerTitle} showBackButton onBackPress={() => router.back()} />
      <TouchableWithoutFeedback onPress={handleCloseInputs} accessible={false}>
        <View style={styles.container}>
          <View style={[styles.tabBar, { backgroundColor: tabContainerBackground, borderColor }]}> 
            {TAB_OPTIONS.map((tab) => {
              const isSelected = selectedTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button"
                  onPress={() => setSelectedTab(tab.key)}
                  style={({ pressed }) => [
                    styles.tabButton,
                    { backgroundColor: isSelected ? toggleActiveBackground : 'transparent' },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.tabButtonText, { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor }]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {selectedTab === 'general' ? (
              <View style={styles.section}>
                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Drivetrain</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowDrivetrainOptions((previous) => !previous)}
                    style={({ pressed }) => [styles.dropdownField, { backgroundColor: inputBackground, borderColor }, pressed && styles.buttonPressed]}
                  >
                    <ThemedText style={[styles.dropdownText, { color: textColor }]}>{drivetrainLabel}</ThemedText>
                  </Pressable>
                  {showDrivetrainOptions ? (
                    <View style={[styles.dropdownList, { backgroundColor: inputBackground, borderColor }]}>
                      {DRIVETRAIN_OPTIONS.map((option) => {
                        const isSelected = option.value === drivetrain;
                        return (
                          <Pressable
                            key={option.value}
                            accessibilityRole="button"
                            onPress={() => {
                              setDrivetrain(option.value);
                              setShowDrivetrainOptions(false);
                            }}
                            style={({ pressed }) => [
                              styles.dropdownOption,
                              isSelected && { backgroundColor: toggleActiveBackground },
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            <ThemedText style={[styles.dropdownOptionText, { color: isSelected ? toggleActiveTextColor : textColor }]}>
                              {option.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                <View style={styles.inlineFields}>
                  <View style={styles.inlineField}>
                    <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>How much does the robot weigh?</ThemedText>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={robotWeight}
                      onChangeText={setRobotWeight}
                      style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>How much fuel can your robot hold?</ThemedText>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={hopperCapacity}
                      onChangeText={setHopperCapacity}
                      style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Driver name</ThemedText>
                  <TextInput
                    placeholder="Enter driver name"
                    placeholderTextColor={placeholderColor}
                    value={driveTeam}
                    onChangeText={setDriveTeam}
                    style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                  />
                </View>

                {renderBooleanQuestion('Does the robot pick up fuel off the ground?', pickupGround, () => setPickupGround((prev) => !prev))}
                {renderBooleanQuestion('Can your robot receive fuel from the outpost?', pickupFeeder, () => setPickupFeeder((prev) => !prev))}
                {renderBooleanQuestion('Can your robot go under the trench?', trenchBot, () => setTrenchBot((prev) => !prev))}
                {renderBooleanQuestion('Can your robot go over the bump?', bumpBot, () => setBumpBot((prev) => !prev))}
              </View>
            ) : null}

            {selectedTab === 'auto' ? (
              <View style={styles.section}>
                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Where can your robot start in autonomous?</ThemedText>
                  <View style={styles.toggleRow}>
                    {START_POSITIONS.map((position) => {
                      const isSelected = autoStartPositions[position.key];
                      return (
                        <Pressable
                          key={position.key}
                          accessibilityRole="button"
                          onPress={() => toggleSelection(setAutoStartPositions, position.key)}
                          style={({ pressed }) => [
                            styles.toggleButton,
                            {
                              backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                              borderColor: isSelected ? toggleActiveBackground : borderColor,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText type="defaultSemiBold" style={[styles.toggleButtonText, { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor }]}>
                            {position.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {renderBooleanQuestion('Can your robot pick up fuel from the corral in autonomous?', autoPickupCorral, () => setAutoPickupCorral((prev) => !prev))}
                {renderBooleanQuestion('Can your robot pick up fuel from the outpost in autonomous?', autoPickupOutpost, () => setAutoPickupOutpost((prev) => !prev))}
                {renderBooleanQuestion('Does your robot score fuel in autonomous?', autoFuel, () => setAutoFuel((prev) => !prev))}

                {autoFuel ? (
                  <View style={styles.fieldGroup}>
                    <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>How much fuel does your robot intend on scoring in autonomous?</ThemedText>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={autoFuelCount}
                      onChangeText={setAutoFuelCount}
                      style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    />
                  </View>
                ) : null}

                {renderBooleanQuestion('Do you pass fuel in autonomous?', autoPass, () => setAutoPass((prev) => !prev))}

                {autoPass ? (
                  <View style={styles.fieldGroup}>
                    <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>How many fuel passes in autonomous?</ThemedText>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={autoPassCount}
                      onChangeText={setAutoPassCount}
                      style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    />
                  </View>
                ) : null}

                {renderBooleanQuestion('Do you climb in autonomous?', autoClimb, () => setAutoClimb((prev) => !prev))}

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Autonomous notes</ThemedText>
                  <TextInput
                    multiline
                    placeholder="Add autonomous notes"
                    placeholderTextColor={placeholderColor}
                    value={autoNotes}
                    onChangeText={setAutoNotes}
                    style={[styles.textArea, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ) : null}

            {selectedTab === 'teleop' ? (
              <View style={styles.section}>
                {renderBooleanQuestion('Do you score fuel in teleop?', teleFuel, () => setTeleFuel((prev) => !prev))}
                {renderBooleanQuestion('Do you intend on passing fuel in teleop?', telePass, () => setTelePass((prev) => !prev))}

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Teleop notes</ThemedText>
                  <TextInput
                    multiline
                    placeholder="Add teleop notes"
                    placeholderTextColor={placeholderColor}
                    value={teleNotes}
                    onChangeText={setTeleNotes}
                    style={[styles.textArea, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Do you climb in endgame?</ThemedText>
                  <View style={styles.toggleRow}>
                    {ENDGAME_OPTIONS.map((option) => {
                      const isSelected = endgameSelection === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          accessibilityRole="button"
                          onPress={() => setEndgameSelection(option.key)}
                          style={({ pressed }) => [
                            styles.toggleButton,
                            {
                              backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                              borderColor: isSelected ? toggleActiveBackground : borderColor,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText type="defaultSemiBold" style={[styles.toggleButtonText, { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor }]}> 
                            {option.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Overall notes</ThemedText>
                  <TextInput
                    multiline
                    placeholder="Share any overall observations"
                    placeholderTextColor={placeholderColor}
                    value={overallNotes}
                    onChangeText={setOverallNotes}
                    style={[styles.textArea, { backgroundColor: inputBackground, borderColor, color: textColor }]}
                    textAlignVertical="top"
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void handleSubmit();
                  }}
                  disabled={isSubmitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor: primaryButtonBackground,
                      opacity: pressed && !isSubmitting ? 0.9 : 1,
                    },
                    isSubmitting ? styles.submitButtonDisabled : null,
                  ]}
                >
                  <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: primaryButtonText }]}> 
                    {isSubmitting ? 'Submitting…' : 'Submit Pit Data'}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  tabBar: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, gap: 8 },
  tabButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabButtonText: { fontSize: 16 },
  buttonPressed: { opacity: 0.85 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 48, gap: 24 },
  section: { gap: 24 },
  fieldGroup: { gap: 12 },
  fieldLabel: { fontSize: 16 },
  dropdownField: { borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
  dropdownText: { fontSize: 16 },
  dropdownList: { borderRadius: 12, borderWidth: 1, marginTop: 8, overflow: 'hidden' },
  dropdownOption: { paddingVertical: 12, paddingHorizontal: 16 },
  dropdownOptionText: { fontSize: 16 },
  input: { borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16 },
  textArea: { borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, minHeight: 120, fontSize: 16 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  toggleButton: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  toggleButtonText: { fontSize: 14 },
  inlineFields: { flexDirection: 'row', gap: 12 },
  inlineField: { flex: 1, gap: 12 },
  submitButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 16 },
});
