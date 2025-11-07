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
import { SmallScreenHeader } from '@/components/layout/SmallScreenHeader';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useOrganization } from '@/hooks/use-organization';
import { getDbOrThrow, schema } from '@/db';
import type { NewPitData2025 } from '@/db/schema';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { submitPitScoutData, syncAlreadyPitScoutedEntries } from '@/app/services/pit-scouting';

const DRIVETRAIN_OPTIONS = [
  { label: 'Swerve', value: 'SWERVE' },
  { label: 'Tank', value: 'TANK' },
  { label: 'Mecanum', value: 'MECANUM' },
  { label: 'H-Drive', value: 'H-DRIVE' },
  { label: 'Other', value: 'OTHER' },
] as const;

const TAB_OPTIONS = [
  { key: 'general', label: 'General' },
  { key: 'auto', label: 'Auto' },
  { key: 'teleop', label: 'Teleop' },
  { key: 'endgame', label: 'Endgame' },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['key'];

type ToggleState<T extends string> = Record<T, boolean>;

const START_POSITIONS = [
  { key: 'LEFT', label: 'LEFT' },
  { key: 'CENTER', label: 'CENTER' },
  { key: 'RIGHT', label: 'RIGHT' },
] as const;

const AUTO_SCORING_LEVELS = [
  { key: 'L1', label: 'L1' },
  { key: 'L2', label: 'L2' },
  { key: 'L3', label: 'L3' },
  { key: 'L4', label: 'L4' },
] as const;

const TELE_PICKUP_LOCATIONS = [
  { key: 'FEEDER', label: 'FEEDER' },
  { key: 'FLOOR', label: 'FLOOR' },
] as const;

const TELE_SCORING_LEVELS = AUTO_SCORING_LEVELS;

const TELE_PROCESSING_LOCATIONS = [
  { key: 'NET', label: 'Net' },
  { key: 'PROCESSOR', label: 'Processor' },
] as const;

const ENDGAME_OPTIONS = [
  { key: 'NONE', label: 'None' },
  { key: 'SHALLOW', label: 'Shallow' },
  { key: 'DEEP', label: 'Deep' },
] as const;

type StartPositionKey = (typeof START_POSITIONS)[number]['key'];
type ScoringLevelKey = (typeof AUTO_SCORING_LEVELS)[number]['key'];
type TelePickupKey = (typeof TELE_PICKUP_LOCATIONS)[number]['key'];
type TeleProcessingKey = (typeof TELE_PROCESSING_LOCATIONS)[number]['key'];
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

const parseCountValue = (value: string) => {
  const parsed = parseOptionalInteger(value);

  return parsed ?? 0;
};

const normalizeNoteField = (value: string) => value.trim();

export default function PitScoutTeamDetailsScreen() {
  const params = useLocalSearchParams<{ teamNumber?: string | string[]; teamName?: string | string[] }>();
  const router = useRouter();
  const { selectedOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabKey>('general');
  const [drivetrain, setDrivetrain] = useState<(typeof DRIVETRAIN_OPTIONS)[number]['value']>('SWERVE');
  const [showDrivetrainOptions, setShowDrivetrainOptions] = useState(false);
  const [robotWeight, setRobotWeight] = useState('');
  const [driveTeam, setDriveTeam] = useState('');
  const [autoCoralCount, setAutoCoralCount] = useState('');
  const [autoAlgaeNet, setAutoAlgaeNet] = useState('');
  const [autoAlgaeProcessor, setAutoAlgaeProcessor] = useState('');
  const [autoNotes, setAutoNotes] = useState('');
  const [teleNotes, setTeleNotes] = useState('');
  const [overallNotes, setOverallNotes] = useState('');
  const [autoStartPositions, setAutoStartPositions] = useState<ToggleState<StartPositionKey>>(() =>
    createInitialToggleState(START_POSITIONS)
  );
  const [autoScoringTargets, setAutoScoringTargets] = useState<ToggleState<ScoringLevelKey>>(() =>
    createInitialToggleState(AUTO_SCORING_LEVELS)
  );
  const [telePickupLocations, setTelePickupLocations] = useState<ToggleState<TelePickupKey>>(() =>
    createInitialToggleState(TELE_PICKUP_LOCATIONS)
  );
  const [teleScoringTargets, setTeleScoringTargets] = useState<ToggleState<ScoringLevelKey>>(() =>
    createInitialToggleState(TELE_SCORING_LEVELS)
  );
  const [teleProcessingTargets, setTeleProcessingTargets] = useState<ToggleState<TeleProcessingKey>>(() =>
    createInitialToggleState(TELE_PROCESSING_LOCATIONS)
  );
  const [endgameSelection, setEndgameSelection] = useState<EndgameKey>('NONE');

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

    return match?.label ?? 'Swerve';
  }, [drivetrain]);

  const handleTabSelect = (tab: TabKey) => {
    setSelectedTab(tab);
    Keyboard.dismiss();
    setShowDrivetrainOptions(false);
  };

  const toggleSelection = <T extends string>(
    updater: Dispatch<SetStateAction<ToggleState<T>>>,
    key: T
  ) => {
    updater((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleCloseInputs = () => {
    Keyboard.dismiss();
    setShowDrivetrainOptions(false);
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
      Alert.alert(
        'Select an organization',
        'Choose the organization you are scouting for before submitting pit scouting data.'
      );
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

      const pitDataValues: NewPitData2025 = {
        eventKey,
        teamNumber: parsedTeamNumber,
        notes: '',
        drivetrain,
        driveteam: driveTeam.trim() ? driveTeam.trim() : '',
        robotWeight: parseOptionalInteger(robotWeight),
        autoNotes: normalizeNoteField(autoNotes),
        teleNotes: normalizeNoteField(teleNotes),
        overallNotes: normalizeNoteField(overallNotes),
        autoCoralCount: parseCountValue(autoCoralCount),
        autoAlgaeNet: parseCountValue(autoAlgaeNet),
        autoAlgaeProcessor: parseCountValue(autoAlgaeProcessor),
        startPositionLeft: autoStartPositions.LEFT ? 1 : 0,
        startPositionCenter: autoStartPositions.CENTER ? 1 : 0,
        startPositionRight: autoStartPositions.RIGHT ? 1 : 0,
        autoL1Coral: autoScoringTargets.L1 ? 1 : 0,
        autoL2Coral: autoScoringTargets.L2 ? 1 : 0,
        autoL3Coral: autoScoringTargets.L3 ? 1 : 0,
        autoL4Coral: autoScoringTargets.L4 ? 1 : 0,
        teleL1Coral: teleScoringTargets.L1 ? 1 : 0,
        teleL2Coral: teleScoringTargets.L2 ? 1 : 0,
        teleL3Coral: teleScoringTargets.L3 ? 1 : 0,
        teleL4Coral: teleScoringTargets.L4 ? 1 : 0,
        pickupFeeder: telePickupLocations.FEEDER ? 1 : 0,
        pickupGround: telePickupLocations.FLOOR ? 1 : 0,
        teleAlgaeNet: teleProcessingTargets.NET ? 1 : 0,
        teleAlgaeProcessor: teleProcessingTargets.PROCESSOR ? 1 : 0,
        endgame: endgameSelection,
      };

      const { eventKey: _ignoredEventKey, teamNumber: _ignoredTeamNumber, ...pitDataUpdateValues } = pitDataValues;

      await db
        .insert(schema.pitData2025)
        .values(pitDataValues)
        .onConflictDoUpdate({
          target: [schema.pitData2025.eventKey, schema.pitData2025.teamNumber],
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
        .from(schema.pitData2025)
        .where(
          and(
            eq(schema.pitData2025.eventKey, eventKey),
            eq(schema.pitData2025.teamNumber, parsedTeamNumber)
          )
        )
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
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while submitting pit scouting data.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <SmallScreenHeader title={headerTitle} showBackButton />
      <TouchableWithoutFeedback onPress={handleCloseInputs} accessible={false}>
        <View style={styles.container}>
          <View
            style={[
              styles.tabBar,
              { backgroundColor: tabContainerBackground, borderColor },
            ]}
          >
            {TAB_OPTIONS.map((tab) => {
              const isSelected = selectedTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button"
                  onPress={() => handleTabSelect(tab.key)}
                  style={({ pressed }) => [
                    styles.tabButton,
                    { backgroundColor: isSelected ? toggleActiveBackground : 'transparent' },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={[
                      styles.tabButtonText,
                      { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {selectedTab === 'general' ? (
              <View style={styles.section}>
                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Drivetrain
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowDrivetrainOptions((previous) => !previous)}
                    style={({ pressed }) => [
                      styles.dropdownField,
                      {
                        backgroundColor: inputBackground,
                        borderColor,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.dropdownText,
                        { color: textColor },
                      ]}
                    >
                      {drivetrainLabel}
                    </ThemedText>
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
                              isSelected && {
                                backgroundColor: toggleActiveBackground,
                              },
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.dropdownOptionText,
                                { color: isSelected ? toggleActiveTextColor : textColor },
                              ]}
                            >
                              {option.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Robot Weight
                  </ThemedText>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="Enter robot weight"
                    placeholderTextColor={placeholderColor}
                    value={robotWeight}
                    onChangeText={setRobotWeight}
                    style={[
                      styles.input,
                      { backgroundColor: inputBackground, borderColor, color: textColor },
                    ]}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Drive team
                  </ThemedText>
                  <TextInput
                    placeholder="Enter drive team members"
                    placeholderTextColor={placeholderColor}
                    value={driveTeam}
                    onChangeText={setDriveTeam}
                    style={[
                      styles.input,
                      { backgroundColor: inputBackground, borderColor, color: textColor },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {selectedTab === 'auto' ? (
              <View style={styles.section}>
                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Where can your robot start from in autonomous?
                  </ThemedText>
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
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.toggleButtonText,
                              { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                            ]}
                          >
                            {position.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Where does your robot score in autonomous?
                  </ThemedText>
                  <View style={styles.toggleRow}>
                    {AUTO_SCORING_LEVELS.map((level) => {
                      const isSelected = autoScoringTargets[level.key];

                      return (
                        <Pressable
                          key={level.key}
                          accessibilityRole="button"
                          onPress={() => toggleSelection(setAutoScoringTargets, level.key)}
                          style={({ pressed }) => [
                            styles.toggleButton,
                            {
                              backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                              borderColor: isSelected ? toggleActiveBackground : borderColor,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.toggleButtonText,
                              { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                            ]}
                          >
                            {level.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inlineFields}>
                  <View style={styles.inlineField}>
                    <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                      How many coral?
                    </ThemedText>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={autoCoralCount}
                      onChangeText={setAutoCoralCount}
                      style={[
                        styles.input,
                        { backgroundColor: inputBackground, borderColor, color: textColor },
                      ]}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                      How many algae in the net?
                    </ThemedText>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={autoAlgaeNet}
                      onChangeText={setAutoAlgaeNet}
                      style={[
                        styles.input,
                        { backgroundColor: inputBackground, borderColor, color: textColor },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    How many algae in the processor?
                  </ThemedText>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={placeholderColor}
                    value={autoAlgaeProcessor}
                    onChangeText={setAutoAlgaeProcessor}
                    style={[
                      styles.input,
                      { backgroundColor: inputBackground, borderColor, color: textColor },
                    ]}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Notes on Autonomous
                  </ThemedText>
                  <TextInput
                    multiline
                    placeholder="Add notes about autonomous performance"
                    placeholderTextColor={placeholderColor}
                    value={autoNotes}
                    onChangeText={setAutoNotes}
                    style={[
                      styles.textArea,
                      { backgroundColor: inputBackground, borderColor, color: textColor },
                    ]}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ) : null}

            {selectedTab === 'teleop' ? (
              <View style={styles.section}>
                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Where can your robot pick up coral?
                  </ThemedText>
                  <View style={styles.toggleRow}>
                    {TELE_PICKUP_LOCATIONS.map((location) => {
                      const isSelected = telePickupLocations[location.key];

                      return (
                        <Pressable
                          key={location.key}
                          accessibilityRole="button"
                          onPress={() => toggleSelection(setTelePickupLocations, location.key)}
                          style={({ pressed }) => [
                            styles.toggleButton,
                            {
                              backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                              borderColor: isSelected ? toggleActiveBackground : borderColor,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.toggleButtonText,
                              { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                            ]}
                          >
                            {location.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Where can your robot score coral?
                  </ThemedText>
                  <View style={styles.toggleRow}>
                    {TELE_SCORING_LEVELS.map((level) => {
                      const isSelected = teleScoringTargets[level.key];

                      return (
                        <Pressable
                          key={level.key}
                          accessibilityRole="button"
                          onPress={() => toggleSelection(setTeleScoringTargets, level.key)}
                          style={({ pressed }) => [
                            styles.toggleButton,
                            {
                              backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                              borderColor: isSelected ? toggleActiveBackground : borderColor,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.toggleButtonText,
                              { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                            ]}
                          >
                            {level.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Can your robot score in the
                  </ThemedText>
                  <View style={styles.toggleRow}>
                    {TELE_PROCESSING_LOCATIONS.map((location) => {
                      const isSelected = teleProcessingTargets[location.key];

                      return (
                        <Pressable
                          key={location.key}
                          accessibilityRole="button"
                          onPress={() => toggleSelection(setTeleProcessingTargets, location.key)}
                          style={({ pressed }) => [
                            styles.toggleButton,
                            {
                              backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                              borderColor: isSelected ? toggleActiveBackground : borderColor,
                            },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.toggleButtonText,
                              { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                            ]}
                          >
                            {location.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Teleop Notes
                  </ThemedText>
                  <TextInput
                    multiline
                    placeholder="Add notes about teleop performance"
                    placeholderTextColor={placeholderColor}
                    value={teleNotes}
                    onChangeText={setTeleNotes}
                    style={[
                      styles.textArea,
                      { backgroundColor: inputBackground, borderColor, color: textColor },
                    ]}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ) : null}

            {selectedTab === 'endgame' ? (
              <View style={styles.section}>
                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Does your robot climb?
                  </ThemedText>
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
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.toggleButtonText,
                              { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                            ]}
                          >
                            {option.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
                    Overall notes
                  </ThemedText>
                  <TextInput
                    multiline
                    placeholder="Share any overall observations"
                    placeholderTextColor={placeholderColor}
                    value={overallNotes}
                    onChangeText={setOverallNotes}
                    style={[
                      styles.textArea,
                      { backgroundColor: inputBackground, borderColor, color: textColor },
                    ]}
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
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
    gap: 24,
  },
  section: {
    gap: 24,
  },
  fieldGroup: {
    gap: 12,
  },
  fieldLabel: {
    fontSize: 16,
  },
  dropdownField: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownText: {
    fontSize: 16,
  },
  dropdownList: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownOptionText: {
    fontSize: 16,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  toggleButtonText: {
    fontSize: 16,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  inlineField: {
    flex: 1,
    minWidth: 140,
    gap: 12,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
  },
});
