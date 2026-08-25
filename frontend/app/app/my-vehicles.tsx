import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

type Vehicle = { _id: string; type: 'car' | 'bike'; number: string; parkingSlot?: string };

export default function MyVehiclesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ type: 'car' | 'bike'; number: string; parkingSlot: string }>({ type: 'car', number: '', parkingSlot: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(API.MY_VEHICLES, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setVehicles(json.data.map((v: any) => ({
          _id: String(v._id), type: v.type === 'bike' ? 'bike' : 'car',
          number: String(v.number || ''), parkingSlot: v.parkingSlot || undefined,
        })));
      }
    } catch {
      /* keep whatever we have */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const addVehicle = async () => {
    const number = form.number.trim().toUpperCase();
    if (number.length < 3) { setBanner({ type: 'error', text: 'Enter a valid vehicle number.' }); return; }
    setSaving(true);
    try {
      const res = await fetch(API.MY_VEHICLES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: form.type, number, parkingSlot: form.parkingSlot.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not add vehicle');
      setShowAdd(false);
      setForm({ type: 'car', number: '', parkingSlot: '' });

      // The backend auto-assigns a free society slot — tell the resident which.
      const added = Array.isArray(json.data) ? json.data.find((v: any) => v.number === number) : null;
      setBanner(
        added?.parkingSlot
          ? { type: 'success', text: `${number} added and parked at slot ${added.parkingSlot}.` }
          : { type: 'success', text: `${number} added. No free slot available — the secretary will allot one.` }
      );
      await load();
    } catch (e: any) {
      const m = String(e?.message || '');
      setBanner({
        type: 'error',
        text: /failed to fetch|network|timed out/i.test(m)
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : m || 'Could not add the vehicle.',
      });
    } finally {
      setSaving(false);
    }
  };

  // In-app confirm (Alert.alert with buttons is a no-op on the web build).
  const doDelete = async () => {
    const v = confirmDelete;
    if (!v || !token) return;
    setDeleting(true);
    try {
      const res = await fetch(API.MY_VEHICLE(v._id), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Could not remove vehicle (${res.status})`);
      setVehicles((prev) => prev.filter((x) => x._id !== v._id));
      setConfirmDelete(null);
      setBanner({ type: 'success', text: `${v.number} removed. Its parking slot is free again.` });
    } catch (e: any) {
      const m = String(e?.message || '');
      setBanner({
        type: 'error',
        text: /failed to fetch|network|timed out/i.test(m)
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : m || 'Could not remove the vehicle.',
      });
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.push('/(tabs)/profile')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Vehicles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {banner ? (
          <TouchableOpacity
            style={[styles.banner, banner.type === 'success' ? styles.bannerOk : styles.bannerErr]}
            onPress={() => setBanner(null)}
            activeOpacity={0.9}
          >
            <Ionicons name={banner.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={banner.type === 'success' ? '#1d7a3a' : COLORS.red} />
            <Text style={[styles.bannerText, { color: banner.type === 'success' ? '#1d7a3a' : COLORS.red }]}>{banner.text}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : vehicles.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={40} color={COLORS.slate[300]} />
            <Text style={styles.emptyText}>No vehicles yet.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Add your first vehicle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vehicles.map((vehicle) => (
            <View key={vehicle._id} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={vehicle.type === 'car' ? 'car' : 'bicycle'} size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{vehicle.number}</Text>
                <Text style={styles.subtitle}>{vehicle.type === 'car' ? 'Car' : 'Bike'}</Text>
              </View>
              {vehicle.parkingSlot ? (
                <View style={styles.slotBadge}><Text style={styles.slotText}>{vehicle.parkingSlot}</Text></View>
              ) : (
                <View style={[styles.slotBadge, styles.slotBadgeEmpty]}><Text style={styles.slotTextEmpty}>No slot</Text></View>
              )}
              <TouchableOpacity onPress={() => setConfirmDelete(vehicle)} style={styles.trashBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add Vehicle</Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {(['car', 'bike'] as const).map((t) => (
                <TouchableOpacity key={t} style={[styles.typeChip, form.type === t && styles.typeChipActive]} onPress={() => setForm({ ...form, type: t })}>
                  <Ionicons name={t === 'car' ? 'car' : 'bicycle'} size={18} color={form.type === t ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.typeChipText, form.type === t && { color: COLORS.white }]}>{t === 'car' ? 'Car' : 'Bike'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Vehicle number</Text>
            <TextInput
              style={styles.input}
              value={form.number}
              onChangeText={(t) => setForm({ ...form, number: t })}
              placeholder="MH 12 AB 1234"
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Parking slot (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.parkingSlot}
              onChangeText={(t) => setForm({ ...form, parkingSlot: t })}
              placeholder="Leave blank — a free slot is assigned automatically"
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="characters"
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetBtn, styles.ghost]} onPress={() => setShowAdd(false)}>
                <Text style={styles.ghostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={addVehicle}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryText}>Add Vehicle</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirmation — works on web and native */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash" size={26} color={COLORS.red} />
            </View>
            <Text style={styles.confirmTitle}>Remove vehicle?</Text>
            <Text style={styles.confirmText}>
              {confirmDelete?.number} will be removed{confirmDelete?.parkingSlot ? `, and slot ${confirmDelete.parkingSlot} will become available` : ''}.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.sheetBtn, styles.ghost]} disabled={deleting} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.ghostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.dangerBtn, deleting && { opacity: 0.6 }]} disabled={deleting} onPress={doDelete}>
                {deleting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryText}>Remove</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.dark },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: `${COLORS.primary}1A`, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  subtitle: { marginTop: 2, fontSize: 12, color: COLORS.slate[500] },
  slotBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: COLORS.accentGreen },
  slotBadgeEmpty: { backgroundColor: COLORS.slate[100] },
  slotText: { fontSize: 11, fontWeight: '800', color: COLORS.dark },
  slotTextEmpty: { fontSize: 11, fontWeight: '700', color: COLORS.slate[400] },
  trashBtn: { padding: 6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 14, color: COLORS.slate[400], fontWeight: '600' },
  emptyBtn: { marginTop: 6, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.slate[300], marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '800', color: COLORS.slate[500], marginTop: 12, marginBottom: 6 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: `${COLORS.primary}33` },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  input: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  sheetBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  ghost: { backgroundColor: COLORS.slate[100] },
  ghostText: { fontSize: 15, fontWeight: '800', color: COLORS.slate[600] },
  primary: { backgroundColor: COLORS.primary },
  primaryText: { fontSize: 15, fontWeight: '800', color: COLORS.white },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 4 },
  bannerOk: { backgroundColor: '#e6f4eb' },
  bannerErr: { backgroundColor: '#fdecec' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },

  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 20, padding: 22, alignItems: 'center' },
  confirmIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: `${COLORS.red}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  confirmText: { fontSize: 13.5, color: COLORS.slate[500], textAlign: 'center', marginTop: 6, lineHeight: 19 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  dangerBtn: { backgroundColor: COLORS.red },
});
