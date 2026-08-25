import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { useAuth, useRole } from '../../context/AuthContext';

type Visitor = { id: string; name: string; status: string; photo?: string };
type StaffEntry = { id: string; name: string; role: string; subtitle: string };

const PRIMARY = '#922207';

const STATUS_LABEL: Record<string, string> = {
  safe: 'AT HOME',
  panic: 'EMERGENCY',
  dnd:  'DO NOT DISTURB',
  away: 'AWAY',
};

export default function SecurityHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  // Mirrors canManageSecurity on the backend — treasurers are NOT included.
  const { isSecretary, isChairman, isCommittee, isSuperAdmin } = useRole();
  const canManage = isSecretary || isChairman || isCommittee || isSuperAdmin;

  const [status, setStatus] = useState<string>('safe');
  const [instruction, setInstruction] = useState<string>('');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [staff, setStaff] = useState<StaffEntry[]>([]);
  // Whoever is actually on the gate right now, rather than a number baked
  // into the app that nobody answers.
  const [onDuty, setOnDuty] = useState<{ name: string; phone: string; since?: string }[]>([]);
  const [callError, setCallError] = useState<string | null>(null);

  // Pull live status + visitors/staff when backend is reachable.
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch(API.SECURITY_STATUS_ME, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data?.status) setStatus(String(j.data.status));
        // The backend derives a standing instruction from the status (and the
        // resident can override it), so stop showing a fixed line here.
        if (j?.data?.instruction) setInstruction(String(j.data.instruction));
      })
      .catch(() => {});

    fetch(API.SECURITY_VISITORS('today'), { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (Array.isArray(j?.data) && j.data.length) {
          setVisitors(j.data.slice(0, 6).map((v: any) => ({
            id: String(v._id),
            name: String(v.name || 'Visitor'),
            status: v.exitTime ? 'LEFT' : v.entryTime ? 'INSIDE' : 'AT GATE',
            photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(v._id))}`,
          })));
        }
      })
      .catch(() => {});

    fetch(API.SECURITY_STAFF, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setStaff(j.data.slice(0, 6).map((s: any) => ({
            id: String(s._id),
            name: `${s.name} (${s.role})`,
            role: String(s.role),
            subtitle: s.approvalStatus === 'pending'
              ? 'AWAITING APPROVAL'
              : s.isActive ? 'ACTIVE' : 'INACTIVE',
          })));
        }
      })
      .catch(() => {});

    fetch(API.SECURITY_ON_DUTY, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (Array.isArray(j?.data)) setOnDuty(j.data); })
      .catch(() => {});
  }, [token]);

  const statusLabel = STATUS_LABEL[status] || status.toUpperCase();
  const isPanic = status === 'panic';

  const guardOnDuty = onDuty[0];

  const callSecurityDesk = async () => {
    setCallError(null);
    if (!guardOnDuty) {
      setCallError(
        'No guard is checked in at the gate right now. Ask the secretary, or use the SOS button in an emergency.'
      );
      return;
    }
    const url = `tel:+91${String(guardOnDuty.phone).replace(/\D/g, '').slice(-10)}`;
    // Alert.alert is a no-op on the web build, so failures are shown inline.
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        setCallError(`Calling isn’t supported here. ${guardOnDuty.name}: ${guardOnDuty.phone}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      setCallError(`Could not start the call. ${guardOnDuty.name}: ${guardOnDuty.phone}`);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Security & Gate</Text>
            <Text style={styles.headerSub}>COMMAND CENTER</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push('/(tabs)/profile')}>
            {user?.avatar
              ? <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              : <MaterialIcons name="person" size={22} color="#8a7f7a" />}
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusDot, isPanic && { backgroundColor: PRIMARY }]} />
            <Text style={styles.statusLabel}>CURRENT STATUS: <Text style={styles.statusStrong}>{statusLabel}</Text></Text>
          </View>
          <Pressable style={styles.manageBtn} onPress={() => router.push('/security/security-status')}>
            <Text style={styles.manageBtnText}>MANAGE STATUS</Text>
          </Pressable>
        </View>

        <View style={styles.instructionCard}>
          <MaterialIcons name="shield" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.instructionTitle}>CURRENT INSTRUCTIONS</Text>
            <Text style={styles.instructionBody}>Status: {statusLabel}. "{instruction}"</Text>
          </View>
        </View>

        <Pressable style={styles.passCta} onPress={() => router.push('/security/new-pass' as any)}>
          <View style={styles.passCtaIcon}>
            <MaterialIcons name="qr-code-2" size={26} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.passCtaTitle}>Generate Visitor Pass</Text>
            <Text style={styles.passCtaSub}>Create a QR & send it to your guest for gate entry</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#c9c4c1" />
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Guest Visitors</Text>
          <Pressable onPress={() => router.push('/security/visitors' as any)}>
            <Text style={styles.sectionMeta}>{visitors.length} ACTIVE  ›</Text>
          </Pressable>
        </View>
        {visitors.length === 0 ? (
          <Text style={styles.emptyMini}>No active visitors. Tap “Generate Visitor Pass” to invite one.</Text>
        ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
          {visitors.map((v) => (
            <Pressable key={v.id} style={styles.visitorCard} onPress={() => router.push({ pathname: '/security/visitor-detail' as any, params: { id: v.id } })}>
              <Image source={{ uri: v.photo }} style={styles.visitorImg} />
              <Text style={styles.visitorName}>{v.name}</Text>
              <View style={styles.visitorBadge}>
                <Text style={styles.visitorBadgeText}>{v.status}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        )}

        <Pressable style={styles.passCta} onPress={() => router.push('/security/household-staff' as any)}>
          <View style={styles.passCtaIcon}>
            <MaterialIcons name="cleaning-services" size={26} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.passCtaTitle}>My Household Staff</Text>
            <Text style={styles.passCtaSub}>Add your maid or cook and get them a monthly gate pass</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#c9c4c1" />
        </Pressable>

        {canManage ? (
          <>
            <Pressable style={styles.passCta} onPress={() => router.push('/security/staff-approvals' as any)}>
              <View style={styles.passCtaIcon}>
                <MaterialIcons name="fact-check" size={26} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passCtaTitle}>Staff Approvals</Text>
                <Text style={styles.passCtaSub}>Approve residents’ household help and issue their pass</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#c9c4c1" />
            </Pressable>

            <Pressable style={styles.passCta} onPress={() => router.push('/security/add-guard' as any)}>
              <View style={styles.passCtaIcon}>
                <MaterialIcons name="add-moderator" size={26} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passCtaTitle}>Register a Security Guard</Text>
                <Text style={styles.passCtaSub}>Creates their app login so they can work the gate</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#c9c4c1" />
            </Pressable>
          </>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            {canManage ? 'Daily Staff' : 'Staff In My Home'}
          </Text>
          <Pressable onPress={() => router.push('/security/attendance' as any)} style={{ marginTop: 20 }}>
            <Text style={styles.sectionMeta}>ATTENDANCE  ›</Text>
          </Pressable>
        </View>
        {staff.length === 0 ? (
          <Text style={styles.emptyMini}>No staff added yet.</Text>
        ) : (
        <View style={styles.staffCard}>
          {staff.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: '/security/staff-detail' as any, params: { id: s.id } })}
              style={[styles.staffRow, i < staff.length - 1 && styles.staffRowDivider]}
            >
              <View style={styles.staffIcon}>
                <MaterialIcons
                  name={s.role === 'maid' ? 'cleaning-services' : s.role === 'milkman' ? 'local-shipping' : 'work'}
                  size={18}
                  color="#1d7a3a"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName}>{s.name}</Text>
                <Text style={styles.staffSubtitle}>{s.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#aaa" />
            </Pressable>
          ))}
        </View>
        )}

        {callError ? (
          <Pressable style={styles.callErr} onPress={() => setCallError(null)}>
            <MaterialIcons name="error-outline" size={18} color={PRIMARY} />
            <Text style={styles.callErrText}>{callError}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.callDeskBtn, !guardOnDuty && styles.callDeskBtnIdle]}
          onPress={callSecurityDesk}
        >
          <MaterialIcons name="call" size={20} color="#fff" />
          <Text style={styles.callDeskText}>
            {guardOnDuty ? `Call ${guardOnDuty.name}` : 'Call Security Desk'}
          </Text>
        </Pressable>
        <Text style={styles.callDeskHint}>
          {guardOnDuty
            ? `ON DUTY${guardOnDuty.since ? ` SINCE ${new Date(guardOnDuty.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
            : 'NO GUARD CHECKED IN AT THE GATE'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#090C02' },
  headerSub: { fontSize: 9, color: '#717171', fontWeight: '700', letterSpacing: 1.4 },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: PRIMARY },
  avatarImg: { width: '100%', height: '100%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d7a3a' },
  statusLabel: { fontSize: 11, fontWeight: '600', color: '#717171', letterSpacing: 0.8 },
  statusStrong: { color: '#090C02', fontWeight: '800' },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d5d2cf', backgroundColor: '#fff' },
  manageBtnText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  passCta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: `${PRIMARY}22` },
  passCtaIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: `${PRIMARY}12`, alignItems: 'center', justifyContent: 'center' },
  passCtaTitle: { fontSize: 15, fontWeight: '800', color: '#090C02' },
  passCtaSub: { fontSize: 11, color: '#717171', marginTop: 2, lineHeight: 15 },
  instructionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, backgroundColor: PRIMARY },
  instructionTitle: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.4, marginBottom: 4 },
  instructionBody: { fontSize: 13, color: '#fff', lineHeight: 18, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },
  sectionMeta: { fontSize: 10, fontWeight: '800', color: PRIMARY, letterSpacing: 1 },
  emptyMini: { fontSize: 12, color: '#9a9a9a', fontWeight: '600', backgroundColor: '#fff', borderRadius: 14, padding: 16, textAlign: 'center', lineHeight: 17 },
  visitorCard: { width: 120, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: '#fff', gap: 8 },
  visitorImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eee' },
  visitorName: { fontSize: 13, fontWeight: '700', color: '#090C02' },
  visitorBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: PRIMARY },
  visitorBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
  staffCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14 },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  staffRowDivider: { borderBottomWidth: 1, borderBottomColor: '#f1ece9' },
  staffIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e6f4eb', alignItems: 'center', justifyContent: 'center' },
  staffName: { fontSize: 14, fontWeight: '700', color: '#090C02' },
  staffSubtitle: { fontSize: 10, color: '#1d7a3a', fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  callDeskBtn: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, backgroundColor: PRIMARY },
  callDeskText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
  callDeskBtnIdle: { backgroundColor: '#8a7f7a' },
  callErr: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fdeceb', borderWidth: 1, borderColor: '#f5c6c2',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8,
  },
  callErrText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#8a2318', lineHeight: 17 },
  callDeskHint: { textAlign: 'center', marginTop: 6, fontSize: 11, color: '#717171', fontWeight: '700' },
});
