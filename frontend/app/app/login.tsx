import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Path, Polyline, Svg } from 'react-native-svg';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  // Alert.alert is a no-op on the web build, so every failure is shown here.
  const [notice, setNotice] = useState<string | null>(null);
  const [credsBad, setCredsBad] = useState(false);

  // Set when a 401 ended the session mid-use. Without this the user is simply
  // dumped at the login screen with no idea why.
  useEffect(() => {
    (async () => {
      const expired = await AsyncStorage.getItem('sessionExpired');
      if (expired) {
        setNotice('You were signed out because your session expired. Please sign in again.');
        await AsyncStorage.removeItem('sessionExpired');
      }
    })();
  }, []);

  const handleLogin = async () => {
    const newErrors = { phone: '', password: '' };
    let hasError = false;
    if (!/^[0-9]{10}$/.test(phone.trim())) { newErrors.phone = 'Enter your 10-digit mobile number'; hasError = true; }
    if (!password) { newErrors.password = 'Password is required'; hasError = true; }
    setErrors(newErrors);
    setNotice(null);
    setCredsBad(false);
    if (hasError) return;

    setLoading(true);
    try {
      const json = await apiFetch(API.LOGIN, {
        method: 'POST',
        body: JSON.stringify({ identifier: phone.trim(), password }),
      });
      if (json.user?.status === 'rejected') {
        setNotice('Your registration was rejected. Please contact the society office.');
        return;
      }
      // Secretary/chairman may have status != 'approved'; the backend already
      // validates their access, so only gate plain members here.
      if (json.user?.status === 'pending' && json.user?.societyRole === 'member') {
        setNotice('Your account is awaiting approval. The secretary will approve you shortly.');
        return;
      }
      await login(json.token, json.user);
      // AuthGate in _layout handles redirect automatically
    } catch (err: any) {
      const status = err?.status;
      const m = String(err?.message || '');
      if (status === 401) {
        // Backend deliberately does not reveal which of the two was wrong,
        // so highlight both fields and say so plainly.
        setCredsBad(true);
        setNotice('Incorrect mobile number or password. Please check and try again.');
      } else if (status === 403) {
        setNotice(m || 'Your account does not have access yet.');
      } else if (status === 429) {
        setNotice('Too many login attempts. Please wait a few minutes and try again.');
      } else if (!status) {
        setNotice('Couldn’t reach the server. Check your internet connection and try again.');
      } else {
        setNotice(m || 'Could not log you in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.logoBox}>
        <Svg width={100} height={100} viewBox="0 0 24 24" fill="none" stroke={COLORS.black} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </Svg>
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.title}>Step In</Text>
        <Text style={styles.subtitle}>Welcome back to your community.</Text>
      </View>

      <View style={styles.formSection}>
        {notice ? (
          <TouchableOpacity style={styles.notice} onPress={() => setNotice(null)} activeOpacity={0.9}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
            <TextInput
              style={[styles.input, styles.phoneInput, (errors.phone || credsBad) ? styles.inputError : null]}
              placeholder="10-digit mobile number"
              placeholderTextColor={COLORS.slate[400]}
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '')); if (credsBad) { setCredsBad(false); setNotice(null); } }}
              onSubmitEditing={handleLogin}
              returnKeyType="next"
            />
          </View>
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
        </View>

        <View style={styles.field}>
          <View style={styles.passwordLabelRow}>
            <Text style={styles.label}>Password</Text>
            <TouchableOpacity onPress={() => router.push('/forgot-password' as any)}><Text style={styles.forgotText}>Forgot Password?</Text></TouchableOpacity>
          </View>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.input, { paddingRight: 48 }, (errors.password || credsBad) ? styles.inputError : null]}
              placeholder="Enter password"
              placeholderTextColor={COLORS.slate[400]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => { setPassword(t); if (credsBad) { setCredsBad(false); setNotice(null); } }}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.slate[400]} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.loginBtn}
        onPress={handleLogin}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={styles.loginBtnText}>Step In</Text>
        }
      </TouchableOpacity>

      <View style={styles.registerRow}>
        <Text style={styles.registerText}>Not a member yet? </Text>
        <TouchableOpacity onPress={() => router.push('/society-key')}>
          <Text style={styles.registerLink}>Get Connected.</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  logoBox: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: 32, marginTop: 16 },
  titleSection: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '700', color: COLORS.black, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.muted, fontWeight: '500' },
  formSection: { width: '100%', maxWidth: 400, gap: 16, marginBottom: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.muted, marginLeft: 4 },
  passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4 },
  forgotText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  input: {
    width: '100%', height: 56, paddingHorizontal: 16, backgroundColor: COLORS.white,
    borderRadius: 8, fontSize: 16, color: COLORS.slate[900],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  inputError: { borderWidth: 1, borderColor: COLORS.red },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countryCode: {
    height: 56, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: COLORS.white, borderRadius: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  countryCodeText: { fontSize: 16, fontWeight: '700', color: COLORS.slate[900] },
  phoneInput: { flex: 1, width: undefined, letterSpacing: 1 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B', lineHeight: 18 },
  errorText: { fontSize: 10, color: COLORS.red, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
  eyeBtn: { position: 'absolute', right: 16, top: 18 },
  loginBtn: {
    width: '100%', maxWidth: 400, paddingVertical: 16, backgroundColor: COLORS.primary,
    borderRadius: 8, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
    marginBottom: 32,
  },
  loginBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 18 },
  registerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  registerText: { fontSize: 14, color: COLORS.muted },
  registerLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
