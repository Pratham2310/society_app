import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { LIMITS, validateEmail, validateName, validatePassword, validatePhone } from '../constants/registrationRules';
import { useRegistration } from '../context/RegistrationContext';

export default function IdentityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useRegistration();

  const [otpSent, setOtpSent]     = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sentNote, setSentNote]   = useState<string | null>(null);
  const [notice, setNotice]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [timer, setTimer]         = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  type Field = 'name' | 'email' | 'password' | 'mobile';
  const [formData, setFormData]   = useState({ name: '', email: '', password: '', mobile: '' });
  const [errors, setErrors]       = useState({ name: '', email: '', password: '', mobile: '' });
  // A field only starts showing errors once the resident has left it (or pressed
  // Continue). Validating while they're still typing the first character of a
  // password would flag "too short" on every keystroke.
  const [touched, setTouched]     = useState({ name: false, email: false, password: false, mobile: false });
  const [sending, setSending]     = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) interval = setInterval(() => setTimer(p => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Reset OTP state when mobile number changes
  useEffect(() => {
    setOtp(['', '', '', '', '', '']);
    setOtpSent(false);
    setOtpVerified(false);
    setSentNote(null);
    setTimer(0);
  }, [formData.mobile]);

  // Rules live in constants/registrationRules.ts so they stay in lockstep with
  // the backend's registerFullSchema. Anything accepted here must be accepted
  // by the final POST — otherwise the resident is bounced on step 4 for a field
  // they filled in on step 1.
  const checkField = (field: Field, value: string): string => {
    switch (field) {
      case 'name':     return validateName(value)     ?? '';
      case 'email':    return validateEmail(value)    ?? '';
      case 'password': return validatePassword(value) ?? '';
      case 'mobile':   return validatePhone(value)    ?? '';
    }
  };

  // Live feedback, but only in the direction that helps: once a field is touched
  // we re-check on every keystroke so the warning disappears the moment it's
  // fixed, instead of lingering until the next Continue press.
  const setField = (field: Field, value: string) => {
    setFormData(p => ({ ...p, [field]: value }));
    if (touched[field]) setErrors(p => ({ ...p, [field]: checkField(field, value) }));
  };

  const blurField = (field: Field) => {
    setTouched(p => ({ ...p, [field]: true }));
    setErrors(p => ({ ...p, [field]: checkField(field, formData[field]) }));
  };

  // Alert.alert is a no-op on the web build — every failure must be on-screen,
  // otherwise the button just looks broken.
  const friendly = (err: any, fallback: string) => {
    const m = String(err?.message || '');
    if (/failed to fetch|network request failed|timed out|unreachable/i.test(m)) {
      return 'Couldn’t reach the server. Check your internet connection and try again.';
    }
    return m || fallback;
  };

  const handleSendOtp = async () => {
    const mobileError = checkField('mobile', formData.mobile);
    if (mobileError) {
      setTouched(p => ({ ...p, mobile: true }));
      setErrors(p => ({ ...p, mobile: mobileError }));
      return;
    }
    setErrors(p => ({ ...p, mobile: '' }));
    setNotice(null);
    setSending(true);
    try {
      await apiFetch(API.SEND_OTP, {
        method: 'POST',
        body: JSON.stringify({ phone: formData.mobile }),
      });
      setOtpSent(true);
      setTimer(30);
      setSentNote(`A 6-digit code was sent to your WhatsApp on +91 ${formData.mobile}.`);
    } catch (err: any) {
      setNotice({ type: 'error', text: friendly(err, 'Could not send the code. Please try again.') });
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setNotice({ type: 'error', text: 'Enter the full 6-digit code.' }); return; }
    setNotice(null);
    setVerifying(true);
    try {
      await apiFetch(API.VERIFY_OTP, {
        method: 'POST',
        body: JSON.stringify({ phone: formData.mobile, otp: code }),
      });
      setOtpVerified(true);
      setNotice({ type: 'success', text: 'Mobile number verified.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: friendly(err, 'That code is invalid or expired.') });
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = async () => {
    const newErrors = {
      name:     checkField('name', formData.name),
      email:    checkField('email', formData.email),
      password: checkField('password', formData.password),
      mobile:   checkField('mobile', formData.mobile),
    };
    setTouched({ name: true, email: true, password: true, mobile: true });
    setErrors(newErrors);

    const firstBad = (Object.keys(newErrors) as Field[]).find(f => newErrors[f]);
    if (firstBad) {
      // The field-level message is already on screen; the banner explains why
      // the button did nothing, which is otherwise invisible if the offending
      // field has scrolled out of view.
      setNotice({ type: 'error', text: newErrors[firstBad] });
      return;
    }

    if (!otpVerified) {
      setNotice({ type: 'error', text: 'Please verify your mobile number with the OTP first.' });
      return;
    }

    setNotice(null);
    update({
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
      phone: formData.mobile,
    });
    router.push('/onboarding');
  };

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');

    // Pasted or auto-filled code. The WhatsApp message carries a "copy code"
    // button, so most people paste all six digits into the first box at once —
    // this used to be dropped on the floor because only single characters were
    // accepted, and the screen looked frozen. Spread them across the boxes.
    if (digits.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newOtp[index + i] = digits[i];
      }
      setOtp(newOtp);
      const next = Math.min(index + digits.length, 5);
      otpRefs.current[next]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < 5) otpRefs.current[index + 1]?.focus();
  };

  // Backspace on an empty box clears + focuses the previous one, so the user
  // doesn't have to tap each box to delete.
  const handleOtpKeyPress = (e: any, index: number) => {
    if (e?.nativeEvent?.key !== 'Backspace') return;
    if (otp[index]) return;      // digit present — normal delete
    if (index === 0) return;
    const newOtp = [...otp];
    newOtp[index - 1] = '';
    setOtp(newOtp);
    otpRefs.current[index - 1]?.focus();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressRow}>
        <View style={[styles.progressDot, styles.progressActive]} />
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>Personal Identity</Text>
          <Text style={styles.description}>Step 1 of 4: Tell us who you are</Text>
        </View>

        {notice ? (
          <TouchableOpacity
            style={[styles.notice, notice.type === 'success' ? styles.noticeOk : styles.noticeErr]}
            onPress={() => setNotice(null)}
            activeOpacity={0.9}
          >
            <Ionicons
              name={notice.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={notice.type === 'success' ? '#1d7a3a' : COLORS.red}
            />
            <Text style={[styles.noticeText, { color: notice.type === 'success' ? '#1d7a3a' : COLORS.red }]}>
              {notice.text}
            </Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="e.g. John Doe"
              placeholderTextColor={`${COLORS.muted}80`}
              value={formData.name}
              maxLength={LIMITS.NAME_MAX}
              onChangeText={t => setField('name', t)}
              onBlur={() => blurField('name')}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="name@email.com"
              placeholderTextColor={`${COLORS.muted}80`}
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={t => setField('email', t)}
              onBlur={() => blurField('email')}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, errors.password ? styles.inputError : null]}
                placeholder="Create a password"
                placeholderTextColor={`${COLORS.muted}80`}
                secureTextEntry={!showPassword}
                value={formData.password}
                maxLength={LIMITS.PASSWORD_MAX}
                onChangeText={t => setField('password', t)}
                onBlur={() => blurField('password')}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : (
              // Stating the rule up front is what stops the short password from
              // being typed at all — the error message alone arrives too late.
              <Text style={[styles.hintText, formData.password.length >= LIMITS.PASSWORD_MIN && styles.hintTextOk]}>
                {formData.password.length >= LIMITS.PASSWORD_MIN
                  ? '✓ Password length looks good'
                  : `At least ${LIMITS.PASSWORD_MIN} characters`}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <View style={styles.mobileLabelRow}>
              <Text style={styles.label}>Mobile Number</Text>
              {otpVerified ? <Text style={styles.verifiedBadge}>✓ VERIFIED</Text> : null}
            </View>
            <View style={styles.mobileRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }, errors.mobile ? styles.inputError : null]}
                placeholder="98765 43210"
                placeholderTextColor={`${COLORS.muted}80`}
                keyboardType="number-pad"
                maxLength={LIMITS.PHONE_DIGITS}
                value={formData.mobile}
                onChangeText={t => setField('mobile', t.replace(/\D/g, ''))}
                onBlur={() => blurField('mobile')}
                editable={!otpVerified}
              />
            </View>
            {errors.mobile ? <Text style={styles.errorText}>{errors.mobile}</Text> : null}

            {!otpSent && !otpVerified ? (
              <TouchableOpacity style={styles.sendOtpBtn} onPress={handleSendOtp} disabled={sending} activeOpacity={0.85}>
                {sending ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.sendOtpBtnText}>Send OTP</Text>}
              </TouchableOpacity>
            ) : null}
          </View>

          {otpSent && !otpVerified && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.otpSection}>
              {sentNote ? (
                <View style={styles.sentBanner}>
                  <Ionicons name="logo-whatsapp" size={18} color="#1d7a3a" />
                  <Text style={styles.sentText}>{sentNote}</Text>
                </View>
              ) : null}
              <Text style={styles.label}>Enter 6-digit OTP</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => { otpRefs.current[i] = ref; }}
                    style={styles.otpInput}
                    // 6, not 1: a pasted or auto-filled code must reach
                    // handleOtpChange intact so it can be split across the
                    // boxes. Each box still only ever holds one digit.
                    maxLength={6}
                    value={digit}
                    onChangeText={val => handleOtpChange(val, i)}
                    onKeyPress={e => handleOtpKeyPress(e, i)}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete={i === 0 ? 'sms-otp' : 'off'}
                    selectTextOnFocus
                  />
                ))}
              </View>
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={handleVerifyOtp}
                disabled={verifying}
              >
                {verifying
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.verifyBtnText}>VERIFY OTP</Text>
                }
              </TouchableOpacity>
              <View style={styles.resendRow}>
                {timer > 0
                  ? <Text style={styles.otpTimer}>Resend code in {timer}s</Text>
                  : <TouchableOpacity onPress={handleSendOtp}><Text style={styles.sendOtpText}>Resend OTP</Text></TouchableOpacity>}
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.continueBtnText}>Continue</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 8 },
  backBtn: { padding: 8, marginLeft: -8, borderRadius: 999 },
  stepLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 3, color: `${COLORS.primary}99` },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8, marginBottom: 16 },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}33` },
  progressActive: { width: 40, backgroundColor: COLORS.primary },
  scrollContent: { flex: 1, paddingHorizontal: 24 },
  titleSection: { marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.slate[900], marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.slate[500], lineHeight: 22 },
  form: { gap: 20, paddingBottom: 32 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.dark, marginLeft: 4 },
  input: { height: 56, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surface, backgroundColor: COLORS.white, fontSize: 16, color: COLORS.dark },
  inputError: { borderColor: COLORS.red },
  errorText: { fontSize: 10, color: COLORS.red, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hintText: { fontSize: 10, color: COLORS.slate[400], fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hintTextOk: { color: '#16a34a' },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 16, top: 18 },
  mobileLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginLeft: 4 },
  sendOtpText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  otpTimer: { fontSize: 12, fontWeight: '700', color: `${COLORS.primary}99`, letterSpacing: 1 },
  sendOtpBtn: { marginTop: 12, height: 52, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendOtpBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  resendRow: { alignItems: 'center', paddingTop: 6 },
  verifiedBadge: { fontSize: 12, fontWeight: '700', color: '#16a34a', letterSpacing: 1 },
  mobileRow: { flexDirection: 'row', gap: 8 },
  countryCode: { width: 64, height: 56, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surface, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  countryCodeText: { fontSize: 14, fontWeight: '500' },
  otpSection: { gap: 12, paddingVertical: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 16 },
  noticeOk: { backgroundColor: '#e6f4eb' },
  noticeErr: { backgroundColor: '#fdecec' },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  sentBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6f4eb', borderRadius: 12, padding: 12 },
  sentText: { flex: 1, fontSize: 12.5, color: '#1d7a3a', fontWeight: '600', lineHeight: 18 },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  otpInput: { width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: '700', borderRadius: 12, borderWidth: 1, borderColor: COLORS.surface, backgroundColor: COLORS.white, color: COLORS.dark },
  verifyBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  verifyBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  bottomSection: { padding: 24, paddingBottom: 32 },
  continueBtn: { width: '100%', height: 56, backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  continueBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
