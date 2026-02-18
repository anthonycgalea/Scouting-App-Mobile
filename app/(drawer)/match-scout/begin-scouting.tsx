import type { ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { and, eq } from "drizzle-orm";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { getDbOrThrow, schema } from "@/db";
import type { MatchSchedule } from "@/db/schema";
import { syncAlreadyScoutedEntries } from "../../services/already-scouted";
import { apiRequest } from "../../services/api";
import { getActiveEvent } from "../../services/logged-in-event";
import { syncAlreadyPrescoutedEntries } from "../../services/prescouted";

import { ScreenContainer } from "@/components/layout/ScreenContainer";
import { ThemedText } from "@/components/themed-text";
import { useOrganization } from "@/hooks/use-organization";
import { useThemeColor } from "@/hooks/use-theme-color";

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseInteger = (value: string | undefined) => {
  if (!value) {
    return Number.NaN;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

type BeginScoutingParams = {
  mode?: string | string[];
  teamNumber?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  driverStation?: string | string[];
  matchLevel?: string | string[];
  allianceColor?: string | string[];
  alliance_color?: string | string[];
  stationPosition?: string | string[];
  station_position?: string | string[];
  driverStationPosition?: string | string[];
  driver_station_position?: string | string[];
  team_number?: string | string[];
  match_number?: string | string[];
  event_key?: string | string[];
  match_level?: string | string[];
  driver_station?: string | string[];
};

type PhaseCounts = {
  fuelScored: number;
  fuelPassed: number;
};

type PhaseKey = keyof PhaseCounts;

type LimitConfig = Record<PhaseKey, { auto: number; teleop: number }>;

const limitConfig: LimitConfig = {
  fuelScored: { auto: 500, teleop: 1500 },
  fuelPassed: { auto: 500, teleop: 1500 },
};

const createInitialPhaseCounts = (): PhaseCounts => ({
  fuelScored: 0,
  fuelPassed: 0,
});

const getNextPrescoutMatchNumber = (
  db: ReturnType<typeof getDbOrThrow>,
  eventKey: string,
  teamNumber: number,
) => {
  const localMatches = db
    .select({ matchNumber: schema.prescoutMatchData2025.matchNumber })
    .from(schema.prescoutMatchData2025)
    .where(
      and(
        eq(schema.prescoutMatchData2025.eventKey, eventKey),
        eq(schema.prescoutMatchData2025.teamNumber, teamNumber),
      ),
    )
    .all();

  let highestMatchNumber = 0;

  localMatches.forEach((row) => {
    const candidate = typeof row.matchNumber === "number" ? row.matchNumber : 0;
    if (candidate > highestMatchNumber) {
      highestMatchNumber = candidate;
    }
  });

  const recordedMatches = db
    .select({ matchNumber: schema.alreadyPrescouteds.matchNumber })
    .from(schema.alreadyPrescouteds)
    .where(
      and(
        eq(schema.alreadyPrescouteds.eventKey, eventKey),
        eq(schema.alreadyPrescouteds.teamNumber, teamNumber),
      ),
    )
    .all();

  recordedMatches.forEach((row) => {
    const candidate = typeof row.matchNumber === "number" ? row.matchNumber : 0;
    if (candidate > highestMatchNumber) {
      highestMatchNumber = candidate;
    }
  });

  return highestMatchNumber + 1;
};

const getMatchLevelLabel = (matchLevel: string | undefined) => {
  const normalized = matchLevel?.toLowerCase();

  switch (normalized) {
    case "qm":
      return "QM";
    case "sf":
      return "P";
    case "qf":
      return "Quarters";
    case "f":
      return "F";
    default:
      return matchLevel?.toUpperCase() ?? "";
  }
};

const toTitleCase = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase();
};

const buildDriverStationLabel = (
  driverStation: string | undefined,
  allianceColor: string | undefined,
  stationPosition: string | undefined,
) => {
  if (driverStation) {
    return driverStation;
  }

  if (!allianceColor) {
    return undefined;
  }

  const formattedColor = toTitleCase(allianceColor);
  const trimmedPosition = stationPosition?.trim();

  if (formattedColor && trimmedPosition) {
    return `${formattedColor} ${trimmedPosition}`;
  }

  return formattedColor ?? undefined;
};

const formatMatchHeader = (
  eventKey: string | undefined,
  matchLevel: string | undefined,
  matchNumber: string | undefined,
  teamNumber: string | undefined,
  driverStationLabel: string | undefined,
) => {
  if (!eventKey || !matchNumber || !teamNumber || !driverStationLabel) {
    return undefined;
  }

  const levelLabel = getMatchLevelLabel(matchLevel);
  const matchPrefix = levelLabel || matchLevel;
  const matchLabel = matchPrefix
    ? `${matchPrefix}${matchNumber}`
    : `Match ${matchNumber}`;

  return `${matchLabel}: ${teamNumber} (${driverStationLabel})`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const DRIVER_STATION_SLOTS = [
  "red1",
  "red2",
  "red3",
  "blue1",
  "blue2",
  "blue3",
] as const;
type DriverStationSlot = (typeof DRIVER_STATION_SLOTS)[number];
type DriverStationColumn = keyof Pick<
  MatchSchedule,
  "red1Id" | "red2Id" | "red3Id" | "blue1Id" | "blue2Id" | "blue3Id"
>;

const DRIVER_STATION_COLUMN_MAP: Record<
  DriverStationSlot,
  DriverStationColumn
> = {
  red1: "red1Id",
  red2: "red2Id",
  red3: "red3Id",
  blue1: "blue1Id",
  blue2: "blue2Id",
  blue3: "blue3Id",
};

const isDriverStationSlot = (value: string): value is DriverStationSlot =>
  DRIVER_STATION_SLOTS.includes(value as DriverStationSlot);

const formatDriverStationLabelFromSlot = (slot: DriverStationSlot) => {
  const color = slot.startsWith("red") ? "Red" : "Blue";
  const position = slot.slice(-1);

  return `${color} ${position}`;
};

const parseDriverStationSlot = ({
  driverStationLabel,
  allianceColor,
  stationPosition,
}: {
  driverStationLabel?: string;
  allianceColor?: string | null;
  stationPosition?: string | null;
}): DriverStationSlot | undefined => {
  const normalizedAlliance = allianceColor?.trim().toLowerCase();
  const normalizedPosition = stationPosition?.trim().match(/\d/);

  if (normalizedAlliance && normalizedPosition) {
    const candidate = `${normalizedAlliance}${normalizedPosition[0]}`;

    if (isDriverStationSlot(candidate)) {
      return candidate;
    }
  }

  const normalizedLabel = driverStationLabel?.trim().toLowerCase();

  if (normalizedLabel) {
    const labelMatch = normalizedLabel.match(/(red|blue)\s*([123])/);

    if (labelMatch) {
      const candidate = `${labelMatch[1]}${labelMatch[2]}`;

      if (isDriverStationSlot(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
};

const MATCH_LEVEL_SORT_ORDER = ["qm", "ef", "of", "qf", "sf", "f"] as const;

const getMatchLevelPriority = (matchLevel: string) => {
  const normalized = (matchLevel ?? "").trim().toLowerCase();
  const index = MATCH_LEVEL_SORT_ORDER.indexOf(
    normalized as (typeof MATCH_LEVEL_SORT_ORDER)[number],
  );

  return index === -1 ? MATCH_LEVEL_SORT_ORDER.length : index;
};

const buildNextMatchParams = (
  schedule: MatchSchedule[],
  {
    eventKey,
    currentMatchLevel,
    currentMatchNumber,
    driverStationSlot,
    driverStationLabel,
  }: {
    eventKey: string;
    currentMatchLevel: string;
    currentMatchNumber: number;
    driverStationSlot: DriverStationSlot;
    driverStationLabel?: string;
  },
) => {
  const relevantMatches = schedule
    .filter((match) => match.eventKey === eventKey)
    .sort((a, b) => {
      const levelDelta =
        getMatchLevelPriority(a.matchLevel) -
        getMatchLevelPriority(b.matchLevel);

      if (levelDelta !== 0) {
        return levelDelta;
      }

      return a.matchNumber - b.matchNumber;
    });

  const normalizedCurrentLevel = (currentMatchLevel ?? "").trim().toLowerCase();
  const currentIndex = relevantMatches.findIndex(
    (match) =>
      match.matchNumber === currentMatchNumber &&
      (match.matchLevel ?? "").trim().toLowerCase() === normalizedCurrentLevel,
  );

  if (currentIndex === -1) {
    return null;
  }

  const columnKey = DRIVER_STATION_COLUMN_MAP[driverStationSlot];

  for (
    let index = currentIndex + 1;
    index < relevantMatches.length;
    index += 1
  ) {
    const candidate = relevantMatches[index];
    const candidateLevel = (candidate.matchLevel ?? "").trim().toLowerCase();

    if (candidateLevel !== normalizedCurrentLevel) {
      break;
    }

    const teamNumber = candidate[columnKey];

    if (typeof teamNumber === "number" && Number.isFinite(teamNumber)) {
      const allianceColor = driverStationSlot.startsWith("red")
        ? "red"
        : "blue";
      const stationPosition = driverStationSlot.slice(-1);
      const label =
        driverStationLabel ??
        formatDriverStationLabelFromSlot(driverStationSlot);

      return {
        eventKey: candidate.eventKey,
        event_key: candidate.eventKey,
        matchLevel: candidate.matchLevel,
        match_level: candidate.matchLevel,
        matchNumber: String(candidate.matchNumber),
        match_number: String(candidate.matchNumber),
        teamNumber: String(teamNumber),
        team_number: String(teamNumber),
        driverStation: label,
        driver_station: label,
        allianceColor,
        alliance_color: allianceColor,
        stationPosition,
        station_position: stationPosition,
        driverStationPosition: stationPosition,
        driver_station_position: stationPosition,
      } satisfies Record<string, string>;
    }
  }

  return null;
};

interface CounterControlProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onIncrementByFive: () => void;
  onIncrementByTwenty: () => void;
  onDecrement: () => void;
}

function CounterControl({
  label,
  value,
  onIncrement,
  onIncrementByFive,
  onIncrementByTwenty,
  onDecrement,
}: CounterControlProps) {
  const positiveBackground = useThemeColor(
    { light: "#475569", dark: "#1F2937" },
    "background",
  );
  const negativeBackground = useThemeColor(
    { light: "#334155", dark: "#111827" },
    "background",
  );

  return (
    <View style={styles.counterControl}>
      <View style={styles.counterButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={onIncrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonPositive,
            { backgroundColor: positiveBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText type="defaultSemiBold" style={styles.counterLabel}>
            {label}
          </ThemedText>
          <ThemedText type="title" style={styles.counterValue}>
            {value}
          </ThemedText>
          <ThemedText
            type="defaultSemiBold"
            style={styles.counterButtonAuxText}
          >
            +
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onIncrementByFive}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonPositive,
            { backgroundColor: positiveBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText type="defaultSemiBold" style={styles.counterButtonText}>
            +5
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onIncrementByTwenty}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonPositive,
            { backgroundColor: positiveBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText type="defaultSemiBold" style={styles.counterButtonText}>
            +20
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDecrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonNegative,
            { backgroundColor: negativeBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText type="defaultSemiBold" style={styles.counterButtonText}>
            -5
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

interface TabTransitionControlProps {
  incrementLabel: string;
  decrementLabel: string;
  onIncrement: () => void;
  onDecrement: () => void;
}

function TabTransitionControl({
  incrementLabel,
  decrementLabel,
  onIncrement,
  onDecrement,
}: TabTransitionControlProps) {
  const positiveBackground = useThemeColor(
    { light: "#475569", dark: "#1F2937" },
    "background",
  );
  const negativeBackground = useThemeColor(
    { light: "#CBD5F5", dark: "#0F172A" },
    "background",
  );
  const negativeText = useThemeColor(
    { light: "#1F2937", dark: "#CBD5F5" },
    "text",
  );

  return (
    <View style={[styles.counterControl, styles.tabTransitionControl]}>
      <View style={styles.counterButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={onIncrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonPositive,
            { backgroundColor: positiveBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={styles.tabTransitionHeading}
          >
            Next
          </ThemedText>
          <ThemedText type="title" style={styles.tabTransitionLabel}>
            {incrementLabel}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDecrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonNegative,
            styles.tabTransitionBackButton,
            { backgroundColor: negativeBackground, borderColor: negativeText },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={[styles.tabTransitionBackLabel, { color: negativeText }]}
          >
            {decrementLabel}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default function BeginScoutingRoute() {
  const params = useLocalSearchParams<BeginScoutingParams>();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const router = useRouter();

  const mode = toSingleValue(params.mode);
  const isPrescoutMode = mode === "prescout";
  const eventKey =
    toSingleValue(params.eventKey) ?? toSingleValue(params.event_key) ?? "";
  const matchLevel =
    toSingleValue(params.matchLevel) ?? toSingleValue(params.match_level);
  const initialMatchNumber =
    toSingleValue(params.matchNumber) ??
    toSingleValue(params.match_number) ??
    "";
  const initialTeamNumber =
    toSingleValue(params.teamNumber) ?? toSingleValue(params.team_number) ?? "";
  const driverStation =
    toSingleValue(params.driverStation) ?? toSingleValue(params.driver_station);
  const allianceColor =
    toSingleValue(params.allianceColor) ?? toSingleValue(params.alliance_color);
  const stationPosition =
    toSingleValue(params.stationPosition) ??
    toSingleValue(params.station_position) ??
    toSingleValue(params.driverStationPosition) ??
    toSingleValue(params.driver_station_position);
  const driverStationLabel = buildDriverStationLabel(
    driverStation,
    allianceColor,
    stationPosition,
  );

  const [activeEventFallback] = useState(() => getActiveEvent() ?? "");
  const resolvedEventKey = eventKey || activeEventFallback;
  const resolvedMatchLevelForDisplay = isPrescoutMode ? "qm" : matchLevel;

  const [teamNumber, setTeamNumber] = useState(initialTeamNumber);
  const [matchNumber, setMatchNumber] = useState(initialMatchNumber);
  const [selectedTab, setSelectedTab] = useState<
    "info" | "auto" | "teleop" | "endgame"
  >("info");
  const [autoCounts, setAutoCounts] = useState<PhaseCounts>(() =>
    createInitialPhaseCounts(),
  );
  const [teleCounts, setTeleCounts] = useState<PhaseCounts>(() =>
    createInitialPhaseCounts(),
  );
  const [endgameSelection, setEndgameSelection] = useState<
    "none" | "l1" | "l2" | "l3"
  >("none");
  const [generalNotes, setGeneralNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedOrganization } = useOrganization();

  const resetPrescoutForm = (nextMatchNumberValue: number) => {
    setSelectedTab("info");
    setAutoCounts(createInitialPhaseCounts());
    setTeleCounts(createInitialPhaseCounts());
    setEndgameSelection("none");
    setGeneralNotes("");
    setMatchNumber(String(nextMatchNumberValue));
  };

  useEffect(() => {
    if (isPrescoutMode) {
      setTeamNumber(initialTeamNumber);
    }
  }, [initialTeamNumber, isPrescoutMode]);

  const inputBackground = useThemeColor(
    { light: "#FFFFFF", dark: "#0F172A" },
    "background",
  );
  const inputBorder = useThemeColor(
    { light: "#CBD5F5", dark: "#334155" },
    "background",
  );
  const textColor = useThemeColor({}, "text");
  const toggleContainerBackground = useThemeColor(
    { light: "#E2E8F0", dark: "#1F2937" },
    "background",
  );
  const toggleActiveBackground = useThemeColor(
    { light: "#2563EB", dark: "#1E3A8A" },
    "tint",
  );
  const toggleActiveTextColor = "#F8FAFC";
  const tabInactiveTextColor = useThemeColor(
    { light: "#334155", dark: "#CBD5F5" },
    "text",
  );

  const isAutoTab = selectedTab === "auto";
  const isTeleopTab = selectedTab === "teleop";
  const currentCounts = isAutoTab ? autoCounts : teleCounts;
  const hasPrefilledDetails = useMemo(() => {
    if (isPrescoutMode) {
      return Boolean(
        resolvedEventKey &&
        (matchNumber || initialMatchNumber) &&
        (teamNumber || initialTeamNumber),
      );
    }

    return Boolean(
      resolvedEventKey &&
      initialMatchNumber &&
      initialTeamNumber &&
      driverStationLabel,
    );
  }, [
    driverStationLabel,
    initialMatchNumber,
    initialTeamNumber,
    isPrescoutMode,
    matchNumber,
    resolvedEventKey,
    teamNumber,
  ]);
  const matchDetailsTitle = useMemo(() => {
    const matchNumberForHeader = isPrescoutMode
      ? matchNumber || initialMatchNumber
      : initialMatchNumber;
    const teamNumberForHeader = teamNumber || initialTeamNumber;
    const matchLevelForHeader = resolvedMatchLevelForDisplay;

    return formatMatchHeader(
      resolvedEventKey,
      matchLevelForHeader,
      matchNumberForHeader,
      teamNumberForHeader,
      driverStationLabel,
    );
  }, [
    driverStationLabel,
    initialMatchNumber,
    initialTeamNumber,
    isPrescoutMode,
    matchNumber,
    resolvedEventKey,
    resolvedMatchLevelForDisplay,
    teamNumber,
  ]);

  useLayoutEffect(() => {
    const headerTitle = matchDetailsTitle ?? "match-scout";
    const parentNavigation = navigation.getParent?.();
    const drawerNavigation = parentNavigation?.getParent?.();

    navigation.setOptions({
      headerTitle,
      title: headerTitle,
    });

    parentNavigation?.setOptions?.({
      headerTitle,
      title: headerTitle,
    });

    drawerNavigation?.setOptions?.({
      headerTitle,
      title: headerTitle,
    });

    return () => {
      const resetTitle = "match-scout";

      navigation.setOptions({ headerTitle: resetTitle, title: resetTitle });
      parentNavigation?.setOptions?.({
        headerTitle: resetTitle,
        title: resetTitle,
      });
      drawerNavigation?.setOptions?.({
        headerTitle: resetTitle,
        title: resetTitle,
      });
    };
  }, [navigation, matchDetailsTitle]);

  const handleAdjust = (key: PhaseKey, delta: number) => {
    const limit = isAutoTab ? limitConfig[key].auto : limitConfig[key].teleop;
    const setCounts = isAutoTab ? setAutoCounts : setTeleCounts;

    setCounts((prev) => {
      const nextValue = clamp(prev[key] + delta, 0, limit);

      if (nextValue === prev[key]) {
        return prev;
      }

      return {
        ...prev,
        [key]: nextValue,
      };
    });
  };

  const infoTeamNumber = teamNumber || initialTeamNumber || "---";
  const infoMatchNumber = matchNumber || initialMatchNumber || "---";
  const infoDetails = [
    { label: "Team Number", value: infoTeamNumber },
    { label: "Match Number", value: infoMatchNumber },
    { label: "Event", value: resolvedEventKey || "Not specified" },
    { label: "Driver Station", value: driverStationLabel ?? "Not specified" },
  ];
  const tabOptions = [
    { key: "info", label: "Info" },
    { key: "auto", label: "Auto" },
    { key: "teleop", label: "Teleop" },
    { key: "endgame", label: "Endgame" },
  ] as const;
  const endgameOptions = [
    { key: "l3", label: "L3" },
    { key: "l2", label: "L2" },
    { key: "l1", label: "L1" },
    { key: "none", label: "None" },
  ] as const;

  useEffect(() => {
    if (!isPrescoutMode) {
      return;
    }

    const normalizedEventKey = resolvedEventKey.trim();
    const teamNumberCandidate = (teamNumber || initialTeamNumber).trim();

    if (!normalizedEventKey || !teamNumberCandidate) {
      return;
    }

    const parsedTeamNumber = parseInteger(teamNumberCandidate);

    if (Number.isNaN(parsedTeamNumber)) {
      return;
    }

    const db = getDbOrThrow();
    const nextMatchNumber = getNextPrescoutMatchNumber(
      db,
      normalizedEventKey,
      parsedTeamNumber,
    );
    const nextMatchNumberValue = String(nextMatchNumber);

    if (matchNumber !== nextMatchNumberValue) {
      setMatchNumber(nextMatchNumberValue);
    }
  }, [
    initialTeamNumber,
    isPrescoutMode,
    matchNumber,
    resolvedEventKey,
    teamNumber,
  ]);

  const submitMatchData = async ({
    normalizedEventKey,
    resolvedMatchLevel,
    parsedTeamNumber,
    parsedMatchNumber,
    normalizedNotes,
    endgameValue,
  }: {
    normalizedEventKey: string;
    resolvedMatchLevel: string;
    parsedTeamNumber: number;
    parsedMatchNumber: number | null;
    normalizedNotes: string;
    endgameValue: "NONE" | "PARK" | "SHALLOW" | "DEEP";
  }) => {
    setIsSubmitting(true);

    try {
      const db = getDbOrThrow();
      const sharedRecordFields = {
        eventKey: normalizedEventKey,
        teamNumber: parsedTeamNumber,
        matchLevel: resolvedMatchLevel,
        notes: normalizedNotes,
        al4c: autoCounts.fuelScored,
        al3c: 0,
        al2c: 0,
        al1c: 0,
        tl4c: teleCounts.fuelScored,
        tl3c: 0,
        tl2c: 0,
        tl1c: 0,
        aProcessor: autoCounts.fuelPassed,
        tProcessor: teleCounts.fuelPassed,
        aNet: 0,
        tNet: 0,
        endgame: endgameValue,
      };

      if (isPrescoutMode) {
        const nextMatchNumber = getNextPrescoutMatchNumber(
          db,
          normalizedEventKey,
          parsedTeamNumber,
        );

        const prescoutRecord: typeof schema.prescoutMatchData2025.$inferInsert =
          {
            ...sharedRecordFields,
            matchNumber: nextMatchNumber,
          };

        await db
          .insert(schema.prescoutMatchData2025)
          .values(prescoutRecord)
          .onConflictDoUpdate({
            target: [
              schema.prescoutMatchData2025.eventKey,
              schema.prescoutMatchData2025.teamNumber,
              schema.prescoutMatchData2025.matchNumber,
              schema.prescoutMatchData2025.matchLevel,
            ],
            set: {
              notes: prescoutRecord.notes,
              al4c: prescoutRecord.al4c,
              al3c: prescoutRecord.al3c,
              al2c: prescoutRecord.al2c,
              al1c: prescoutRecord.al1c,
              tl4c: prescoutRecord.tl4c,
              tl3c: prescoutRecord.tl3c,
              tl2c: prescoutRecord.tl2c,
              tl1c: prescoutRecord.tl1c,
              aProcessor: prescoutRecord.aProcessor,
              tProcessor: prescoutRecord.tProcessor,
              aNet: prescoutRecord.aNet,
              tNet: prescoutRecord.tNet,
              endgame: prescoutRecord.endgame,
            },
          })
          .run();

        await db
          .insert(schema.alreadyPrescouteds)
          .values({
            eventKey: normalizedEventKey,
            teamNumber: parsedTeamNumber,
            matchNumber: nextMatchNumber,
            matchLevel: resolvedMatchLevel,
          })
          .onConflictDoNothing()
          .run();

        const [row] = await db
          .select()
          .from(schema.prescoutMatchData2025)
          .where(
            and(
              eq(schema.prescoutMatchData2025.eventKey, normalizedEventKey),
              eq(schema.prescoutMatchData2025.teamNumber, parsedTeamNumber),
              eq(schema.prescoutMatchData2025.matchNumber, nextMatchNumber),
              eq(schema.prescoutMatchData2025.matchLevel, resolvedMatchLevel),
            ),
          )
          .limit(1);

        if (!row) {
          throw new Error("Failed to retrieve submitted prescout data.");
        }

        resetPrescoutForm(nextMatchNumber + 1);

        try {
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 5000);

          try {
            await apiRequest("/scout/prescout", {
              method: "POST",
              body: JSON.stringify(row),
              signal: abortController.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          try {
            await syncAlreadyPrescoutedEntries(normalizedEventKey);
          } catch (syncError) {
            console.error(
              "Failed to refresh already prescouted entries from API",
              syncError,
            );
          }

          Alert.alert(
            "Prescout submitted",
            "Prescout data was saved and sent successfully.",
            [
              {
                text: "OK",
              },
            ],
          );
        } catch (error) {
          console.error("Failed to submit prescout data to API", error);
          Alert.alert(
            "Prescout saved locally",
            "The prescout data was saved on this device but could not be sent to the server.",
            [
              {
                text: "OK",
              },
            ],
          );
        }

        return;
      }

      if (parsedMatchNumber == null) {
        throw new Error("Match number is required to submit match data.");
      }

      const row: typeof schema.matchData2025.$inferInsert = {
        ...sharedRecordFields,
        matchNumber: parsedMatchNumber,
      };

      const driverStationSlot = parseDriverStationSlot({
        driverStationLabel,
        allianceColor,
        stationPosition,
      });

      let nextMatchParams: Record<string, string> | null = null;

      if (driverStationSlot) {
        const scheduleRows = await db
          .select()
          .from(schema.matchSchedules)
          .where(eq(schema.matchSchedules.eventKey, normalizedEventKey));

        nextMatchParams = buildNextMatchParams(scheduleRows, {
          eventKey: normalizedEventKey,
          currentMatchLevel: resolvedMatchLevel,
          currentMatchNumber: parsedMatchNumber,
          driverStationSlot,
          driverStationLabel,
        });
      }

      const navigateToNextMatch = () => {
        if (nextMatchParams) {
          router.replace({
            pathname: "/(drawer)/match-scout/begin-scouting",
            params: nextMatchParams,
          });
        } else {
          router.replace("/(drawer)/match-scout");
        }
      };

      const showNextMatchAlert = (title: string, message: string) => {
        const buttonLabel = nextMatchParams ? "Next Match" : "OK";

        Alert.alert(
          title,
          message,
          [
            {
              text: buttonLabel,
              onPress: navigateToNextMatch,
            },
          ],
          { cancelable: false },
        );
      };

      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 5000);

        try {
          await apiRequest("/scout/submit", {
            method: "POST",
            body: JSON.stringify(row),
            signal: abortController.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        try {
          await syncAlreadyScoutedEntries(selectedOrganization!.id);
        } catch (syncError) {
          console.error(
            "Failed to refresh already scouted entries from API",
            syncError,
          );
        }

        showNextMatchAlert(
          "Match submitted",
          "Match data was submitted successfully.",
        );
      } catch (error) {
        console.error("Failed to submit match data to API", error);
        showNextMatchAlert(
          "Unable to submit match",
          "The match data could not be sent to the server.",
        );
      }
    } catch (error) {
      console.error("Failed to save match data", error);
      Alert.alert(
        "Unable to save match",
        "An error occurred while saving match data.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (isSubmitting) {
      return;
    }

    if (!selectedOrganization && !isPrescoutMode) {
      Alert.alert(
        "Select an organization",
        "Choose the organization you are scouting for before submitting match data.",
      );
      return;
    }

    const normalizedEventKey = resolvedEventKey.trim();
    const resolvedMatchLevel = isPrescoutMode ? "qm" : matchLevel?.trim();
    const resolvedTeamNumber = teamNumber || initialTeamNumber;

    const parsedTeamNumber = parseInteger(resolvedTeamNumber);
    const parsedMatchNumberCandidate = parseInteger(
      matchNumber || initialMatchNumber,
    );

    if (!normalizedEventKey) {
      Alert.alert(
        isPrescoutMode ? "No event selected" : "Missing match details",
        isPrescoutMode
          ? "Select an event before submitting prescout data."
          : "An event key and match level are required before submitting match data.",
      );
      return;
    }

    if (!resolvedMatchLevel) {
      Alert.alert(
        "Missing match details",
        "A match level is required before submitting match data.",
      );
      return;
    }

    if (Number.isNaN(parsedTeamNumber)) {
      Alert.alert(
        "Invalid match details",
        "Team number must be a valid number before submitting match data.",
      );
      return;
    }

    if (!isPrescoutMode && Number.isNaN(parsedMatchNumberCandidate)) {
      Alert.alert(
        "Invalid match details",
        "Team number and match number must be valid numbers before submitting match data.",
      );
      return;
    }

    const noteValue = generalNotes.trim();
    const normalizedNotes = noteValue.length > 0 ? noteValue : "";

    const endgameMap = {
      none: "NONE",
      l1: "PARK",
      l2: "SHALLOW",
      l3: "DEEP",
    } as const;

    const endgameValue = endgameMap[endgameSelection];

    const submissionDetails = {
      normalizedEventKey,
      resolvedMatchLevel,
      parsedTeamNumber,
      parsedMatchNumber: isPrescoutMode ? null : parsedMatchNumberCandidate,
      normalizedNotes,
      endgameValue,
    };

    Alert.alert(
      "Submit match?",
      "Are you sure you would like to submit this match?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Submit",
          onPress: () => {
            void submitMatchData(submissionDetails);
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: toggleContainerBackground,
              borderColor: inputBorder,
            },
          ]}
        >
          {tabOptions.map((tab) => {
            const isSelected = selectedTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                onPress={() => setSelectedTab(tab.key)}
                style={({ pressed }) => [
                  styles.tabButton,
                  {
                    backgroundColor: isSelected
                      ? toggleActiveBackground
                      : "transparent",
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <ThemedText
                  type="defaultSemiBold"
                  style={[
                    styles.tabButtonText,
                    {
                      color: isSelected
                        ? toggleActiveTextColor
                        : tabInactiveTextColor,
                    },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {selectedTab === "info" ? (
          <View style={styles.infoSection}>
            <View
              style={[
                styles.infoCard,
                { borderColor: inputBorder, backgroundColor: inputBackground },
              ]}
            >
              {infoDetails.map((detail) => (
                <View key={detail.label} style={styles.infoRow}>
                  <ThemedText type="defaultSemiBold">{detail.label}</ThemedText>
                  <ThemedText>{detail.value}</ThemedText>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedTab("auto")}
              style={({ pressed }) => [
                styles.beginScoutingButton,
                { backgroundColor: toggleActiveBackground },
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText
                type="defaultSemiBold"
                style={[
                  styles.beginScoutingButtonText,
                  { color: toggleActiveTextColor },
                ]}
              >
                Begin Scouting
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {isAutoTab || isTeleopTab ? (
          <View style={styles.scoringContent}>
            <View style={styles.detailsSection}>
              {!matchDetailsTitle && resolvedEventKey ? (
                <View style={styles.header}>
                  <ThemedText type="defaultSemiBold">
                    Event: {resolvedEventKey}
                  </ThemedText>
                </View>
              ) : null}

              {!hasPrefilledDetails ? (
                <View style={styles.formGrid}>
                  <View style={styles.inputGroup}>
                    <ThemedText type="defaultSemiBold">Team Number</ThemedText>
                    <TextInput
                      value={teamNumber}
                      onChangeText={setTeamNumber}
                      keyboardType="number-pad"
                      placeholder="Team Number"
                      placeholderTextColor="#94A3B8"
                      style={[
                        styles.input,
                        {
                          backgroundColor: inputBackground,
                          borderColor: inputBorder,
                          color: textColor,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <ThemedText type="defaultSemiBold">Match Number</ThemedText>
                    <TextInput
                      value={matchNumber}
                      onChangeText={setMatchNumber}
                      keyboardType="number-pad"
                      placeholder="Match Number"
                      placeholderTextColor="#94A3B8"
                      style={[
                        styles.input,
                        {
                          backgroundColor: inputBackground,
                          borderColor: inputBorder,
                          color: textColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <View style={styles.counterGrid}>
                <View style={styles.counterColumn}>
                  <CounterControl
                    label={`Fuel Scored`}
                    value={currentCounts.fuelScored}
                    onIncrement={() => handleAdjust("fuelScored", 1)}
                    onIncrementByFive={() => handleAdjust("fuelScored", 5)}
                    onIncrementByTwenty={() => handleAdjust("fuelScored", 20)}
                    onDecrement={() => handleAdjust("fuelScored", -5)}
                  />
                </View>
                <View style={styles.counterColumn}>
                  <CounterControl
                    label={`Fuel Passed`}
                    value={currentCounts.fuelPassed}
                    onIncrement={() => handleAdjust("fuelPassed", 1)}
                    onIncrementByFive={() => handleAdjust("fuelPassed", 5)}
                    onIncrementByTwenty={() => handleAdjust("fuelPassed", 20)}
                    onDecrement={() => handleAdjust("fuelPassed", -5)}
                  />
                </View>
              </View>
              {(isAutoTab || isTeleopTab) && (
                <View style={styles.transitionContainer}>
                  <TabTransitionControl
                    incrementLabel={isAutoTab ? "Teleop" : "Endgame"}
                    decrementLabel={isAutoTab ? "Info" : "Auto"}
                    onIncrement={() =>
                      setSelectedTab(isAutoTab ? "teleop" : "endgame")
                    }
                    onDecrement={() =>
                      setSelectedTab(isAutoTab ? "info" : "auto")
                    }
                  />
                </View>
              )}
            </View>
          </View>
        ) : null}

        {selectedTab === "endgame" ? (
          <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            <View style={styles.endgameSection}>
              <View style={styles.endgameContent}>
                <ThemedText type="title" style={styles.sectionTitle}>
                  Endgame
                </ThemedText>
                <View style={styles.endgameGrid}>
                  {endgameOptions.map((option) => {
                    const isSelected = endgameSelection === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        onPress={() => setEndgameSelection(option.key)}
                        style={({ pressed }) => [
                          styles.endgameButton,
                          {
                            backgroundColor: isSelected
                              ? toggleActiveBackground
                              : "transparent",
                            borderColor: isSelected
                              ? toggleActiveBackground
                              : inputBorder,
                          },
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <ThemedText
                          type="defaultSemiBold"
                          style={[
                            styles.endgameButtonText,
                            {
                              color: isSelected
                                ? toggleActiveTextColor
                                : tabInactiveTextColor,
                            },
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.generalNotesSection}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={styles.generalNotesLabel}
                  >
                    General Notes
                  </ThemedText>
                  <TextInput
                    multiline
                    numberOfLines={4}
                    placeholder="Add any observations or notes about the match"
                    placeholderTextColor="#94A3B8"
                    value={generalNotes}
                    onChangeText={setGeneralNotes}
                    onBlur={() => Keyboard.dismiss()}
                    style={[
                      styles.generalNotesInput,
                      {
                        backgroundColor: inputBackground,
                        borderColor: inputBorder,
                        color: textColor,
                      },
                    ]}
                    textAlignVertical="top"
                  />
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  (pressed || isSubmitting) && styles.buttonPressed,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
              >
                <ThemedText
                  type="defaultSemiBold"
                  style={styles.submitButtonText}
                >
                  {isSubmitting ? "Submitting…" : "Submit Match"}
                </ThemedText>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 24,
  },
  scoringContent: {
    flex: 1,
    gap: 24,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    alignSelf: "center",
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  tabButtonText: {
    fontSize: 16,
  },
  detailsSection: {
    gap: 24,
  },
  header: {
    gap: 4,
    alignItems: "center",
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  inputGroup: {
    flexBasis: "48%",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  phaseLabelContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  phaseLabel: {
    fontSize: 16,
  },
  section: {
    flex: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    textAlign: "center",
  },
  counterGrid: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    flex: 1,
    alignItems: "stretch",
  },
  counterColumn: {
    flex: 1,
    gap: 12,
  },
  transitionContainer: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  counterControl: {
    gap: 12,
    alignItems: "stretch",
    minWidth: 150,
    flex: 1,
  },
  tabTransitionControl: {
    flex: 2,
    minHeight: 160,
  },
  counterLabel: {
    fontSize: 14,
    textAlign: "center",
    color: "#E2E8F0",
  },
  counterValue: {
    fontSize: 28,
    color: "#F8FAFC",
  },
  counterButtons: {
    flexDirection: "column",
    gap: 0,
    width: "100%",
    flexGrow: 1,
    flex: 1,
  },
  counterButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  counterButtonPositive: {
    flex: 3,
    gap: 8,
  },
  counterButtonNegative: {
    flex: 1,
  },
  tabTransitionBackButton: {
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonText: {
    color: "#F8FAFC",
    fontSize: 20,
  },
  counterButtonAuxText: {
    color: "#E2E8F0",
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  infoSection: {
    gap: 16,
  },
  beginScoutingButton: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    alignSelf: "center",
  },
  beginScoutingButtonText: {
    fontSize: 16,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoDescription: {
    textAlign: "center",
  },
  endgameSection: {
    gap: 16,
    flex: 1,
  },
  endgameContent: {
    gap: 16,
    flex: 1,
  },
  endgameGrid: {
    flexDirection: "column",
    gap: 12,
  },
  endgameButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  endgameButtonText: {
    fontSize: 16,
  },
  generalNotesSection: {
    gap: 8,
  },
  generalNotesLabel: {
    fontSize: 16,
  },
  generalNotesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#F8FAFC",
    fontSize: 18,
  },
  tabTransitionHeading: {
    color: "#E2E8F0",
    fontSize: 14,
  },
  tabTransitionLabel: {
    color: "#F8FAFC",
    fontSize: 24,
    textAlign: "center",
  },
  tabTransitionBackLabel: {
    fontSize: 16,
    textAlign: "center",
  },
});
