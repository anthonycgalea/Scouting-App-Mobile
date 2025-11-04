import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { and, eq } from 'drizzle-orm';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getDbOrThrow, schema } from '@/db';
import { getActiveEvent } from '@/app/services/logged-in-event';
import {
  ensureCameraPermission,
  ensureRobotPhotoStoragePermission,
  takeRobotPhoto,
} from '@/src/services/robotPhotos';

interface PhotoItem {
  id: number;
  uri: string;
  createdAt: number;
}

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const IMAGE_HORIZONTAL_PADDING = 32;

const getCarouselImageWidth = () => {
  const calculatedWidth = WINDOW_WIDTH - IMAGE_HORIZONTAL_PADDING;

  return Math.max(240, calculatedWidth);
};

export function TeamRobotPhotosScreen() {
  const params = useLocalSearchParams<{ teamNumber?: string | string[]; teamName?: string | string[] }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const buttonTextColor = '#F8FAFC';
  const mutedTextColor = useThemeColor({ light: '#475569', dark: '#CBD5F5' }, 'text');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const backgroundCard = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const backButtonBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');
  const backButtonTextColor = useThemeColor({ light: '#0F172A', dark: '#E2E8F0' }, 'text');

  const teamNumberParam = Array.isArray(params.teamNumber) ? params.teamNumber[0] : params.teamNumber;
  const teamNameParam = Array.isArray(params.teamName) ? params.teamName[0] : params.teamName;

  const teamNumber = useMemo(() => {
    if (!teamNumberParam) {
      return null;
    }

    const parsed = Number.parseInt(teamNumberParam, 10);

    return Number.isNaN(parsed) ? null : parsed;
  }, [teamNumberParam]);

  const headerTitle = [teamNumberParam, teamNameParam].filter(Boolean).join(' - ') || 'Team Photos';
  const imageWidth = getCarouselImageWidth();

  const loadPhotos = useCallback(() => {
    if (teamNumber === null) {
      throw new Error('Missing team number. Please return to the team list and select a team again.');
    }

    const eventKey = getActiveEvent();

    if (!eventKey) {
      throw new Error('No active event found. Please select an event to view robot photos.');
    }

    const db = getDbOrThrow();
    const rows = db
      .select({
        id: schema.robotPhotos.id,
        createdAt: schema.robotPhotos.createdAt,
        localUri: schema.robotPhotos.localUri,
        remoteUrl: schema.robotPhotos.remoteUrl,
      })
      .from(schema.robotPhotos)
      .where(and(eq(schema.robotPhotos.eventKey, eventKey), eq(schema.robotPhotos.teamNumber, teamNumber)))
      .all();

    const mapped: PhotoItem[] = rows
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        uri: row.remoteUrl ?? row.localUri,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return mapped;
  }, [teamNumber]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      try {
        const loadedPhotos = loadPhotos();
        setPhotos(loadedPhotos);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load robot photos', error);
        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading robot photos.';
        setErrorMessage(message);
        setPhotos([]);
      } finally {
        setIsLoading(false);
      }

      return () => {};
    }, [loadPhotos])
  );

  const handleTakePhoto = useCallback(async () => {
    if (teamNumber === null || isTakingPhoto) {
      return;
    }

    try {
      setIsTakingPhoto(true);
      const hasCameraPermission = await ensureCameraPermission();

      if (!hasCameraPermission) {
        Alert.alert(
          'Camera permission required',
          'Please enable camera access in your device settings to take robot photos.'
        );
        return;
      }

      const hasStoragePermission = await ensureRobotPhotoStoragePermission();

      if (!hasStoragePermission) {
        Alert.alert(
          'Storage permission required',
          'Please enable storage access so robot photos can be saved for later upload.',
        );
        return;
      }

      const uri = await takeRobotPhoto(teamNumber);

      if (!uri) {
        return;
      }

      const refreshed = loadPhotos();
      setPhotos(refreshed);
    } catch (error) {
      console.error('Failed to capture robot photo', error);
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred while capturing the photo.';
      Alert.alert('Unable to take photo', message);
    } finally {
      setIsTakingPhoto(false);
    }
  }, [isTakingPhoto, loadPhotos, teamNumber]);

  const hasPhotos = photos.length > 0;

  const handleGoBack = useCallback(() => {
    router.replace('/(drawer)/robot-photos');
  }, [router]);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: headerTitle }} />
      <Pressable
        accessibilityLabel="Go back to the robot photos team list"
        accessibilityRole="button"
        onPress={handleGoBack}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: backButtonBackground },
          pressed ? styles.backButtonPressed : null,
        ]}
      >
        <ThemedText style={[styles.backButtonLabel, { color: backButtonTextColor }]}>Back</ThemedText>
      </Pressable>
      {isLoading ? (
        <View style={styles.stateWrapper}>
          <ActivityIndicator accessibilityLabel="Loading robot photos" color={accentColor} />
          <ThemedText style={[styles.stateMessage, { color: mutedTextColor }]}>Loading robot photos…</ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={[styles.errorCard, { backgroundColor: backgroundCard, borderColor }]}>
          <ThemedText type="defaultSemiBold" style={styles.errorTitle}>
            Unable to load robot photos
          </ThemedText>
          <ThemedText style={[styles.errorMessage, { color: mutedTextColor }]}>{errorMessage}</ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.carouselContainer}>
            {hasPhotos ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
              >
                {photos.map((photo) => (
                  <View key={photo.id} style={[styles.imageWrapper, { width: imageWidth }]}>
                    <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyCarousel, { backgroundColor: backgroundCard, borderColor }]}>
                <ThemedText style={[styles.emptyCarouselText, { color: mutedTextColor }]}>No Photos</ThemedText>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleTakePhoto}
            disabled={isTakingPhoto || teamNumber === null}
            style={({ pressed }) => [
              styles.takePhotoButton,
              { backgroundColor: accentColor },
              pressed && !isTakingPhoto ? styles.takePhotoButtonPressed : null,
              isTakingPhoto ? styles.takePhotoButtonDisabled : null,
            ]}
          >
            <ThemedText style={[styles.takePhotoButtonLabel, { color: buttonTextColor }]}>
              {isTakingPhoto ? 'Opening Camera…' : 'Take Photo'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 24,
  },
  carouselContainer: {
    alignItems: 'center',
  },
  carouselContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 12,
  },
  imageWrapper: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  emptyCarousel: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCarouselText: {
    fontSize: 18,
    fontWeight: '600',
  },
  takePhotoButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  takePhotoButtonPressed: {
    opacity: 0.92,
  },
  takePhotoButtonDisabled: {
    opacity: 0.75,
  },
  takePhotoButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  stateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  stateMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
});
