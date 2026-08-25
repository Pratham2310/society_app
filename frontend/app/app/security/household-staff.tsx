import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../../components/ConfirmDialog';
import { API, apiFetch } from '../../constants/api';
import { sharePass } from '../../lib/sharePass';
import { useAuth } from '../../context/AuthContext';

const PRIMARY = '#922207';
const GREEN = '#1d7a3a';

const ROLES = [
  { key: 'maid',     label: 'Maid',     icon: 'cleaning-services' },
  { key: 'cook',     label: 'Cook',     icon: 'restaurant' },
  { key: 'milkman',  label: 'Milkman',  icon: 'local-shipping' },
  { key: 'gardener', label: 'Gardener', icon: 'yard' },
  { key: 'cleaner',  label: 'Cleaner',  icon: 'wash' },
  { key: 'other',    label: 'Other',    icon: 'work' },
] as const;

type Staff = {
  _id: string;
  name: string;
  role: string;
  phone: string;
  photo?: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  passExpiresAt?: string | null;
  entryTime?: string;
};

const iconFor = (role: string) =>
  (ROLES.find((r) => r.key === role)?.icon ?? 'work') as any;

export default function HouseholdStaffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>('maid');
  const [entryTime, setEntryTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // The gate pass of whichever person the resident opened.
  const [pass, setPass] = useState<{ id: string; qr: string; passCode: string; expiresAt?: string } | null>(null);
  const [passBusy, setPassBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      // The backend scopes this to the caller's own flat, so it is already
      // just this household's staff — never the guards or a neighbour's maid.
      const json = await apiFetch(API.SECURITY_STAFF, {}, token);
      setStaff(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(
        e?.status
          ? String(e.message)
          : 'Couldn’t reach the server. Pull down or reopen this screen to retry.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (name.trim().length < 2) { setFormError('Enter their full name'); return; }
    if (!/^[0-9]{10}$/.test(phone.trim())) { setFormError('Enter a 10-digit mobile number'); return; }
    setFormError(null);
    setSaving(true);
    try {
      await apiFetch(
        API.HOUSEHOLD_STAFF_ADD,
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            role,
            ...(entryTime.trim() ? { entryTime: entryTime.trim() } : {}),
          }),
        },
        token || undefined,
      );
      setName(''); setPhone(''); setRole('maid'); setEntryTime('');
      setAdding(false);
      setBanner('Sent to the secretary for approval. Their gate pass appears here once approved.');
      await load();
    } catch (e: any) {
      setFormError(
        e?.status ? String(e.message) : 'Couldn’t reach the server. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const openPass = async (s: Staff) => {
    if (pass?.id === s._id) { setPass(null); return; }
    setPassBusy(s._id);
    setError(null);
    try {
      const json = await apiFetch(API.STAFF_PASS(s._id), {}, token || undefined);
      setPass({ id: s._id, qr: json.data.qr, passCode: json.data.passCode, expiresAt: json.data.expiresAt });
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Could not load the gate pass.');
    } finally {
      setPassBusy(null);
    }
  };

  const remove = (s: Staff) =>
    confirm({
      title: `Remove ${s.name}?`,
      message: 'Their gate pass stops working. Attendance already recorded is kept.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await apiFetch(API.SECURITY_STAFF_DELETE(s._id), { method: 'DELETE' }, token || undefined);
          setBanner(`${s.name} removed.`);
          await load();
        } catch (e: any) {
          setError(String(e?.message || 'Could not remove them.'));
        }
      },
    });

  const doSharePass = async (member: Staff) => {
    if (!pass) return;
    const until = pass.expiresAt ? new Date(pass.expiresAt).toLocaleDateString() : '';
    const note = await sharePass({
      qr: pass.qr,
      passCode: pass.passCode,
      fileLabel: member.name,
      text:
        `${member.name}'s society gate pass\n` +
        `Pass code: ${pass.passCode}\n` +
        (until ? `Valid until: ${until}\n` : '') +
        `Show this at the gate each day.`,
    });
    if (note) setBanner(note);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>My Household Staff</Text>
            <Text style={styles.headerSub}>MAID • COOK • DAILY HELP</Text>
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

        {/* ── Add form ─────────────────────────────────────────── */}
        {!adding ? (
          <Pressable style={styles.addCta} onPress={() => setAdding(true)}>
            <View style={styles.addCtaIcon}><MaterialIcons name="person-add" size={24} color={PRIMARY} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addCtaTitle}>Add daily staff</Text>
              <Text style={styles.addCtaSub}>The secretary approves them, then they get a gate pass</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#c9c4c1" />
          </Pressable>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New household staff</Text>

            <Text style={styles.label}>Their name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sunita Devi"
              placeholderTextColor="#b4aca8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.cc}><Text style={styles.ccText}>+91</Text></View>
              <TextInput
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                placeholder="10-digit mobile number"
                placeholderTextColor="#b4aca8"
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
              />
            </View>

            <Text style={styles.label}>What do they do?</Text>
            <View style={styles.chipRow}>
              {ROLES.map((r) => (
                <Pressable
                  key={r.key}
                  style={[styles.chip, role === r.key && styles.chipActive]}
                  onPress={() => setRole(r.key)}
                >
                  <MaterialIcons name={r.icon as any} size={14} color={role === r.key ? '#fff' : '#5c534f'} />
                  <Text style={[styles.chipText, role === r.key && styles.chipTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Usual arrival time (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 8:30 AM"
              placeholderTextColor="#b4aca8"
              value={entryTime}
              onChangeText={setEntryTime}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <View style={styles.formActions}>
              <Pressable style={styles.ghostBtn} onPress={() => { setAdding(false); setFormError(null); }}>
                <Text style={styles.ghostBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>SEND FOR APPROVAL</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── List ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Registered with your home</Text>

        {loading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}><ActivityIndicator color={PRIMARY} /></View>
        ) : staff.length === 0 ? (
          <Text style={styles.emptyMini}>
            Nobody added yet. Add your maid, cook or any daily help so the guard can let them
            in without calling you each time.
          </Text>
        ) : (
          staff.map((s) => {
            const status = s.approvalStatus || 'approved';
            const color = status === 'approved' ? GREEN : status === 'pending' ? '#c98a00' : PRIMARY;
            return (
              <View key={s._id} style={styles.card}>
                <Pressable
                  style={styles.cardRow}
                  onPress={() => router.push({ pathname: '/security/staff-detail' as any, params: { id: s._id } })}
                >
                  <View style={styles.avatar}>
                    {s.photo
                      ? <Image source={{ uri: s.photo }} style={styles.avatarImg} />
                      : <MaterialIcons name={iconFor(s.role)} size={20} color={PRIMARY} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{s.name}</Text>
                    <Text style={styles.cardMeta}>
                      {String(s.role).toUpperCase()}
                      {s.entryTime ? `  •  ${s.entryTime}` : ''}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: `${color}1A` }]}>
                      <Text style={[styles.statusPillText, { color }]}>
                        {status === 'pending' ? 'AWAITING SECRETARY' : status.toUpperCase()}
                      </Text>
                    </View>
                    {status === 'rejected' && s.rejectionReason ? (
                      <Text style={styles.rejectReason}>{s.rejectionReason}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#c9c4c1" />
                </Pressable>

                <View style={styles.cardActions}>
                  {status === 'approved' ? (
                    <Pressable style={styles.actionBtn} onPress={() => openPass(s)} disabled={passBusy === s._id}>
                      {passBusy === s._id
                        ? <ActivityIndicator size="small" color={PRIMARY} />
                        : <MaterialIcons name="qr-code-2" size={16} color={PRIMARY} />}
                      <Text style={styles.actionBtnText}>
                        {pass?.id === s._id ? 'HIDE PASS' : 'GATE PASS'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.actionBtn} onPress={() => remove(s)}>
                    <MaterialIcons name="delete-outline" size={16} color={PRIMARY} />
                    <Text style={styles.actionBtnText}>REMOVE</Text>
                  </Pressable>
                </View>

                {pass?.id === s._id ? (
                  <View style={styles.passWrap}>
                    <Image source={{ uri: pass.qr }} style={styles.qr} resizeMode="contain" />
                    <Text style={styles.passLabel}>PASS CODE</Text>
                    <Text style={styles.passCode}>{pass.passCode}</Text>
                    {pass.expiresAt ? (
                      <Text style={styles.passExpiry}>
                        Valid until {new Date(pass.expiresAt).toLocaleDateString()}
                      </Text>
                    ) : null}
                    <Text style={styles.passHint}>
                      The guard scans this each day — the first scan records their arrival,
                      the second their exit.
                    </Text>
                    <Pressable style={styles.shareBtn} onPress={() => doSharePass(s)}>
                      <MaterialIcons name="share" size={16} color="#fff" />
                      <Text style={styles.shareBtnText}>SHARE</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
      {dialog}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
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

  addCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#ece7e5',
  },
  addCtaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${PRIMARY}12`, alignItems: 'center', justifyContent: 'center' },
  addCtaTitle: { fontSize: 15, fontWeight: '800', color: '#090C02' },
  addCtaSub: { fontSize: 11.5, color: '#a99e99', marginTop: 2 },

  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#ece7e5' },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#090C02', marginBottom: 4 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#5c534f', marginTop: 12 },
  input: {
    backgroundColor: '#faf8f7', borderRadius: 12, paddingHorizontal: 14, height: 50,
    fontSize: 15, color: '#090C02', borderWidth: 1, borderColor: '#ece7e5', marginTop: 6,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  cc: {
    height: 50, paddingHorizontal: 14, justifyContent: 'center',
    backgroundColor: '#faf8f7', borderRadius: 12, borderWidth: 1, borderColor: '#ece7e5',
  },
  ccText: { fontSize: 15, fontWeight: '800', color: '#090C02' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#faf8f7', borderWidth: 1, borderColor: '#ece7e5',
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: '700', color: '#5c534f' },
  chipTextActive: { color: '#fff' },
  formError: { fontSize: 12, color: PRIMARY, fontWeight: '700', marginTop: 10 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  ghostBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2efed' },
  ghostBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#5c534f' },
  primaryBtn: { flex: 2, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY },
  primaryBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#fff' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#090C02', marginTop: 18 },
  emptyMini: { fontSize: 12.5, color: '#a99e99', lineHeight: 18, paddingVertical: 8 },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ece7e5', overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${PRIMARY}12`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 44, height: 44 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#090C02' },
  cardMeta: { fontSize: 11, color: '#a99e99', marginTop: 1, letterSpacing: 0.4 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6 },
  statusPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  rejectReason: { fontSize: 11, color: PRIMARY, marginTop: 4 },

  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3efed' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: PRIMARY },

  passWrap: { alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#f3efed', gap: 4 },
  qr: { width: 190, height: 190 },
  passLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: '#a99e99', marginTop: 6 },
  passCode: { fontSize: 20, fontWeight: '800', color: '#090C02', letterSpacing: 3 },
  passExpiry: { fontSize: 12, color: '#8a7f7a' },
  passHint: { fontSize: 11, color: '#a99e99', textAlign: 'center', lineHeight: 16, marginTop: 6, paddingHorizontal: 10 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', height: 44, borderRadius: 12, backgroundColor: PRIMARY, marginTop: 12,
  },
  shareBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#fff' },
});
