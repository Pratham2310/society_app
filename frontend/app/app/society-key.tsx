import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useRegistration } from '../context/RegistrationContext';

export default function SocietyKeyScreen() {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { update } = useRegistration();

  const [societyKey, setSocietyKey] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [societyName, setSocietyName] = useState('');
  const [societyId,   setSocietyId]   = useState('');
  const [loading, setLoading]         = useState(false);

  const isComplete = societyKey.every(d => d !== '');

  const handleChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');

    // Pasting / autofilling the whole code — spread it across the boxes.
    if (digits.length > 1) {
      const newKey = [...societyKey];
      for (let i = 0; i < digits.length && index + i < 6; i++) newKey[index + i] = digits[i];
      setSocietyKey(newKey);
      const next = Math.min(index + digits.length, 5);
      inputRefs.current[next]?.focus();
      if (newKey.every((d) => d !== '')) verifyCode(newKey);
      return;
    }

    if (/^\d?$/.test(digits)) {
      const newKey = [...societyKey];
      newKey[index] = digits;
      setSocietyKey(newKey);
      // Auto-verify when last digit entered
      if (digits && index === 5) verifyCode([...newKey]);
      else if (digits && index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  // Backspace on an EMPTY box should clear + focus the previous one.
  // Without this the box gets no change event, so nothing happens and the
  // user has to tap each box manually.
  const handleKeyPress = (e: any, index: number) => {
    if (e?.nativeEvent?.key !== 'Backspace') return;
    if (societyKey[index]) return; // box has a digit — default delete handles it
    if (index === 0) return;
    const newKey = [...societyKey];
    newKey[index - 1] = '';
    setSocietyKey(newKey);
    inputRefs.current[index - 1]?.focus();
  };

  const verifyCode = async (key = societyKey) => {
    setLoading(true);
    setSocietyName('');
    setSocietyId('');
    try {
      const json = await apiFetch(API.VERIFY_CODE, {
        method: 'POST',
        body: JSON.stringify({ societyCode: key.join('') }),
      });
      setSocietyName(json.data.name);
      setSocietyId(json.data.societyId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (!societyId) { Alert.alert('Verify first', 'Enter the 6-digit society code'); return; }
    update({ societyId, societyName });
    router.push('/welcome');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SOCIETY KEY</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.centerContent}>
        <Text style={styles.subtitle}>JOIN YOUR COMMUNITY</Text>
        <View style={styles.inputRow}>
          {societyKey.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref; }}
              style={[styles.digitInput, digit ? styles.digitInputFilled : null]}
              value={digit}
              onChangeText={val => handleChange(val, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              placeholder="-"
              placeholderTextColor={COLORS.slate[300]}
            />
          ))}
        </View>

        <View style={styles.validationBox}>
          {loading && <ActivityIndicator color={COLORS.primary} />}
          {!loading && isComplete && societyName !== '' && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.foundCard}>
              <View style={styles.foundRow}>
                <Ionicons name="location" size={18} color={COLORS.primary} />
                <Text style={styles.foundText}>Found: {societyName}</Text>
              </View>
            </Animated.View>
          )}
          {!loading && isComplete && !societyId && (
            <Text style={styles.notFoundText}>Society not found. Check the code.</Text>
          )}
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.proceedBtn, (!isComplete || !societyId) && styles.btnDisabled]}
          onPress={handleProceed}
          disabled={!isComplete || !societyId}
          activeOpacity={0.8}
        >
          <Text style={styles.proceedBtnText}>PROCEED TO REGISTER</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.helperText}>
          Enter the unique 6-digit key provided by your association
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 8 },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 12, fontWeight: '700', color: `${COLORS.primary}CC`, letterSpacing: 3, textTransform: 'uppercase' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  subtitle: { fontSize: 10, fontWeight: '800', color: COLORS.slate[900], letterSpacing: 2, textAlign: 'center', marginBottom: 32, textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  digitInput: { width: 44, height: 56, textAlign: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[300], color: COLORS.dark, fontSize: 20, fontWeight: '700', borderRadius: 8 },
  digitInputFilled: { borderColor: COLORS.dark },
  validationBox: { height: 80, width: '100%', maxWidth: 320, alignItems: 'center', justifyContent: 'center' },
  foundCard: { width: '100%', alignItems: 'center' },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: `${COLORS.primary}33`, backgroundColor: `${COLORS.primary}0D`, padding: 16, borderRadius: 12, width: '100%' },
  foundText: { color: COLORS.slate[800], fontSize: 14, fontWeight: '600' },
  notFoundText: { fontSize: 12, color: COLORS.red, fontWeight: '600' },
  bottomSection: { padding: 24, paddingBottom: 48 },
  proceedBtn: { width: '100%', height: 56, backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.5 },
  proceedBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 2 },
  helperText: { marginTop: 16, textAlign: 'center', color: COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
});
