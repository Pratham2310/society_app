import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

type AlertRow = {
  _id: string; type: string; message?: string; status: 'active' | 'acknowledged';
  userId?: { name?: string; phone?: string; flatNumber?: string } | string;
  flatId?: { flatNumber?: string };
  createdAt?: string;
};
type VisitorRow = {
  _id: string; name: string; phone?: string; purpose?: string; vehicleNumber?: string;
  entryTime?: string | null; exitTime?: string | null; approved?: boolean;
  flatId?: { flatNumber?: string }; flatNumber?: string;
};
type StaffRow = { _id: string; name: string; role: string; marked?: string | null };

const GREEN = '#1d7a3a';
const AMBER = '#c98a00';

const fmt = (t?: string | null) =>
  t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export default function GuardDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', purpose: '', vehicleNumber: '', flatId: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const authHeaders = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [aRes, vRes, sRes, attRes] = await Promise.all([
        fetch(API.SECURITY_ALERTS, { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
        fetch(API.SECURITY_VISITORS('today'), { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
        fetch(API.SECURITY_STAFF, { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
        fetch(API.SECURITY_ATTENDANCE_TODAY, { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
      ]);

      setAlerts(Array.isArray(aRes?.data) ? aRes.data : []);
      setVisitors(Array.isArray(vRes?.data) ? vRes.data : []);

      // Merge today's attendance into the staff list.
      const marked = new Map<string, string>();
      (Array.isArray(attRes?.data) ? attRes.data : []).forEach((row: any) => {
        marked.set(String(row.staffId?._id || row.staffId), row.status);
      });
      setStaff((Array.isArray(sRes?.data) ? sRes.data : []).map((s: any) => ({
        _id: String(s._id), name: String(s.name || 'Staff'), role: String(s.role || 'other'),
        marked: marked.get(String(s._id)) || null,
      })));
    } catch {
      /* offline — keep whatever we have */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── actions ───────────────────────────────────────────────
  const act = async (key: string, url: string, method = 'PATCH', body?: any) => {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { ...authHeaders, 'Content-Type': 'application/json' } : authHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Action failed');
      await load();
      return true;
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not complete the action');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const markAttendance = (staffId: string, status: 'present' | 'absent') =>
    act(`att-${staffId}-${status}`, API.SECURITY_ATTENDANCE_MARK, 'POST', {
      staffId, status, action: status === 'present' ? 'check_in' : 'manual',
    });

  const logVisitor = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.purpose.trim()) {
      Alert.alert('Missing details', 'Name, phone and purpose are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API.SECURITY_VISITOR_CREATE, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim(), purpose: form.purpose.trim(),
          vehicleNumber: form.vehicleNumber.trim() || undefined,
          ...(form.flatId.trim() ? { flatId: form.flatId.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not log visitor');
      setShowLog(false);
      setForm({ name: '', phone: '', purpose: '', vehicleNumber: '', flatId: '' });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── derived ───────────────────────────────────────────────
  const atGate  = useMemo(() => visitors.filter(v => !v.entryTime && !v.exitTime), [visitors]);
  const inside  = useMemo(() => visitors.filter(v => v.entryTime && !v.exitTime), [visitors]);
  const present = staff.filter(s => s.marked === 'present').length;
  const unmarked = staff.filter(s => !s.marked).length;

  const filteredVisitors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.phone || '').includes(q) ||
      (v.vehicleNumber || '').toLowerCase().includes(q) ||
      (v.flatId?.flatNumber || v.flatNumber || '').toLowerCase().includes(q)
    );
  }, [search, visitors]);

  const guardName = String(user?.name || 'Guard').trim().split(/\s+/)[0];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {guardName}</Text>
          <Text style={styles.sub}>GATE / SECURITY DESK</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert('Log out', 'End your shift session?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
          ])}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {/* Live stats */}
        <View style={styles.statsRow}>
          <Stat label="AT GATE"  value={atGate.length}  color={COLORS.primary} />
          <Stat label="INSIDE"   value={inside.length}  color={GREEN} />
          <Stat label="STAFF IN" value={present}        color={GREEN} />
          <Stat label="ALERTS"   value={alerts.length}  color={alerts.length ? COLORS.primary : COLORS.slate[400]} />
        </View>

        {/* Primary action: scan a visitor's QR pass to grant entry */}
        <TouchableOpacity style={styles.scanCta} activeOpacity={0.9} onPress={() => router.push('/guard/scan')}>
          <View style={styles.scanIcon}><Ionicons name="qr-code" size={26} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanCtaTitle}>Scan Visitor Pass</Text>
            <Text style={styles.scanCtaSub}>Grant entry by scanning the QR</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
        </TouchableOpacity>

        {/* SOS alerts — highest priority */}
        {alerts.length > 0 && (
          <View style={styles.alertBlock}>
            <View style={styles.alertHead}>
              <Ionicons name="warning" size={18} color={COLORS.white} />
              <Text style={styles.alertHeadText}>EMERGENCY ALERTS ({alerts.length})</Text>
            </View>
            {alerts.map(a => {
              const who = typeof a.userId === 'object' ? a.userId : null;
              return (
                <View key={a._id} style={styles.alertCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertType}>{String(a.type || 'panic').toUpperCase()}</Text>
                    <Text style={styles.alertWho}>
                      {who?.name || 'Resident'}
                      {(a.flatId?.flatNumber || who?.flatNumber) ? ` · Flat ${a.flatId?.flatNumber || who?.flatNumber}` : ''}
                    </Text>
                    {who?.phone ? <Text style={styles.alertMeta}>{who.phone}</Text> : null}
                    {a.message ? <Text style={styles.alertMeta}>{a.message}</Text> : null}
                  </View>
                  <View style={{ gap: 6 }}>
                    {a.status === 'active' && (
                      <TouchableOpacity
                        style={[styles.smBtn, styles.smAmber]}
                        disabled={!!busy}
                        onPress={() => act(`ack-${a._id}`, API.SECURITY_ALERT_ACK(a._id), 'PATCH', { note: '' })}
                      >
                        <Text style={styles.smAmberText}>{busy === `ack-${a._id}` ? '…' : 'Acknowledge'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.smBtn, styles.smGreen]}
                      disabled={!!busy}
                      onPress={() => act(`res-${a._id}`, API.SECURITY_ALERT_RESOLVE(a._id))}
                    >
                      <Text style={styles.smGreenText}>{busy === `res-${a._id}` ? '…' : 'Resolve'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickAction icon="person-add" label="Log Visitor" onPress={() => setShowLog(true)} primary />
          <QuickAction icon="people" label="All Visitors" onPress={() => router.push('/security/visitors')} />
          <QuickAction icon="clipboard" label="Attendance" onPress={() => router.push('/security/attendance')} />
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={COLORS.slate[400]} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search visitor, phone, vehicle or flat"
            placeholderTextColor={COLORS.slate[400]}
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.slate[400]} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Visitors */}
        <Text style={styles.sectionTitle}>Today’s Visitors</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
        ) : filteredVisitors.length === 0 ? (
          <Empty icon="people-outline" text="No visitors logged yet today." />
        ) : (
          filteredVisitors.map(v => {
            const state = v.exitTime ? 'LEFT' : v.entryTime ? 'INSIDE' : 'AT GATE';
            const color = v.exitTime ? COLORS.slate[400] : v.entryTime ? GREEN : COLORS.primary;
            return (
              <View key={v._id} style={styles.vCard}>
                <View style={[styles.vAvatar, { backgroundColor: `${color}1A` }]}>
                  <Text style={[styles.vAvatarText, { color }]}>{v.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vName}>{v.name}</Text>
                  <Text style={styles.vMeta}>
                    {v.purpose || 'Visit'}{(v.flatId?.flatNumber || v.flatNumber) ? ` · Flat ${v.flatId?.flatNumber || v.flatNumber}` : ''}
                  </Text>
                  <Text style={styles.vSub}>
                    {v.phone ? `${v.phone}` : ''}{v.vehicleNumber ? ` · ${v.vehicleNumber}` : ''}
                  </Text>
                  <Text style={styles.vTimes}>In {fmt(v.entryTime)} · Out {fmt(v.exitTime)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[styles.statusPill, { backgroundColor: `${color}1A` }]}>
                    <Text style={[styles.statusPillText, { color }]}>{state}</Text>
                  </View>
                  {!v.entryTime && (
                    <TouchableOpacity
                      style={[styles.smBtn, styles.smGreen]}
                      disabled={!!busy}
                      onPress={() => act(`in-${v._id}`, API.SECURITY_VISITOR_ENTRY(v._id))}
                    >
                      <Text style={styles.smGreenText}>{busy === `in-${v._id}` ? '…' : 'Allow In'}</Text>
                    </TouchableOpacity>
                  )}
                  {v.entryTime && !v.exitTime && (
                    <TouchableOpacity
                      style={[styles.smBtn, styles.smGrey]}
                      disabled={!!busy}
                      onPress={() => act(`out-${v._id}`, API.SECURITY_VISITOR_EXIT(v._id))}
                    >
                      <Text style={styles.smGreyText}>{busy === `out-${v._id}` ? '…' : 'Mark Out'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Staff attendance */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Daily Staff</Text>
          {unmarked > 0 ? <Text style={styles.pendingChip}>{unmarked} pending</Text> : null}
        </View>
        {staff.length === 0 ? (
          <Empty icon="badge" text="No staff registered. Ask the secretary to add staff." />
        ) : (
          staff.map(s => (
            <View key={s._id} style={styles.sCard}>
              <View style={[styles.sIcon, { backgroundColor: s.marked === 'present' ? '#e6f4eb' : COLORS.slate[100] }]}>
                <Ionicons
                  name={s.role === 'maid' ? 'sparkles' : s.role === 'milkman' ? 'cube' : 'person'}
                  size={16}
                  color={s.marked === 'present' ? GREEN : COLORS.slate[500]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sName}>{s.name}</Text>
                <Text style={styles.sRole}>{s.role.toUpperCase()}</Text>
              </View>
              {s.marked ? (
                <View style={[styles.statusPill, { backgroundColor: s.marked === 'present' ? '#e6f4eb' : `${COLORS.primary}1A` }]}>
                  <Text style={[styles.statusPillText, { color: s.marked === 'present' ? GREEN : COLORS.primary }]}>
                    {s.marked.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={[styles.smBtn, styles.smGrey]} disabled={!!busy} onPress={() => markAttendance(s._id, 'absent')}>
                    <Text style={styles.smGreyText}>Absent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smBtn, styles.smGreen]} disabled={!!busy} onPress={() => markAttendance(s._id, 'present')}>
                    <Text style={styles.smGreenText}>Present</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Log visitor modal */}
      <Modal visible={showLog} transparent animationType="slide" onRequestClose={() => setShowLog(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Log Visitor</Text>
            <Text style={styles.sheetSub}>Recorded at the gate. The resident is notified for approval.</Text>

            <Field label="Visitor name *" value={form.name} onChange={(t: string) => setForm({ ...form, name: t })} />
            <Field label="Phone *" value={form.phone} onChange={(t: string) => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
            <Field label="Purpose *" value={form.purpose} onChange={(t: string) => setForm({ ...form, purpose: t })} placeholder="Delivery, guest, service…" />
            <Field label="Vehicle number" value={form.vehicleNumber} onChange={(t: string) => setForm({ ...form, vehicleNumber: t })} autoCapitalize="characters" />
            <Field label="Flat ID (optional)" value={form.flatId} onChange={(t: string) => setForm({ ...form, flatId: t })} />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.bigBtn, styles.bigGhost]} onPress={() => setShowLog(false)}>
                <Text style={styles.bigGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bigBtn, styles.bigPrimary, saving && { opacity: 0.6 }]} disabled={saving} onPress={logVisitor}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.bigPrimaryText}>Log Visitor</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── small components ────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, primary }: { icon: any; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity style={[styles.qa, primary && styles.qaPrimary]} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={20} color={primary ? COLORS.white : COLORS.primary} />
      <Text style={[styles.qaText, primary && { color: COLORS.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={COLORS.slate[400]} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function Field({ label, value, onChange, ...rest }: any) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor={COLORS.slate[400]}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: COLORS.primary, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  hello: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  sub: { fontSize: 10, fontWeight: '800', color: `${COLORS.white}CC`, letterSpacing: 1.6, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${COLORS.white}26`, alignItems: 'center', justifyContent: 'center' },

  scanCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.primary, borderRadius: 16, padding: 14, marginBottom: 14 },
  scanIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  scanCtaTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  scanCtaSub: { color: `${COLORS.white}CC`, fontSize: 11, fontWeight: '600', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 8.5, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 0.8, marginTop: 2 },

  alertBlock: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10 },
  alertHeadText: { color: COLORS.white, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${COLORS.primary}0D`, padding: 12, borderTopWidth: 1, borderTopColor: `${COLORS.primary}1A` },
  alertType: { fontSize: 12, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.6 },
  alertWho: { fontSize: 14, fontWeight: '800', color: COLORS.dark, marginTop: 1 },
  alertMeta: { fontSize: 11, color: COLORS.slate[500], marginTop: 1 },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  qa: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: `${COLORS.primary}22` },
  qaPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  qaText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200], marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.dark, marginBottom: 10, marginTop: 4 },
  pendingChip: { fontSize: 10, fontWeight: '800', color: COLORS.primary },

  vCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10 },
  vAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  vAvatarText: { fontSize: 16, fontWeight: '900' },
  vName: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  vMeta: { fontSize: 11, color: COLORS.slate[600], marginTop: 1 },
  vSub: { fontSize: 11, color: COLORS.slate[400], marginTop: 1 },
  vTimes: { fontSize: 10, color: COLORS.slate[400], marginTop: 3, fontWeight: '700' },

  sCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10 },
  sIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sName: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  sRole: { fontSize: 9.5, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 0.6, marginTop: 2 },

  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },

  smBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  smGreen: { backgroundColor: GREEN },
  smGreenText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  smAmber: { backgroundColor: AMBER },
  smAmberText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  smGrey: { backgroundColor: COLORS.slate[100] },
  smGreyText: { color: COLORS.slate[600], fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', padding: 28, gap: 8, backgroundColor: COLORS.white, borderRadius: 14 },
  emptyText: { fontSize: 12, color: COLORS.slate[400], textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '90%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.slate[300], marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  sheetSub: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: COLORS.slate[500], marginBottom: 5 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  bigBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  bigGhost: { backgroundColor: COLORS.slate[100] },
  bigGhostText: { fontSize: 15, fontWeight: '800', color: COLORS.slate[600] },
  bigPrimary: { backgroundColor: COLORS.primary },
  bigPrimaryText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});
