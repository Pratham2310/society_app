import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';

type TourStep = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Quick Actions in One Place',
    subtitle: 'Use dashboard shortcuts for notices, complaints, parking, maintenance, and helpline.',
    icon: 'grid',
  },
  {
    title: 'Track Society Updates',
    subtitle: 'Check latest notices, event updates, and visitor alerts in real time.',
    icon: 'notifications',
  },
  {
    title: 'Secure and Simple',
    subtitle: 'Use SOS and security controls for visitor approvals and staff status.',
    icon: 'shield-checkmark',
  },
];

export default function AppTourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const isLastStep = step === TOUR_STEPS.length - 1;
  const current = useMemo(() => TOUR_STEPS[step], [step]);

  const finishTour = () => {
    router.replace('/(tabs)/dashboard');
  };

  const nextStep = () => {
    if (isLastStep) {
      finishTour();
      return;
    }
    setStep((prev) => prev + 1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.skipBtn} onPress={finishTour}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.heroWrap}>
        <View style={styles.iconCircle}>
          <Ionicons name={current.icon} size={56} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>
      </View>

      <View style={styles.bottomWrap}>
        <View style={styles.dotRow}>
          {TOUR_STEPS.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === step && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={nextStep} activeOpacity={0.8}>
          <Text style={styles.ctaText}>{isLastStep ? 'Start Using App' : 'Next'}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroWrap: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 10,
  },
  iconCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: `${COLORS.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: COLORS.dark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    color: COLORS.slate[500],
  },
  bottomWrap: {
    gap: 20,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: `${COLORS.primary}40`,
  },
  dotActive: {
    width: 28,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
