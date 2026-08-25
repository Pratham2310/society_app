import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { validateEmail, validateFamilySize, validateName, validatePassword, validatePhone, validateVehicleNumber } from '../constants/registrationRules';
import { useRegistration } from '../context/RegistrationContext';

export default function FinalizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, reset } = useRegistration();
  const [agreeCode, setAgreeCode] = useState(false);
  const [agreeAlerts, setAgreeAlerts] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Alert.alert does nothing on the web build, so a failed registration used to
  // leave the button looking dead. Every outcome is reported here instead.
  const [error, setError] = useState<string | null>(null);
  // When the failure is a field from an earlier step, the banner doubles as a
  // link back to that step.
  const [fixStep, setFixStep] = useState<string | null>(null);

  // Both consents are compulsory, and only after the resident has scrolled
  // through the full policy.
  const canSubmit = hasRead && agreeCode && agreeAlerts;

  /**
   * Last line of defence. Each earlier step validates its own fields as they're
   * filled in, so this should never fire in a normal run — but if the wizard is
   * re-entered mid-flow and a step is skipped, this names the step to go back to
   * instead of letting the server answer with a bare Joi message about a field
   * three screens ago.
   */
  const findGap = (): { message: string; step: string } | null => {
    const checks: { error: string | null; step: string }[] = [
      { error: validateName(data.name ?? ''),         step: '/identity' },
      { error: validateEmail(data.email ?? ''),       step: '/identity' },
      { error: validatePassword(data.password ?? ''), step: '/identity' },
      { error: validatePhone(data.phone ?? ''),       step: '/identity' },
      { error: data.societyId ? null : 'Your society could not be identified', step: '/society-key' },
      { error: data.wingId ? null : 'Please select your wing',                 step: '/onboarding' },
      { error: data.flatNumber ? null : 'Please select your flat',             step: '/onboarding' },
      { error: data.occupancyType ? null : 'Please choose owner or tenant',    step: '/onboarding' },
      { error: data.livingType ? null : 'Please choose your living status',    step: '/onboarding' },
      {
        error: data.livingType === 'family' ? validateFamilySize(data.familySize ?? 0) : null,
        step: '/onboarding',
      },
      {
        error: (data.vehicles ?? [])
          .map(v => validateVehicleNumber(v.number))
          .find(Boolean) ?? null,
        step: '/vehicle',
      },
    ];

    const gap = checks.find(c => c.error);
    return gap ? { message: gap.error!, step: gap.step } : null;
  };

  const submitRegistration = async () => {
    if (!hasRead) {
      setError('Please scroll through the full policy before continuing.');
      return;
    }
    if (!agreeCode || !agreeAlerts) {
      setError('Please accept the code of conduct and the emergency-alerts consent to register.');
      return;
    }

    const gap = findGap();
    if (gap) {
      setError(`${gap.message}. Tap here to go back and fix it.`);
      setFixStep(gap.step);
      return;
    }

    setError(null);
    setFixStep(null);
    setSubmitting(true);
    try {
      await apiFetch(API.REGISTER_FULL, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone,
          societyId: data.societyId,
          wingId: data.wingId,
          flatNumber: data.flatNumber,
          occupancyType: data.occupancyType,
          livingType: data.livingType,
          familySize: data.familySize,
          // Parking slot is auto-assigned by the secretary on approval,
          // so only send type + number here.
          vehicles: (data.vehicles ?? []).map((v: any) => ({
            type: v.type,
            number: v.number,
          })),
          agreedToTerms: agreeCode,
          consentAlerts: agreeAlerts,
        }),
      });
      router.replace('/pending');
      reset();
    } catch (err: any) {
      const status = err?.status;
      const m = String(err?.message || '');
      if (!status) {
        setError(
          'Couldn’t reach the server — it may still be waking up. ' +
          'Check your connection and tap the button again.'
        );
      } else if (status === 429) {
        setError('Too many attempts from this device. Please wait a few minutes and try again.');
      } else if (status >= 500) {
        setError('The server had a problem completing your registration. Please try again in a moment.');
      } else {
        // 400/404/409 carry a specific reason worth showing verbatim —
        // "Flat already occupied", "This email is already registered", etc.
        setError(m || 'Registration could not be completed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/vehicle' as any))} style={styles.backBtnRow}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>STEP 4 OF 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.progressRow}>
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressActive]} />
        </View>

        <Text style={styles.title}>Finalize Registration</Text>
        <Text style={styles.description}>
          You're almost there! Please review our terms and provide final consent to join your residential community.
        </Text>

        <View style={styles.legalSection}>
          <Text style={styles.legalLabel}>LEGAL AGREEMENTS</Text>
          <View style={styles.legalCard}>
            <View style={styles.legalCardHeader}>
              <Text style={styles.legalTitle}>Privacy Policy & Terms of Use</Text>
              <Ionicons name="information-circle" size={16} color={COLORS.primary} />
            </View>
            <ScrollView
              style={styles.legalScroll}
              nestedScrollEnabled
              scrollEventThrottle={16}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) setHasRead(true);
              }}
              onContentSizeChange={(_w, h) => { if (h <= 192) setHasRead(true); }}
            >
              <Text style={styles.legalText}>
                Welcome to <Text style={{ fontWeight: '700' }}>Grihive</Text>. By completing your registration, you agree to comply with our residential management guidelines and digital platform usage policies.{'\n\n'}
                <Text style={{ fontWeight: '700', color: COLORS.slate[800] }}>1. Data Collection & Security</Text>{'\n\n'}
                We value your privacy. Our community platform ensures that your personal information—including unit numbers, contact details, and vehicle information—is only used for society administration, billing, and emergency communication.{'\n\n'}
                <Text style={{ fontWeight: '700', color: COLORS.slate[800] }}>2. Resident Code of Conduct</Text>{'\n\n'}
                Residents agree to use the digital platform respectfully. Harassment, unauthorized commercial solicitation, or misuse of community notice boards is strictly prohibited.
              </Text>
            </ScrollView>
          </View>
        </View>

        <View style={[styles.checkboxSection, !hasRead && styles.checkboxSectionLocked]}>
          {!hasRead ? (
            <View style={styles.readHint}>
              <Ionicons name="arrow-up" size={14} color={COLORS.primary} />
              <Text style={styles.readHintText}>Scroll through the full policy above to enable these.</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.checkboxRow} disabled={!hasRead} onPress={() => setAgreeCode(!agreeCode)}>
            <View style={[styles.checkbox, agreeCode && styles.checkboxChecked]}>
              {agreeCode && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkboxLabel}>
                I agree to the society's code of conduct <Text style={{ color: COLORS.red }}>*</Text>
              </Text>
              <Text style={styles.checkboxSubtext}>Required for residential access</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.checkboxRow} disabled={!hasRead} onPress={() => setAgreeAlerts(!agreeAlerts)}>
            <View style={[styles.checkbox, agreeAlerts && styles.checkboxChecked]}>
              {agreeAlerts && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkboxLabel}>
                I consent to receive emergency alerts <Text style={{ color: COLORS.red }}>*</Text>
              </Text>
              <Text style={styles.checkboxSubtext}>Via push notifications and SMS for critical updates</Text>
            </View>
          </TouchableOpacity>
        </View>

        {error ? (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={() => {
              if (fixStep) { router.push(fixStep as any); return; }
              setError(null);
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <Ionicons name={fixStep ? 'chevron-forward' : 'close'} size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.completeBtn, (!canSubmit || submitting) && { opacity: 0.6 }]}
          onPress={submitRegistration}
          disabled={!canSubmit || submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <>
                <ActivityIndicator color={COLORS.white} />
                <Text style={styles.completeBtnText}>REGISTERING…</Text>
              </>
            : <>
                <Text style={styles.completeBtnText}>COMPLETE REGISTRATION</Text>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
              </>
          }
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          By clicking "Complete Registration", you confirm that all information provided is accurate and you are a legal resident of the specified unit.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: `${COLORS.background}CC`, borderBottomWidth: 1, borderBottomColor: `${COLORS.primary}1A`,
  },
  backBtnRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 14, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  stepLabel: { fontSize: 14, fontWeight: '800', color: COLORS.slate[900], letterSpacing: 3 },
  scrollContent: { flex: 1, paddingHorizontal: 24 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 32 },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}33` },
  progressActive: { width: 40, backgroundColor: COLORS.primary },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.slate[900], marginBottom: 12, letterSpacing: -0.5 },
  description: { fontSize: 16, color: COLORS.slate[600], lineHeight: 24, marginBottom: 32 },
  legalSection: { marginBottom: 32, gap: 12 },
  legalLabel: { fontSize: 12, fontWeight: '700', color: `${COLORS.primary}CC`, letterSpacing: 3, marginLeft: 4 },
  legalCard: {
    borderRadius: 16, borderWidth: 1, borderColor: `${COLORS.primary}33`,
    backgroundColor: `${COLORS.white}80`, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  legalCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, borderBottomWidth: 1, borderBottomColor: `${COLORS.primary}1A`, paddingBottom: 12,
  },
  legalTitle: { fontSize: 14, fontWeight: '700', color: COLORS.slate[900] },
  legalScroll: { maxHeight: 192 },
  legalText: { fontSize: 13, color: COLORS.slate[600], lineHeight: 22 },
  checkboxSection: { gap: 20, marginBottom: 40 },
  checkboxSectionLocked: { opacity: 0.5 },
  readHint: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: `${COLORS.primary}12`, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  readHintText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  checkbox: {
    width: 24, height: 24, borderRadius: 4, borderWidth: 1,
    borderColor: COLORS.slate[300], alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxLabel: { fontSize: 15, fontWeight: '700', color: COLORS.slate[900], lineHeight: 20 },
  checkboxSubtext: { fontSize: 12, color: COLORS.slate[500], marginTop: 4 },
  completeBtn: {
    width: '100%', paddingVertical: 20, backgroundColor: COLORS.primary, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  completeBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 18, letterSpacing: 3 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B', lineHeight: 18 },
  disclaimer: { textAlign: 'center', color: COLORS.slate[400], fontSize: 10, paddingHorizontal: 24, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
});
