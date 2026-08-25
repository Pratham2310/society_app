import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Slot = {
  id: string;            // slot number, e.g. "P-42"
  type: 'car' | 'bike';
  vehicle: string | null;
  number: string | null; // plate
  ownerName?: string | null;
  flatNumber?: string | null;
  isMine?: boolean;
  status: 'occupied' | 'empty';
};

const SLOTS_PER_AISLE = 4;

type MyVehicle = { _id: string; type: string; number: string; parkingSlot?: string };

export default function ParkingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  // The backend gates parking on parking.manage,
  // which is not the same set as the old isManager grouping —
  // it let a treasurer see controls that would 403, and hid
  // them from a committee member who does hold the permission.
  const isManager = can(PERM.PARKING_MANAGE);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [myVehicles, setMyVehicles] = useState<MyVehicle[]>([]);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Secretary: create slots in bulk
  const [showAdd, setShowAdd] = useState(false);
  const [slotForm, setSlotForm] = useState({ prefix: 'P', count: '20', type: 'resident' as 'resident' | 'visitor' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      // My Vehicles come from the same source as the profile / My Vehicles
      // screen (User.vehicles); the map comes from the society's parking slots.
      const [sum, veh] = await Promise.all([
        fetch(API.PARKING_SUMMARY, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(API.MY_VEHICLES, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (Array.isArray(sum?.data?.slots)) setSlots(sum.data.slots);
      if (Array.isArray(veh?.data)) setMyVehicles(veh.data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createSlots = async () => {
    const count = Number(slotForm.count);
    if (!slotForm.prefix.trim()) { Alert.alert('Required', 'Enter a slot prefix (e.g. P).'); return; }
    if (!Number.isInteger(count) || count < 1 || count > 200) { Alert.alert('Invalid', 'Enter a count between 1 and 200.'); return; }
    setCreating(true);
    try {
      const res = await fetch(API.PARKING_SLOTS_BATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prefix: slotForm.prefix.trim().toUpperCase(), count, type: slotForm.type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not create slots');
      setShowAdd(false);
      await load();
      Alert.alert('Slots created', `${json.data?.created ?? count} parking slots added.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create slots');
    } finally {
      setCreating(false);
    }
  };

  // Find Owner — match by plate number.
  const ownerMatches = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    if (!q) return [];
    return slots.filter(
      (s) => s.status === 'occupied' && (s.number || '').toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    );
  }, [ownerQuery, slots]);

  // Chunk slots into aisles of 4.
  const aisles = useMemo(() => {
    const groups: Slot[][] = [];
    for (let i = 0; i < slots.length; i += SLOTS_PER_AISLE) {
      groups.push(slots.slice(i, i + SLOTS_PER_AISLE));
    }
    return groups;
  }, [slots]);

  const occupied = slots.filter((s) => s.status === 'occupied').length;
  const available = slots.length - occupied;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Society Parking & Vehicle Hub</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* ── My Vehicles ─────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My Vehicles</Text>
          <TouchableOpacity style={styles.addNew} onPress={() => router.push('/my-vehicles')}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.addNewText}>Add New</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}>
          {myVehicles.map((v) => (
            <View key={v._id} style={styles.vehicleCard}>
              <View style={styles.vehicleTop}>
                <View style={styles.vehicleIcon}>
                  <Ionicons name={v.type === 'bike' ? 'bicycle' : 'car-sport'} size={22} color={COLORS.primary} />
                </View>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text style={styles.vLabel}>PLATE NUMBER</Text>
                  <Text style={styles.vPlate}>{v.number || '—'}</Text>
                </View>
              </View>
              <View style={styles.vehicleBottom}>
                <View>
                  <Text style={styles.vLabel}>Parking Slot</Text>
                  <Text style={styles.vSlot}>{v.parkingSlot ? v.parkingSlot : 'Not assigned'}</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Add-new card */}
          <TouchableOpacity style={styles.addCard} onPress={() => router.push('/my-vehicles')}>
            <Ionicons name="add" size={28} color={COLORS.primary} />
            <Text style={styles.addCardText}>{myVehicles.length ? 'Add Vehicle' : 'Add your first vehicle'}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Find Owner ──────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Find Owner</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={COLORS.slate[400]} />
          <TextInput
            value={ownerQuery}
            onChangeText={setOwnerQuery}
            placeholder="Enter Vehicle Number (e.g. MH 12...)"
            placeholderTextColor={COLORS.slate[400]}
            style={styles.searchInput}
            autoCapitalize="characters"
          />
          {ownerQuery ? (
            <TouchableOpacity onPress={() => setOwnerQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.slate[400]} />
            </TouchableOpacity>
          ) : null}
        </View>

        {ownerQuery ? (
          ownerMatches.length ? (
            ownerMatches.map((m) => (
              <View key={`own-${m.id}`} style={styles.ownerCard}>
                <View style={styles.ownerAvatar}>
                  <Text style={styles.ownerAvatarText}>{(m.ownerName || 'R')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownerName}>{m.ownerName || 'Resident'}</Text>
                  <Text style={styles.ownerMeta}>
                    {m.number}{m.flatNumber ? `  •  Flat ${m.flatNumber}` : ''}
                  </Text>
                </View>
                <View style={styles.ownerSlot}>
                  <Text style={styles.ownerSlotText}>{m.id}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noMatch}>No vehicle found for “{ownerQuery}”.</Text>
          )
        ) : null}

        {/* ── Parking Map ─────────────────────────────── */}
        <View style={[styles.sectionHead, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Parking Map</Text>
          {isManager ? (
            <TouchableOpacity style={styles.addSlotsBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={14} color={COLORS.white} />
              <Text style={styles.addSlotsText}>Add Slots</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.legendText}>OCCUPIED</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchFree]} />
            <Text style={styles.legendText}>AVAILABLE</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchMine]} />
            <Text style={styles.legendText}>MINE</Text>
          </View>
        </View>

        {/* Tapped slot detail */}
        {selectedSlot ? (() => {
          const s = slots.find((x) => x.id === selectedSlot);
          if (!s) return null;
          return (
            <View style={styles.slotDetail}>
              <View style={[styles.slotDetailBadge, { backgroundColor: s.status === 'occupied' ? COLORS.primary : COLORS.slate[200] }]}>
                <Text style={[styles.slotDetailBadgeText, { color: s.status === 'occupied' ? COLORS.white : COLORS.slate[600] }]}>{s.id}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotDetailTitle}>
                  {s.status === 'occupied' ? (s.isMine ? 'Your slot' : (s.ownerName || 'Occupied')) : 'Available'}
                </Text>
                <Text style={styles.slotDetailMeta}>
                  {s.number ? `${s.number}` : 'No vehicle assigned'}{s.flatNumber ? ` · Flat ${s.flatNumber}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSlot(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>
          );
        })() : null}

        <View style={styles.mapCard}>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ paddingVertical: 24 }} />
          ) : slots.length === 0 ? (
            <View style={styles.mapEmptyBox}>
              <Ionicons name="grid-outline" size={34} color={COLORS.slate[300]} />
              <Text style={styles.mapEmpty}>
                No parking slots configured yet.
                {isManager ? '\nTap “Add Slots” above to create the society’s parking map.' : '\nYour secretary will set these up.'}
              </Text>
              {isManager ? (
                <TouchableOpacity style={styles.mapEmptyCta} onPress={() => setShowAdd(true)}>
                  <Ionicons name="add" size={16} color={COLORS.white} />
                  <Text style={styles.mapEmptyCtaText}>Create Parking Slots</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {aisles.map((aisle, ai) => (
            <View key={`aisle-${ai}`}>
              <View style={styles.slotRow}>
                {aisle.map((slot) => {
                  const isOccupied = slot.status === 'occupied';
                  const isSelected = selectedSlot === slot.id;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
                      style={[
                        styles.slot,
                        isOccupied ? styles.slotOccupied : styles.slotFree,
                        slot.isMine && styles.slotMine,
                        isSelected && styles.slotSelected,
                      ]}
                    >
                      <Ionicons
                        name={slot.type === 'bike' ? 'bicycle' : 'car'}
                        size={24}
                        color={isOccupied ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.07)'}
                        style={styles.slotGhost}
                      />
                      <Text style={[styles.slotText, isOccupied ? styles.slotTextOccupied : styles.slotTextFree]}>
                        {slot.id}
                      </Text>
                      {slot.isMine ? (
                        <View style={styles.mineDot}><Ionicons name="star" size={8} color={COLORS.white} /></View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.aisleDivider}>
                <View style={styles.aisleLine} />
                <Text style={styles.aisleLabel}>AISLE {ai + 1}</Text>
                <View style={styles.aisleLine} />
              </View>
            </View>
          ))}

          {slots.length > 0 ? (
            <View style={styles.mapFooter}>
              <Text style={styles.mapFooterText}>{occupied} occupied</Text>
              <Text style={styles.mapFooterDot}>•</Text>
              <Text style={[styles.mapFooterText, { color: '#1d7a3a' }]}>{available} available</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Secretary: bulk-create parking slots */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Parking Slots</Text>
            <Text style={styles.modalSub}>Slots are numbered automatically, e.g. P-1 … P-20.</Text>

            <Text style={styles.modalLabel}>Slot prefix</Text>
            <TextInput
              style={styles.modalInput}
              value={slotForm.prefix}
              onChangeText={(t) => setSlotForm({ ...slotForm, prefix: t })}
              placeholder="P"
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="characters"
            />

            <Text style={styles.modalLabel}>How many slots?</Text>
            <TextInput
              style={styles.modalInput}
              value={slotForm.count}
              onChangeText={(t) => setSlotForm({ ...slotForm, count: t.replace(/\D/g, '') })}
              placeholder="20"
              placeholderTextColor={COLORS.slate[400]}
              keyboardType="number-pad"
            />

            <Text style={styles.modalLabel}>Slot type</Text>
            <View style={styles.typeRow}>
              {(['resident', 'visitor'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, slotForm.type === t && styles.typeChipActive]}
                  onPress={() => setSlotForm({ ...slotForm, type: t })}
                >
                  <Text style={[styles.typeChipText, slotForm.type === t && styles.typeChipTextActive]}>
                    {t === 'resident' ? 'Resident' : 'Visitor'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.mBtn, styles.mGhost]} onPress={() => setShowAdd(false)}>
                <Text style={styles.mGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mPrimary, creating && { opacity: 0.6 }]} disabled={creating} onPress={createSlots}>
                {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.mPrimaryText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.dark },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  addNew: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addNewText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // My Vehicles
  vehicleCard: { width: 230, backgroundColor: COLORS.white, borderRadius: 18, padding: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  vLabel: { fontSize: 9, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 1 },
  vPlate: { fontSize: 17, fontWeight: '900', color: COLORS.dark, marginTop: 2 },
  vehicleBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  vSlot: { fontSize: 15, fontWeight: '800', color: COLORS.dark, marginTop: 2 },
  parkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: `${COLORS.primary}12` },
  parkedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  parkedText: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  addCard: { width: 120, borderRadius: 18, borderWidth: 2, borderColor: `${COLORS.primary}33`, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addCardText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // Find Owner
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200], marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },
  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginTop: 10 },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  ownerAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  ownerName: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  ownerMeta: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  ownerSlot: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.primary },
  ownerSlotText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  noMatch: { fontSize: 13, color: COLORS.slate[400], marginTop: 12, textAlign: 'center' },

  // Parking Map
  addSlotsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  addSlotsText: { fontSize: 11, fontWeight: '800', color: COLORS.white, letterSpacing: 0.4 },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendSwatchFree: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[300] },
  legendSwatchMine: { backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.dark },
  legendText: { fontSize: 9, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 0.5 },
  slotDetail: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1, borderColor: COLORS.slate[200] },
  slotDetailBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  slotDetailBadgeText: { fontSize: 13, fontWeight: '900' },
  slotDetailTitle: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  slotDetailMeta: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  mapCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 16, marginTop: 14 },
  mapEmptyBox: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  mapEmpty: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center', fontWeight: '600', lineHeight: 19 },
  mapEmptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  mapEmptyCtaText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  slotRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  slot: { flex: 1, aspectRatio: 1.15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotOccupied: { backgroundColor: COLORS.primary },
  slotFree: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[300] },
  slotMine: { borderWidth: 2.5, borderColor: COLORS.dark },
  slotSelected: { borderWidth: 2.5, borderColor: '#c98a00' },
  mineDot: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center' },
  slotGhost: { position: 'absolute' },
  slotText: { fontSize: 12, fontWeight: '900' },
  slotTextOccupied: { color: COLORS.white },
  slotTextFree: { color: COLORS.slate[500] },
  aisleDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  aisleLine: { flex: 1, height: 1, backgroundColor: COLORS.slate[100] },
  aisleLabel: { fontSize: 9, fontWeight: '800', color: COLORS.slate[400], letterSpacing: 1.5 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  mapFooterText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  mapFooterDot: { color: COLORS.slate[300] },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: COLORS.dark },
  modalSub: { fontSize: 12, color: COLORS.slate[500], marginTop: 4 },
  modalLabel: { fontSize: 12, fontWeight: '800', color: COLORS.slate[500], marginTop: 16, marginBottom: 6 },
  modalInput: { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.slate[200] },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, fontWeight: '700', color: COLORS.slate[600] },
  typeChipTextActive: { color: COLORS.white },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  mBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  mGhost: { backgroundColor: COLORS.slate[100] },
  mGhostText: { fontWeight: '800', color: COLORS.slate[600] },
  mPrimary: { backgroundColor: COLORS.primary },
  mPrimaryText: { fontWeight: '800', color: COLORS.white },
});
