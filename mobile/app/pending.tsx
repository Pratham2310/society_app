import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function PendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [countdown, setCountdown] = useState(8);

  // Show the "please wait" message for a few seconds so the user reads it,
  // then send them to the login screen.
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (countdown !== 0) return;
    (async () => {
      await logout();
      router.replace('/login');
    })();
  }, [countdown]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]} />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={48} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Please wait while we verify you</Text>
        <Text style={styles.description}>
          Your registration has been submitted. Your society secretary will review and approve
          your account shortly — usually within a few hours.
        </Text>

        <View style={styles.spinnerRow}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.spinnerText}>Verification in progress…</Text>
        </View>

        <Text style={styles.statusLabel}>STATUS</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Under Review</Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.redirectText}>
          Taking you to the login page in {countdown}s…
        </Text>
        <TouchableOpacity
          style={styles.stepInBtn}
          onPress={async () => { await logout(); router.replace('/login'); }}
          activeOpacity={0.8}
        >
          <Text style={styles.stepInBtnText}>GO TO LOGIN NOW</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.dark, marginBottom: 16, textAlign: 'center' },
  description: { fontSize: 15, color: COLORS.slate[500], textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  spinnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  spinnerText: { fontSize: 13, color: COLORS.slate[500], fontWeight: '600' },
  statusLabel: { fontSize: 10, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 3, marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}15`,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  statusText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  bottomSection: { padding: 24, paddingBottom: 40, gap: 12, alignItems: 'center' },
  redirectText: { fontSize: 12, color: COLORS.slate[400], fontWeight: '600' },
  stepInBtn: {
    width: '100%', paddingVertical: 18, backgroundColor: COLORS.primary, borderRadius: 16,
    alignItems: 'center',
  },
  stepInBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16, letterSpacing: 2 },
});
