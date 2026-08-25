import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OtpBoxes from '../../components/OtpBoxes';
import { API, apiFetch } from '../../constants/api';
import { useAuth, useRole } from '../../context/AuthContext';

const PRIMARY = '#922207';

const ID_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'pan',     label: 'PAN' },
  { key: 'license', label: 'License' },
  { key: 'other',   label: 'Other' },
] as const;

// Easy to read aloud and to type on a keypad: no look-alike characters.
function generatePassword() {
  const words = ['Gate', 'Guard', 'Shift', 'Watch', 'Post', 'Duty'];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function AddGuardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  // Mirrors canManageSecurity on the backend — treasurers are NOT included.
  const { isSecretary, isChairman, isCommittee, isSuperAdmin } = useRole();
  const canManage = isSecretary || isChairman || isCommittee || isSuperAdmin;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [showPassword, setShowPassword] = useState(true);
  const [idType, setIdType] = useState<string>('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');

  // The guard's number is proved with an OTP before the account is made,
  // exactly as a resident proves theirs during sign-up.
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpNote, setOtpNote] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState({ name: '', phone: '', password: '' });
  // Credentials to read out to the guard, shown once the account exists.
  const [created, setCreated] = useState<{ name: string; phone: string; password: string } | null>(null);

  const phoneReady = /^[0-9]{10}$/.test(phone.trim());

  // Editing the number invalidates any code already sent for the old one.
  useEffect(() => {
    setOtp(['', '', '', '', '', '']);
    setOtpSent(false);
    setOtpVerified(false);
    setOtpNote(null);
    setResendIn(0);
  }, [phone]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    if (!phoneReady) {
      setErrors((p) => ({ ...p, phone: 'Enter a 10-digit mobile number' }));
      return;
    }
    setErrors((p) => ({ ...p, phone: '' }));
    setError(null);
    setSendingOtp(true);
    try {
      await apiFetch(API.SEND_OTP, {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setOtpSent(true);
      setResendIn(30);
      setOtpNote(`A 6-digit code was sent to the guard’s WhatsApp on +91 ${phone.trim()}.`);
    } catch (err: any) {
      const status = err?.status;
      const m = String(err?.message || '');
      if (!status) {
        setError('Couldn’t reach the server. Check your connection and try again.');
      } else if (status === 409) {
        // Already a live Grihive account — sendOtp refuses to overwrite it.
        setError(m || 'That mobile number already has an account in Grihive.');
      } else {
        setError(m || 'Could not send the code. Please try again.');
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Enter the full 6-digit code.');
      return;
    }
    setError(null);
    setVerifyingOtp(true);
    try {
      await apiFetch(API.VERIFY_OTP, {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), otp: code }),
      });
      setOtpVerified(true);
      setOtpNote('Mobile number verified.');
    } catch (err: any) {
      setError(err?.status ? String(err.message) : 'Couldn’t reach the server. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (!canManage) {
    return (
      <View style={[styles.screen, styles.center]}>
        <MaterialIcons name="lock" size={40} color="#c9c4c1" />
        <Text style={styles.deniedText}>Only the secretary or a committee member can register guards.</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
          <Text style={styles.secondaryBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const resetForm = () => {
    setName(''); setPhone(''); setPassword(generatePassword());
    setIdType('aadhaar'); setIdNumber(''); setAddress('');
    setErrors({ name: '', phone: '', password: '' });
    setError(null);
    setCreated(null);
    // The phone effect clears the OTP state.
  };

  const save = async () => {
    const next = { name: '', phone: '', password: '' };
    let bad = false;
    if (name.trim().length < 2) { next.name = 'Enter the guard’s full name'; bad = true; }
    if (!phoneReady) { next.phone = 'Enter a 10-digit mobile number'; bad = true; }
    if (password.trim().length < 6) { next.password = 'Password must be at least 6 characters'; bad = true; }
    setErrors(next);
    setError(null);
    if (bad) return;

    if (!otpVerified) {
      setError('Verify the guard’s mobile number with the OTP first.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch(
        API.SECURITY_STAFF_CREATE,
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            role: 'security',
            createLogin: true,
            password: password.trim(),
            ...(idNumber.trim() ? { idProofType: idType, idProofNumber: idNumber.trim() } : {}),
            ...(address.trim() ? { address: address.trim() } : {}),
          }),
        },
        token || undefined,
      );
      setCreated({ name: name.trim(), phone: phone.trim(), password: password.trim() });
    } catch (err: any) {
      const status = err?.status;
      const m = String(err?.message || '');
      if (!status) {
        setError('Couldn’t reach the server — it may still be waking up. Please try again.');
      } else if (status === 403) {
        setError('You don’t have permission to register guards.');
      } else if (status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        // 409 duplicate number, 400 validation — both carry a usable reason.
        setError(m || 'Could not register the guard. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={44} color="#1d7a3a" />
          </View>
          <Text style={styles.successTitle}>{created.name} can now log in</Text>
          <Text style={styles.successSub}>
            Share these details with the guard. They sign in on the Grihive app with
            the mobile number and password below.
          </Text>

          <View style={styles.credCard}>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>MOBILE NUMBER</Text>
              <Text style={styles.credValue}>+91 {created.phone}</Text>
            </View>
            <View style={styles.credDivider} />
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>PASSWORD</Text>
              <Text style={styles.credValue}>{created.password}</Text>
            </View>
          </View>

          <View style={styles.noteCard}>
            <MaterialIcons name="info-outline" size={18} color="#8a6d3b" />
            <Text style={styles.noteText}>
              This password is shown only now. If it gets lost, the guard can reset it
              from the login screen using “Forgot Password”.
            </Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={resetForm}>
            <MaterialIcons name="person-add" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>ADD ANOTHER GUARD</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <Text style={styles.secondaryBtnText}>DONE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Register Guard</Text>
            <Text style={styles.headerSub}>CREATES AN APP LOGIN</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {error ? (
          <Pressable style={styles.errorBanner} onPress={() => setError(null)}>
            <MaterialIcons name="error-outline" size={18} color={PRIMARY} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <MaterialIcons name="close" size={16} color="#a99e99" />
          </Pressable>
        ) : null}

        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={[styles.input, errors.name ? styles.inputError : null]}
          placeholder="e.g. Ramesh Yadav"
          placeholderTextColor="#b4aca8"
          value={name}
          onChangeText={setName}
        />
        {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}

        <View style={styles.labelRow}>
          <Text style={styles.label}>Mobile number</Text>
          {otpVerified ? <Text style={styles.verifiedBadge}>✓ VERIFIED</Text> : null}
        </View>
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
          <TextInput
            style={[styles.input, { flex: 1 }, errors.phone ? styles.inputError : null]}
            placeholder="10-digit mobile number"
            placeholderTextColor="#b4aca8"
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            editable={!otpVerified}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
          />
        </View>
        <Text style={styles.hint}>The guard signs in with this number, so it has to be verified.</Text>
        {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

        {otpNote ? (
          <View style={[styles.otpNote, otpVerified && styles.otpNoteOk]}>
            <MaterialIcons
              name={otpVerified ? 'check-circle' : 'chat'}
              size={16}
              color={otpVerified ? '#1d7a3a' : '#8a6d3b'}
            />
            <Text style={[styles.otpNoteText, otpVerified && { color: '#1d7a3a' }]}>{otpNote}</Text>
          </View>
        ) : null}

        {!otpVerified ? (
          <>
            {!otpSent ? (
              <Pressable
                style={[styles.otpBtn, (!phoneReady || sendingOtp) && { opacity: 0.5 }]}
                onPress={sendOtp}
                disabled={!phoneReady || sendingOtp}
              >
                {sendingOtp
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.otpBtnText}>SEND OTP TO GUARD</Text>}
              </Pressable>
            ) : (
              <View style={styles.otpBlock}>
                <Text style={styles.label}>Enter the 6-digit code</Text>
                <OtpBoxes value={otp} onChange={setOtp} />
                <Pressable
                  style={[styles.otpBtn, verifyingOtp && { opacity: 0.5 }]}
                  onPress={verifyOtp}
                  disabled={verifyingOtp}
                >
                  {verifyingOtp
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.otpBtnText}>VERIFY NUMBER</Text>}
                </Pressable>
                {resendIn > 0
                  ? <Text style={styles.resendText}>Resend code in {resendIn}s</Text>
                  : (
                    <Pressable onPress={sendOtp} disabled={sendingOtp}>
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </Pressable>
                  )}
              </View>
            )}
          </>
        ) : null}

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, { flex: 1 }, errors.password ? styles.inputError : null]}
            placeholder="At least 6 characters"
            placeholderTextColor="#b4aca8"
            autoCapitalize="none"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable style={styles.pwIconBtn} onPress={() => setShowPassword((s) => !s)}>
            <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#8a7f7a" />
          </Pressable>
          <Pressable style={styles.pwIconBtn} onPress={() => { setPassword(generatePassword()); setShowPassword(true); }}>
            <MaterialIcons name="autorenew" size={20} color={PRIMARY} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Write this down — you’ll need to give it to the guard.</Text>
        {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

        <Text style={styles.sectionLabel}>ID PROOF (OPTIONAL)</Text>
        <View style={styles.chipRow}>
          {ID_TYPES.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.chip, idType === t.key && styles.chipActive]}
              onPress={() => setIdType(t.key)}
            >
              <Text style={[styles.chipText, idType === t.key && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="ID number"
          placeholderTextColor="#b4aca8"
          autoCapitalize="characters"
          value={idNumber}
          onChangeText={setIdNumber}
        />

        <Text style={styles.label}>Address (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Where the guard lives"
          placeholderTextColor="#b4aca8"
          multiline
          value={address}
          onChangeText={setAddress}
        />

        <Pressable
          style={[styles.primaryBtn, (saving || !otpVerified) && { opacity: 0.5 }]}
          onPress={save}
          disabled={saving || !otpVerified}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <MaterialIcons name="shield" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>REGISTER GUARD</Text>
              </>}
        </Pressable>
        {!otpVerified ? (
          <Text style={styles.blockedHint}>Verify the guard’s mobile number to enable this.</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 8 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#a99e99', marginTop: 2 },

  label: { fontSize: 13, fontWeight: '700', color: '#5c534f', marginTop: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verifiedBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#1d7a3a', marginTop: 12 },

  otpBlock: { gap: 12, marginTop: 14, alignItems: 'center' },
  otpBtn: {
    alignSelf: 'stretch', height: 48, borderRadius: 12, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  otpBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  otpNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10,
    backgroundColor: '#fdf6e3', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f0e2bd',
  },
  otpNoteOk: { backgroundColor: '#eaf6ee', borderColor: '#c5e4d0' },
  otpNoteText: { flex: 1, fontSize: 12, color: '#8a6d3b', lineHeight: 17 },
  resendText: { fontSize: 12, fontWeight: '700', color: '#a99e99' },
  resendLink: { fontSize: 12, fontWeight: '800', color: PRIMARY, letterSpacing: 0.5 },
  blockedHint: { fontSize: 11, color: '#a99e99', textAlign: 'center', marginTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: '#a99e99', marginTop: 20 },
  hint: { fontSize: 11, color: '#a99e99', marginTop: 4 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, height: 52,
    fontSize: 15, color: '#090C02', borderWidth: 1, borderColor: '#ece7e5', marginTop: 6,
  },
  multiline: { height: 88, paddingTop: 14, textAlignVertical: 'top' },
  inputError: { borderColor: PRIMARY },
  fieldError: { fontSize: 11, color: PRIMARY, fontWeight: '700', marginTop: 4 },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countryCode: {
    height: 52, paddingHorizontal: 14, justifyContent: 'center', marginTop: 6,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#ece7e5',
  },
  countryCodeText: { fontSize: 15, fontWeight: '800', color: '#090C02' },

  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pwIconBtn: {
    width: 46, height: 52, marginTop: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#ece7e5',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ece7e5' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: '700', color: '#5c534f' },
  chipTextActive: { color: '#fff' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, height: 54, marginTop: 24,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', height: 50, marginTop: 10 },
  secondaryBtnText: { color: '#5c534f', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4,
    backgroundColor: '#fdeceb', borderWidth: 1, borderColor: '#f5c6c2',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#8a2318', lineHeight: 18 },

  deniedText: { fontSize: 14, color: '#5c534f', textAlign: 'center', lineHeight: 20 },

  successIcon: { alignItems: 'center', marginTop: 24 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#090C02', textAlign: 'center', marginTop: 12 },
  successSub: { fontSize: 13, color: '#5c534f', textAlign: 'center', lineHeight: 19, marginTop: 8, paddingHorizontal: 8 },
  credCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 22, borderWidth: 1, borderColor: '#ece7e5' },
  credRow: { gap: 4 },
  credLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#a99e99' },
  credValue: { fontSize: 20, fontWeight: '800', color: '#090C02', letterSpacing: 1 },
  credDivider: { height: 1, backgroundColor: '#f0ebe9', marginVertical: 14 },
  noteCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14,
    backgroundColor: '#fdf6e3', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f0e2bd',
  },
  noteText: { flex: 1, fontSize: 12, color: '#8a6d3b', lineHeight: 17 },
});
