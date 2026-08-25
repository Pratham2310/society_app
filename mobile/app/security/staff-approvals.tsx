import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../../components/ConfirmDialog';
import { API, apiFetch } from '../../constants/api';
import { useAuth, useRole } from '../../context/AuthContext';

const PRIMARY = '#922207';
const GREEN = '#1d7a3a';

// How long the issued gate pass lasts. A month matches how households actually
// employ daily help, and keeps a lapsed maid from holding a pass forever.
const DURATIONS = [
  { days: 30,  label: '1 month' },
  { days: 90,  label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
] as const;

type Pending = {
  _id: string;
  name: string;
  role: string;
  phone: string;
  entryTime?: string;
  flatId?: { flatNumber?: string } | string | null;
  createdAt?: string;
};

export default function StaffApprovalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { confirm, dialog } = useConfirm();
  // Mirrors canManageSecurity on the backend.
  const { isSecretary, isChairman, isCommittee, isSuperAdmin } = useRole();
  const canManage = isSecretary || isChairman || isCommittee || isSuperAdmin;

  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);

  const load = useCallback(async () => {
    if (!token || !canManage) { setLoading(false); return; }
    setError(null);
    try {
      const json = await apiFetch(API.HOUSEHOLD_STAFF_PENDING, {}, token);
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server. Reopen this screen to retry.');
    } finally {
      setLoading(false);
    }
  }, [token, canManage]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (row: Pending, approved: boolean) => {
    setBusy(row._id);
    setError(null);
    try {
      await apiFetch(
        API.HOUSEHOLD_STAFF_DECIDE(row._id),
        { method: 'PATCH', body: JSON.stringify({ approved, validDays: days }) },
        token || undefined,
      );
      setBanner(
        approved
          ? `${row.name} approved — their gate pass is now active for ${DURATIONS.find((d) => d.days === days)?.label}.`
          : `${row.name}'s request was declined.`
      );
      await load();
    } catch (e: any) {
      setError(String(e?.message || 'Could not save that decision.'));
    } finally {
      setBusy(null);
    }
  };

  const confirmReject = (row: Pending) =>
    confirm({
      title: `Decline ${row.name}?`,
      message: 'The resident is told it was declined, and no gate pass is issued.',
      confirmLabel: 'Decline',
      destructive: true,
      onConfirm: () => decide(row, false),
    });

  if (!canManage) {
    return (
      <View style={[styles.screen, styles.center]}>
        <MaterialIcons name="lock" size={40} color="#c9c4c1" />
        <Text style={styles.deniedText}>Only the secretary or a committee member can approve staff.</Text>
        <Pressable style={styles.ghostBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
          <Text style={styles.ghostBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const flatOf = (row: Pending) =>
    typeof row.flatId === 'object' && row.flatId ? row.flatId.flatNumber : undefined;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Staff Approvals</Text>
            <Text style={styles.headerSub}>HOUSEHOLD HELP REQUESTS</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {banner ? (
          <Pressable style={styles.okBanner} onPress={() => setBanner(null)}>
            <MaterialIcons name="check-circle" size={18} color={GREEN} />
            <Text style={styles.okBannerText}>{banner}</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Pressable style={styles.errBanner} onPress={() => setError(null)}>
            <MaterialIcons name="error-outline" size={18} color={PRIMARY} />
            <Text style={styles.errBannerText}>{error}</Text>
          </Pressable>
        ) : null}

        {rows.length > 0 ? (
          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>GATE PASS VALID FOR</Text>
            <View style={styles.chipRow}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d.days}
                  style={[styles.chip, days === d.days && styles.chipActive]}
                  onPress={() => setDays(d.days)}
                >
                  <Text style={[styles.chipText, days === d.days && styles.chipTextActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={PRIMARY} /></View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="inbox" size={34} color="#c9c4c1" />
            <Text style={styles.emptyText}>No staff waiting for approval.</Text>
            <Text style={styles.emptySub}>
              When a resident registers a maid or cook, the request appears here for you
              to approve and issue their gate pass.
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <View key={row._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}><MaterialIcons name="badge" size={20} color={PRIMARY} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={styles.meta}>
                    {String(row.role).toUpperCase()}
                    {flatOf(row) ? `  •  Flat ${flatOf(row)}` : ''}
                  </Text>
                  <Text style={styles.metaSub}>
                    {row.phone}
                    {row.entryTime ? `  •  arrives ${row.entryTime}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.rejectBtn, busy === row._id && { opacity: 0.5 }]}
                  onPress={() => confirmReject(row)}
                  disabled={!!busy}
                >
                  <Text style={styles.rejectText}>DECLINE</Text>
                </Pressable>
                <Pressable
                  style={[styles.approveBtn, busy === row._id && { opacity: 0.5 }]}
                  onPress={() => decide(row, true)}
                  disabled={!!busy}
                >
                  {busy === row._id
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.approveText}>APPROVE & ISSUE PASS</Text>}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  content: { paddingHorizontal: 20, gap: 10 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#a99e99', marginTop: 2 },

  okBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eaf6ee',
    borderWidth: 1, borderColor: '#c5e4d0', borderRadius: 12, padding: 12,
  },
  okBannerText: { flex: 1, fontSize: 12.5, color: GREEN, fontWeight: '600', lineHeight: 17 },
  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fdeceb',
    borderWidth: 1, borderColor: '#f5c6c2', borderRadius: 12, padding: 12,
  },
  errBannerText: { flex: 1, fontSize: 12.5, color: '#8a2318', fontWeight: '600', lineHeight: 17 },

  durationCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#ece7e5' },
  durationLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#a99e99' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#faf8f7', borderWidth: 1, borderColor: '#ece7e5' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: '700', color: '#5c534f' },
  chipTextActive: { color: '#fff' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#5c534f' },
  emptySub: { fontSize: 12, color: '#a99e99', textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ece7e5', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${PRIMARY}12`, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800', color: '#090C02' },
  meta: { fontSize: 11, color: '#5c534f', marginTop: 2, letterSpacing: 0.4, fontWeight: '600' },
  metaSub: { fontSize: 11, color: '#a99e99', marginTop: 2 },

  actions: { flexDirection: 'row', gap: 10, padding: 14, paddingTop: 0 },
  rejectBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2efed' },
  rejectText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: '#5c534f' },
  approveBtn: { flex: 2, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY },
  approveText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: '#fff' },

  deniedText: { fontSize: 14, color: '#5c534f', textAlign: 'center', lineHeight: 20 },
  ghostBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff' },
  ghostBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#5c534f' },
});
