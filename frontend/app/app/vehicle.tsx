import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';
import { LIMITS, normalizeVehicleNumber, validateVehicleNumber } from '../constants/registrationRules';
import { VehicleEntry, useRegistration } from '../context/RegistrationContext';

export default function VehicleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useRegistration();

  const [noVehicle, setNoVehicle]       = useState(false);
  const [vehicles, setVehicles]         = useState<VehicleEntry[]>([]);
  const [currentVehicle, setCurrentVehicle] = useState<Partial<VehicleEntry>>({ type: 'car' });

  // The plate is checked against the same 4–15 character rule the backend
  // applies, right here on the field. It used to be accepted at any length and
  // only rejected by Joi on the final screen.
  const [numberError, setNumberError] = useState<string | null>(null);
  const [notice, setNotice]           = useState<string | null>(null);

  const atVehicleLimit = vehicles.length >= LIMITS.VEHICLES_MAX;

  const setVehicleNumber = (raw: string) => {
    const number = normalizeVehicleNumber(raw);
    setCurrentVehicle(v => ({ ...v, number }));
    if (numberError) setNumberError(validateVehicleNumber(number));
  };

  const addVehicle = () => {
    const number = normalizeVehicleNumber(currentVehicle.number || '');
    const error  = validateVehicleNumber(number);
    if (error) { setNumberError(error); return; }

    if (atVehicleLimit) {
      setNotice(`You can register up to ${LIMITS.VEHICLES_MAX} vehicles here.`);
      return;
    }
    if (vehicles.some(v => v.number === number)) {
      setNumberError('That vehicle number is already added');
      return;
    }

    // Parking slot is auto-assigned by the secretary after registration.
    setVehicles([...vehicles, { type: currentVehicle.type || 'car', number, parkingSlot: '' }]);
    setCurrentVehicle({ type: 'car', number: '' });
    setNumberError(null);
    setNotice(null);
  };

  const removeVehicle = (index: number) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
    setNotice(null);
  };

  // Must either add at least one vehicle (via the Add Vehicle button) or tick
  // "I do not own a vehicle" — can't skip the step.
  const canContinue = noVehicle || vehicles.length > 0;

  const handleContinue = () => {
    if (!canContinue) {
      setNotice(
        currentVehicle.number?.trim()
          ? 'Tap "Add Vehicle" to save this vehicle first, or select "I do not own a vehicle".'
          : 'Add at least one vehicle, or select "I do not own a vehicle".'
      );
      return;
    }
    setNotice(null);
    update({ vehicles: noVehicle ? [] : vehicles });
    router.push('/finalize');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.slate[900]} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>STEP 3 OF 4</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.progressRow}>
          <View style={styles.progressDot} /><View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressActive]} /><View style={styles.progressDot} />
        </View>

        <Text style={styles.title}>Vehicle & Parking</Text>
        <Text style={styles.description}>Register your vehicles to ensure seamless entry into the society.</Text>

        {notice ? (
          <TouchableOpacity style={styles.notice} onPress={() => setNotice(null)} activeOpacity={0.9}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {vehicles.length === 0 && (
          <TouchableOpacity style={styles.noVehicleCard} onPress={() => setNoVehicle(!noVehicle)}>
            <View style={styles.checkboxRow}>
              <View style={[styles.checkbox, noVehicle && styles.checkboxChecked]}>
                {noVehicle && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
              </View>
              <Text style={styles.noVehicleText}>I do not own a vehicle</Text>
            </View>
            <Ionicons name="log-out-outline" size={24} color={COLORS.slate[300]} />
          </TouchableOpacity>
        )}

        {!noVehicle && (
          <>
            {vehicles.map((v, index) => (
              <View key={index} style={styles.vehicleCard}>
                <View style={styles.vehicleCardHeader}>
                  <View style={styles.vehicleCardTitle}>
                    <Ionicons name={v.type === 'car' ? 'car' : 'bicycle'} size={20} color={COLORS.primary} />
                    <Text style={styles.vehicleLabel}>Vehicle {index + 1}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeVehicle(index)}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.slate[400]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.vehicleDetails}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>NUMBER</Text>
                    <Text style={styles.detailValue}>{v.number}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>SLOT</Text>
                    <Text style={styles.detailValue}>Auto-assigned</Text>
                  </View>
                </View>
              </View>
            ))}

            {atVehicleLimit ? (
              <View style={styles.limitCard}>
                <Ionicons name="information-circle" size={18} color={COLORS.primary} />
                <Text style={styles.limitText}>
                  You've added the maximum of {LIMITS.VEHICLES_MAX} vehicles. Remove one to add another.
                </Text>
              </View>
            ) : (
            <View style={styles.addVehicleCard}>
              <View style={styles.vehicleCardTitle}>
                <Ionicons name="car" size={20} color={COLORS.primary} />
                <Text style={styles.vehicleLabel}>Vehicle {vehicles.length + 1}</Text>
              </View>

              <Text style={styles.fieldLabel}>Vehicle Type</Text>
              <View style={styles.typeRow}>
                {(['car', 'bike'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, currentVehicle.type === t && styles.typeBtnActive]}
                    onPress={() => setCurrentVehicle({ ...currentVehicle, type: t })}
                  >
                    <Ionicons name={t === 'car' ? 'car' : 'bicycle'} size={18} color={currentVehicle.type === t ? COLORS.dark : COLORS.slate[500]} />
                    <Text style={[styles.typeBtnText, currentVehicle.type === t && styles.typeBtnTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Vehicle Number</Text>
              <TextInput
                style={[styles.input, numberError ? styles.inputError : null]}
                placeholder="e.g. MH12AB1234"
                placeholderTextColor={`${COLORS.slate[400]}80`}
                value={currentVehicle.number || ''}
                maxLength={LIMITS.VEHICLE_NUMBER_MAX}
                onChangeText={setVehicleNumber}
                onBlur={() => setNumberError(currentVehicle.number ? validateVehicleNumber(currentVehicle.number) : null)}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {numberError ? <Text style={styles.errorText}>{numberError}</Text> : null}

              <View style={styles.autoAssignBanner}>
                <Ionicons name="information-circle" size={16} color={COLORS.primary} />
                <Text style={styles.autoAssignText}>A free parking slot will be assigned automatically after the secretary approves your registration.</Text>
              </View>

              {/* Enabled as soon as anything is typed, so a too-short plate
                  surfaces its reason on press instead of the button silently
                  refusing to work. */}
              <TouchableOpacity
                style={[styles.addBtn, !currentVehicle.number && styles.btnDisabled]}
                onPress={addVehicle}
                disabled={!currentVehicle.number}
              >
                <Text style={styles.addBtnText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: 16 + insets.bottom }]}>
        {!canContinue ? (
          <Text style={styles.continueHint}>Add a vehicle, or select “I do not own a vehicle”.</Text>
        ) : null}
        <TouchableOpacity style={[styles.continueBtn, !canContinue && styles.btnDisabled]} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 8 },
  backBtn: { padding: 8, marginLeft: -8 },
  stepLabel: { fontSize: 14, fontWeight: '800', color: COLORS.primary, letterSpacing: 3, textTransform: 'uppercase' },
  scrollContent: { flex: 1, paddingHorizontal: 24 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16, marginBottom: 16 },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}33` },
  progressActive: { width: 40, backgroundColor: COLORS.primary },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 12 },
  description: { color: COLORS.slate[500], lineHeight: 22, marginBottom: 24 },
  noVehicleCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.slate[200], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: COLORS.slate[300], alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  noVehicleText: { fontWeight: '700', fontSize: 18 },
  vehicleCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: COLORS.slate[200], marginBottom: 24 },
  vehicleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  vehicleCardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleLabel: { color: COLORS.primary, fontWeight: '700', fontSize: 18 },
  vehicleDetails: { flexDirection: 'row', gap: 16 },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontWeight: '700', color: COLORS.slate[800] },
  addVehicleCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: COLORS.slate[200], marginBottom: 24, gap: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: -8 },
  typeRow: { flexDirection: 'row', backgroundColor: `${COLORS.primary}0D`, padding: 4, borderRadius: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 6 },
  typeBtnActive: { backgroundColor: COLORS.accentGreen, borderWidth: 1, borderColor: COLORS.dark },
  typeBtnText: { fontWeight: '500', color: COLORS.slate[500] },
  typeBtnTextActive: { color: COLORS.dark },
  input: { padding: 16, backgroundColor: `${COLORS.primary}0D`, borderRadius: 12, fontSize: 16, color: COLORS.dark },
  inputError: { borderWidth: 1, borderColor: COLORS.red },
  errorText: { fontSize: 10, color: COLORS.red, fontWeight: '700', marginLeft: 4, marginTop: -8, textTransform: 'uppercase', letterSpacing: 1 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, padding: 12, marginBottom: 24,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B', lineHeight: 18 },
  limitCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: `${COLORS.primary}0D`, borderRadius: 12, padding: 16, marginBottom: 24,
  },
  limitText: { flex: 1, fontSize: 13, color: COLORS.dark, lineHeight: 18 },
  autoAssignBanner: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: `${COLORS.primary}0D`, alignItems: 'flex-start' },
  autoAssignText: { flex: 1, fontSize: 12, color: COLORS.dark, lineHeight: 16 },
  addBtn: { borderWidth: 2, borderColor: COLORS.dark, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { fontWeight: '700', fontSize: 18 },
  btnDisabled: { opacity: 0.5 },
  bottomSection: { padding: 24, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: `${COLORS.slate[200]}` },
  continueHint: { fontSize: 12, color: COLORS.slate[500], textAlign: 'center', marginBottom: 10, fontWeight: '600' },
  continueBtn: { width: '100%', paddingVertical: 20, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center' },
  continueBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 20 },
});
