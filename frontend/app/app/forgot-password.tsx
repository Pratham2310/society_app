import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'request' | 'reset' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alert.alert is a no-op on the web build, so all feedback is on-screen.
  const friendly = (e: any, fallback: string) => {
    const m = String(e?.message || '');
    return /failed to fetch|network|timed out/i.test(m)
      ? 'Couldn’t reach the server. Check your connection and try again.'
      : m || fallback;
  };

  const requestOtp = async () => {
    if (identifier.trim().length !== 10) { setError('Enter your 10-digit registered phone number.'); return; }
    setError(null);
    setSending(true);
    try {
      const json = await apiFetch(API.FORGOT_PASSWORD, {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      setPhase('reset');
      const last4 = String(json.phone || identifier).slice(-4);
      setSentNote(`A 6-digit reset code was sent to your WhatsApp on •••••${last4}.`);
    } catch (err: any) {
      setError(friendly(err, 'Could not send the reset code.'));
    } finally {
      setSending(false);
    }
  };

  const submitReset = async () => {
    if (otp.trim().length < 6) { setError('Enter the 6-digit code.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(null);
    setResetting(true);
    try {
      await apiFetch(API.RESET_PASSWORD, {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), otp: otp.trim(), newPassword }),
      });
      setPhase('done');
    } catch (err: any) {
      setError(friendly(err, 'Could not reset the password.'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/login')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {phase !== 'done' ? (
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={32} color={COLORS.primary} />
          </View>
        ) : null}

        {error && phase !== 'done' ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {phase === 'done' ? (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={54} color="#1d7a3a" />
            </View>
            <Text style={styles.successTitle}>Password reset!</Text>
            <Text style={styles.successText}>
              Your password has been changed successfully. You can now log in with your new password.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/login')}>
              <Text style={styles.primaryBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </>
        ) : phase === 'request' ? (
          <>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>Enter your registered phone number and we’ll send a code to reset it.</Text>

            <Text style={styles.label}>Registered phone number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="10-digit phone"
                placeholderTextColor={COLORS.slate[400]}
                keyboardType="number-pad"
                maxLength={10}
                value={identifier}
                onChangeText={(t) => setIdentifier(t.replace(/\D/g, ''))}
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, sending && { opacity: 0.6 }]} disabled={sending} onPress={requestOtp}>
              {sending ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Send Reset Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter code & new password</Text>
            <Text style={styles.subtitle}>We sent a 6-digit code to +91 {identifier}.</Text>

            {sentNote ? (
              <View style={styles.sentBanner}>
                <Ionicons name="logo-whatsapp" size={18} color="#1d7a3a" />
                <Text style={styles.sentText}>{sentNote}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>6-digit code</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="••••••"
              placeholderTextColor={COLORS.slate[400]}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
            />

            <Text style={styles.label}>New password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.slate[400]}
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.primaryBtn, resetting && { opacity: 0.6 }]} disabled={resetting} onPress={submitReset}>
              {resetting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Reset Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendRow} onPress={requestOtp} disabled={sending}>
              <Text style={styles.resendText}>{sending ? 'Sending…' : 'Resend code'}</Text>
            </TouchableOpacity>
          </>
        )}

        {phase !== 'done' ? (
          <View style={styles.backToLogin}>
            <Text style={styles.backToLoginText}>Remembered it? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.backToLoginLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.dark },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, maxWidth: 440, width: '100%', alignSelf: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.slate[900], textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.slate[500], textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.muted, marginBottom: 6, marginTop: 12, marginLeft: 4 },
  input: { height: 54, paddingHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 12, fontSize: 16, color: COLORS.slate[900], borderWidth: 1, borderColor: COLORS.surface },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryCode: { width: 60, height: 54, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surface, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  countryCodeText: { fontSize: 15, fontWeight: '600', color: COLORS.dark },
  otpInput: { letterSpacing: 8, fontWeight: '800', fontSize: 20 },
  eyeBtn: { position: 'absolute', right: 16, top: 16 },
  primaryBtn: { marginTop: 22, height: 54, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  sentBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6f4eb', borderRadius: 12, padding: 12, marginBottom: 4 },
  sentText: { flex: 1, fontSize: 12.5, color: '#1d7a3a', fontWeight: '600', lineHeight: 18 },
  resendRow: { alignItems: 'center', paddingVertical: 14 },
  resendText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdecec', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.red, lineHeight: 18 },
  successIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#e6f4eb', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#1d7a3a', textAlign: 'center' },
  successText: { fontSize: 14, color: COLORS.slate[500], textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 8 },
  backToLogin: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  backToLoginText: { fontSize: 14, color: COLORS.muted },
  backToLoginLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
