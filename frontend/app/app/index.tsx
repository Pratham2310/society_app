import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { COLORS } from '../constants/Colors';
import { Svg, Path } from 'react-native-svg';

export default function SplashScreen() {
  const router = useRouter();
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(1, { duration: 3000 });
    const timer = setTimeout(() => {
      router.replace('/society-key');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.logoContainer}>
          <Svg width={80} height={80} viewBox="0 0 100 100" fill="none">
            <Path
              d="M50 15L85 45V85H65V60H35V85H15V45L50 15Z"
              stroke={COLORS.primary}
              strokeWidth={6}
              strokeLinejoin="round"
            />
            <Path
              d="M50 35L65 50M50 35L35 50"
              stroke={COLORS.primary}
              strokeWidth={6}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <Text style={styles.title}>GRIHIVE</Text>
      </View>
      <View style={styles.bottomContent}>
        <Text style={styles.tagline}>Your Society, Secured.</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, progressStyle]} />
        </View>
      </View>
      <View style={styles.versionContainer}>
        <Text style={styles.version}>v1.0.2</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  bottomContent: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 24,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.primary,
    opacity: 0.6,
    fontWeight: '500',
    letterSpacing: 1,
  },
  progressTrack: {
    width: 200,
    height: 2,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  versionContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  version: {
    fontSize: 10,
    color: COLORS.primary,
    opacity: 0.3,
  },
});
