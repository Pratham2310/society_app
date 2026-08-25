import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { LIMITS } from '../constants/registrationRules';
import { useRegistration } from '../context/RegistrationContext';

interface Wing { _id: string; name: string }
interface Flat { _id: string; flatNumber: string; isOccupied: boolean }

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, update } = useRegistration();

  const [wings,   setWings]   = useState<Wing[]>([]);
  const [floors,  setFloors]  = useState<number[]>([]);
  const [flats,   setFlats]   = useState<Flat[]>([]);

  const [selectedWing,  setSelectedWing]  = useState<Wing | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedFlat,  setSelectedFlat]  = useState<Flat | null>(null);

  const [showFloorPicker, setShowFloorPicker] = useState(false);
  const [showFlatPicker,  setShowFlatPicker]  = useState(false);
  const [loadingWings,    setLoadingWings]    = useState(true);
  const [loadingFloors,   setLoadingFloors]   = useState(false);
  const [loadingFlats,    setLoadingFlats]    = useState(false);

  const [role,        setRole]        = useState<'owner' | 'tenant'>('owner');
  const [livingStatus, setLivingStatus] = useState<'family' | 'bachelor'>('family');
  const [familySize,  setFamilySize]  = useState(4);

  // Alert.alert is a no-op on the web build, so load failures used to leave this
  // screen silently empty with no explanation.
  const [notice, setNotice] = useState<string | null>(null);

  // Load wings for this society (public endpoint — no auth needed during registration)
  useEffect(() => {
    if (!data.societyId) { router.replace('/society-key'); return; }
    let cancelled = false;
    (async () => {
      setLoadingWings(true);
      try {
        const json = await apiFetch(API.WINGS(data.societyId!));
        if (!cancelled) { setWings(json.wings || []); setNotice(null); }
      } catch (err: any) {
        if (!cancelled) setNotice(err?.message || 'Could not load wings. Check your internet connection.');
      } finally {
        if (!cancelled) setLoadingWings(false);
      }
    })();
    return () => { cancelled = true; };
  }, [data.societyId]);

  // Load floors when wing selected
  useEffect(() => {
    if (!selectedWing) return;
    setSelectedFloor(null); setSelectedFlat(null);
    setFloors([]); setFlats([]);
    let cancelled = false;
    (async () => {
      setLoadingFloors(true);
      try {
        const json = await apiFetch(API.FLOORS(selectedWing._id));
        if (!cancelled) { setFloors(json.floors || []); setNotice(null); }
      } catch (err: any) {
        if (!cancelled) setNotice(err?.message || 'Could not load floors for this wing.');
      } finally {
        if (!cancelled) setLoadingFloors(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWing]);

  // Load flats when floor selected
  useEffect(() => {
    if (!selectedWing || selectedFloor === null) return;
    setSelectedFlat(null); setFlats([]);
    let cancelled = false;
    (async () => {
      setLoadingFlats(true);
      try {
        const json = await apiFetch(API.FLATS(selectedWing._id, String(selectedFloor)));
        if (!cancelled) { setFlats(json.flats || []); setNotice(null); }
      } catch (err: any) {
        if (!cancelled) setNotice(err?.message || 'Could not load flats for this floor.');
      } finally {
        if (!cancelled) setLoadingFlats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWing, selectedFloor]);

  const handleContinue = () => {
    if (!selectedWing || selectedFloor === null || !selectedFlat) {
      setNotice('Please select your wing, floor and flat before continuing.');
      return;
    }
    if (livingStatus === 'family' && (familySize < LIMITS.FAMILY_SIZE_MIN || familySize > LIMITS.FAMILY_SIZE_MAX)) {
      setNotice(`Family size must be between ${LIMITS.FAMILY_SIZE_MIN} and ${LIMITS.FAMILY_SIZE_MAX}.`);
      return;
    }
    setNotice(null);
    update({
      wingId: selectedWing._id,
      flatNumber: selectedFlat.flatNumber,
      occupancyType: role,
      livingType: livingStatus,
      familySize: livingStatus === 'family' ? familySize : 1,
    });
    router.push('/vehicle');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/identity' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.slate[900]} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>STEP 2 OF 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressDot} />
        <View style={[styles.progressDot, styles.progressActive]} />
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.title}>Where do you live?</Text>
        <Text style={styles.description}>Select your wing and flat to connect with your society.</Text>

        {notice ? (
          <TouchableOpacity style={styles.notice} onPress={() => setNotice(null)} activeOpacity={0.9}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {/* Wing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Wing / Building</Text>
          {loadingWings ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading wings...</Text>
            </View>
          ) : wings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="business-outline" size={32} color={COLORS.slate[300]} />
              <Text style={styles.emptyTitle}>No wings found</Text>
              <Text style={styles.emptySubtitle}>
                Your society admin hasn't set up wings yet. Contact them or try again.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => {
                setWings([]); setLoadingWings(true);
                apiFetch(API.WINGS(data.societyId!))
                  .then(json => setWings(json.wings || []))
                  .catch(() => {})
                  .finally(() => setLoadingWings(false));
              }}>
                <Ionicons name="refresh" size={16} color={COLORS.primary} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.wingRow}>
              {wings.map(wing => (
                <TouchableOpacity
                  key={wing._id}
                  style={[styles.wingBtn, selectedWing?._id === wing._id && styles.wingBtnActive]}
                  onPress={() => { setSelectedWing(wing); setShowFloorPicker(false); setShowFlatPicker(false); }}
                >
                  <Text style={[styles.wingBtnText, selectedWing?._id === wing._id && styles.wingBtnTextActive]}>{wing.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Floor */}
        {selectedWing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Floor</Text>
            <TouchableOpacity style={styles.flatSelector} onPress={() => setShowFloorPicker(!showFloorPicker)}>
              <Ionicons name="business" size={20} color={COLORS.slate[400]} />
              <Text style={[styles.flatSelectorText, selectedFloor !== null ? { color: COLORS.slate[900] } : null]}>
                {selectedFloor !== null ? `Floor ${selectedFloor}` : 'Select your floor'}
              </Text>
              {loadingFloors
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Ionicons name={showFloorPicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.slate[400]} />
              }
            </TouchableOpacity>
            {showFloorPicker && (
              <ScrollView style={styles.flatGridScroll} contentContainerStyle={styles.flatGrid} nestedScrollEnabled>
                {floors.map(floor => (
                  <TouchableOpacity
                    key={floor}
                    style={[styles.flatChip, selectedFloor === floor && styles.flatChipActive]}
                    onPress={() => { setSelectedFloor(floor); setShowFloorPicker(false); }}
                  >
                    <Text style={[styles.flatChipText, selectedFloor === floor && styles.flatChipTextActive]}>{`Floor ${floor}`}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Flat */}
        {selectedFloor !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flat Number</Text>
            <TouchableOpacity style={styles.flatSelector} onPress={() => setShowFlatPicker(!showFlatPicker)}>
              <Ionicons name="search" size={20} color={COLORS.slate[400]} />
              <Text style={[styles.flatSelectorText, selectedFlat ? { color: COLORS.slate[900] } : null]}>
                {selectedFlat ? selectedFlat.flatNumber : 'Select your flat'}
              </Text>
              {loadingFlats
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Ionicons name={showFlatPicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.slate[400]} />
              }
            </TouchableOpacity>
            {showFlatPicker && (
              <ScrollView style={styles.flatGridScroll} contentContainerStyle={styles.flatGrid} nestedScrollEnabled>
                {flats.map(flat => (
                  <TouchableOpacity
                    key={flat._id}
                    style={[styles.flatChip, selectedFlat?._id === flat._id && styles.flatChipActive, flat.isOccupied && styles.flatChipOccupied]}
                    onPress={() => { if (!flat.isOccupied) { setSelectedFlat(flat); setShowFlatPicker(false); } }}
                    disabled={flat.isOccupied}
                  >
                    <Text style={[styles.flatChipText, selectedFlat?._id === flat._id && styles.flatChipTextActive, flat.isOccupied && styles.flatChipTextOccupied]}>
                      {flat.flatNumber}{flat.isOccupied ? ' ✗' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Role */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I am a...</Text>
          <View style={styles.choiceRow}>
            {(['owner', 'tenant'] as const).map(r => (
              <TouchableOpacity key={r} style={[styles.choiceCard, role === r && styles.choiceCardActive]} onPress={() => setRole(r)}>
                <Ionicons name={r === 'owner' ? 'home' : 'key'} size={24} color={role === r ? COLORS.dark : COLORS.slate[400]} />
                <Text style={[styles.choiceText, role === r && styles.choiceTextActive]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Living Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Living Status</Text>
          <View style={styles.choiceRow}>
            {(['bachelor', 'family'] as const).map(ls => (
              <TouchableOpacity key={ls} style={[styles.choiceCard, livingStatus === ls && styles.choiceCardActive]} onPress={() => setLivingStatus(ls)}>
                <Ionicons name={ls === 'bachelor' ? 'person' : 'people'} size={24} color={livingStatus === ls ? COLORS.dark : COLORS.slate[400]} />
                <Text style={[styles.choiceText, livingStatus === ls && styles.choiceTextActive]}>{ls.charAt(0).toUpperCase() + ls.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {livingStatus === 'family' && (
            <View style={styles.familySizeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.familySizeTitle}>Family Size</Text>
                <Text style={styles.familySizeSubtitle}>Includes kids & elderly</Text>
              </View>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={[styles.counterBtn, familySize <= LIMITS.FAMILY_SIZE_MIN && styles.counterBtnDisabled]}
                  disabled={familySize <= LIMITS.FAMILY_SIZE_MIN}
                  onPress={() => setFamilySize(s => Math.max(LIMITS.FAMILY_SIZE_MIN, s - 1))}
                >
                  <Ionicons name="remove" size={20} color={COLORS.slate[500]} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{familySize.toString().padStart(2, '0')}</Text>
                {/* Clamped, not free-running: the backend caps familySize at 20,
                    so an unbounded "+" let the resident build a number that only
                    got rejected on the final screen. */}
                <TouchableOpacity
                  style={[styles.counterBtn, styles.counterBtnPlus, familySize >= LIMITS.FAMILY_SIZE_MAX && styles.counterBtnDisabled]}
                  disabled={familySize >= LIMITS.FAMILY_SIZE_MAX}
                  onPress={() => setFamilySize(s => Math.min(LIMITS.FAMILY_SIZE_MAX, s + 1))}
                >
                  <Ionicons name="add" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {livingStatus === 'family' && familySize >= LIMITS.FAMILY_SIZE_MAX ? (
            <Text style={styles.capHint}>Maximum family size is {LIMITS.FAMILY_SIZE_MAX}.</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.continueBtn, (!selectedWing || selectedFloor === null || !selectedFlat) && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!selectedWing || selectedFloor === null || !selectedFlat}
          activeOpacity={0.8}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 8 },
  backBtn: { padding: 8, marginLeft: -8, borderRadius: 999 },
  stepLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 3, color: `${COLORS.primary}99` },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}33` },
  progressActive: { width: 40, backgroundColor: COLORS.primary },
  scrollContent: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.slate[900], marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.slate[500], lineHeight: 22, marginBottom: 32 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.slate[900], marginBottom: 16 },
  loadingBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  loadingText: { fontSize: 13, color: COLORS.slate[400] },
  emptyBox: {
    alignItems: 'center', paddingVertical: 24, gap: 8,
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.slate[200], padding: 20,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.slate[800] },
  emptySubtitle: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  wingRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  wingBtn: { flex: 1, minWidth: 80, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  wingBtnActive: { backgroundColor: COLORS.accentGreen, borderColor: COLORS.dark },
  wingBtnText: { fontWeight: '700', fontSize: 14, color: COLORS.slate[600] },
  wingBtnTextActive: { color: COLORS.dark },
  flatSelector: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.slate[200], backgroundColor: COLORS.white },
  flatSelectorText: { flex: 1, fontSize: 14, color: COLORS.slate[400] },
  flatGridScroll: { maxHeight: 200, marginTop: 12, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.slate[200] },
  flatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  flatChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.slate[50] },
  flatChipActive: { backgroundColor: COLORS.primary },
  flatChipOccupied: { backgroundColor: COLORS.slate[100], opacity: 0.5 },
  flatChipText: { fontWeight: '600', color: COLORS.slate[900] },
  flatChipTextActive: { color: COLORS.white },
  flatChipTextOccupied: { color: COLORS.slate[400] },
  choiceRow: { flexDirection: 'row', gap: 12 },
  choiceCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 2, borderColor: 'transparent' },
  choiceCardActive: { borderColor: COLORS.dark, backgroundColor: COLORS.accentGreen },
  choiceText: { fontWeight: '700', fontSize: 12, color: COLORS.slate[600], marginTop: 8 },
  choiceTextActive: { color: COLORS.dark },
  familySizeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${COLORS.primary}0D`, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: `${COLORS.primary}1A`, marginTop: 16 },
  familySizeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.slate[900] },
  familySizeSubtitle: { fontSize: 11, color: COLORS.slate[600], marginTop: 2 },
  counterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${COLORS.white}80`, padding: 4, borderRadius: 12 },
  counterBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  counterBtnPlus: { backgroundColor: COLORS.primary },
  counterBtnDisabled: { opacity: 0.4 },
  capHint: { fontSize: 11, color: COLORS.slate[500], fontWeight: '600', marginTop: 8, marginLeft: 4 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, padding: 12, marginBottom: 24,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B', lineHeight: 18 },
  counterValue: { width: 40, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.slate[900] },
  bottomSection: { padding: 24, backgroundColor: `${COLORS.white}CC`, borderTopWidth: 1, borderTopColor: COLORS.slate[100] },
  continueBtn: { width: '100%', paddingVertical: 20, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  continueBtnText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
});
