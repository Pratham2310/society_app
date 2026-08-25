import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 4 }]}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/society-key' as any))}
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.centerContent}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBn7-qbUvF6QveBkx3yxdqtnlOXBVu6sWYDPEltlfJ76-p8JrOQQioRAeWDQFUFnOa7XJ8oFVWqabqKbXMEPtK1rhbJl5l7Q6c7XjOSwO0k-sU0S_uJxPwYK3xs2Ty9IB1clQUC5l0nbwPOeY6g4Ir10wadVeIr-VsedvyZdySD36SeHw-AeBuFkgGlQSNZM1FgEvpbl6vzOV4vJt-573CaVwxETzWLMYYG0ilQAksBdr6Tzz3jNRPRMYkJzqopgzFCQ5RFUdTNRDXz' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.welcomeTitle}>Welcome to Emerald Heights!</Text>
        <Text style={styles.welcomeSubtitle}>You are now connected to the society network.</Text>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.newHere}>NEW HERE?</Text>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => router.push('/identity')}
          activeOpacity={0.8}
        >
          <Text style={styles.registerBtnText}>REGISTER</Text>
        </TouchableOpacity>
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footerText}>THE LEDGER • SECURE ACCESS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', paddingHorizontal: 32, paddingTop: 0 },
  backBtn: {
    position: 'absolute', top: 48, left: 24, padding: 8,
    backgroundColor: `${COLORS.white}80`, borderRadius: 999, zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  imageContainer: {
    width: '100%', aspectRatio: 4/5, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
    marginBottom: 32,
  },
  heroImage: { width: '100%', height: '100%' },
  welcomeTitle: { fontSize: 28, fontWeight: '700', color: COLORS.black, marginBottom: 16, letterSpacing: -0.5, textAlign: 'center' },
  welcomeSubtitle: { fontSize: 18, color: `${COLORS.black}B3`, lineHeight: 26, textAlign: 'center', paddingHorizontal: 16 },
  bottomSection: { width: '100%', paddingBottom: 32 },
  newHere: { fontSize: 14, color: `${COLORS.black}99`, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center', marginBottom: 16 },
  registerBtn: {
    width: '100%', paddingVertical: 20, backgroundColor: COLORS.primary, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
    alignItems: 'center',
  },
  registerBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 20, letterSpacing: 4 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 32, alignItems: 'center' },
  loginText: { color: `${COLORS.black}B3`, fontWeight: '500' },
  loginLink: { color: COLORS.primary, fontWeight: '700' },
  footerText: { marginTop: 24, fontSize: 12, color: `${COLORS.black}66`, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center' },
});
