import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../../components/ConfirmDialog';
import { API } from '../../constants/api';
import { sharePass } from '../../lib/sharePass';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/AuthContext';

const PRIMARY = '#A72608';
const GREEN = '#1d7a3a';

type Visitor = {
  _id: string;
  name: string;
  phone?: string;
  purpose?: string;
  visitorType?: string;
  vehicleNumber?: string;
  entryTime?: string | null;
  exitTime?: string | null;
  approved?: boolean;
  passCode?: string;
  flatId?: { flatNumber?: string };
  flatNumber?: string;
  // Set by the backend for this viewer — the QR is a working key to the gate,
  // so only the household that invited the guest may see it.
  canViewPass?: boolean;
  canDelete?: boolean;
};

type Pass = { qr: string; passCode: string; expiresAt?: string };

const state = (v: Visitor) => (v.exitTime ? 'LEFT' : v.entryTime ? 'INSIDE' : 'AT GATE');
const fmt = (t?: string | null) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

export default function VisitorDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { isGateStaff } = useRole();

  const { confirm, dialog } = useConfirm();

  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Alert.alert is a no-op on the web build, so failures are shown inline.
  const [error, setError] = useState<string | null>(null);

  const [pass, setPass] = useState<Pass | null>(null);
  const [loadingPass, setLoadingPass] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); setNotFound(true); return; }
    try {
      const res = await fetch(API.SECURITY_VISITOR_BY_ID(String(id)), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !json.data) { setNotFound(true); return; }
      setVisitor(json.data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const call = async (key: string, url: string, method = 'PATCH', body?: any) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Action failed (${res.status})`);
      if (method === 'DELETE') {
        router.canGoBack() ? router.back() : router.replace('/security/visitors' as any);
        return;
      }
      await load();
    } catch (e: any) {
      setError(
        /network request failed|failed to fetch/i.test(String(e?.message))
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : String(e?.message || 'Action failed')
      );
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () =>
    confirm({
      title: 'Remove visitor',
      message: 'This deletes the visitor record and its gate pass. It cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => call('del', API.SECURITY_VISITOR_DELETE(String(id)), 'DELETE'),
    });

  // The QR is fetched on demand rather than with the visitor, so it is only
  // ever sent to someone who asked for it and is allowed to have it.
  const showPass = async () => {
    if (pass) { setPass(null); return; }   // tapping again hides it
    setLoadingPass(true);
    setError(null);
    try {
      const res = await fetch(API.SECURITY_VISITOR_PASS(String(id)), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not load the pass');
      setPass({ qr: json.data.qr, passCode: json.data.passCode, expiresAt: json.data.expiresAt });
    } catch (e: any) {
      setError(String(e?.message || 'Could not load the pass'));
    } finally {
      setLoadingPass(false);
    }
  };

  const doSharePass = async () => {
    if (!pass || !visitor) return;
    const until = pass.expiresAt ? new Date(pass.expiresAt).toLocaleString() : '';
    const note = await sharePass({
      qr: pass.qr,
      passCode: pass.passCode,
      fileLabel: visitor.name,
      text:
        `Gate pass for ${visitor.name}\n` +
        `Pass code: ${pass.passCode}\n` +
        (until ? `Valid until: ${until}\n` : '') +
        `Show this QR at the gate.`,
    });
    if (note) setError(note);
  };

  if (loading) {
    return <View style={[styles.screen, styles.center]}><ActivityIndicator color={PRIMARY} /></View>;
  }
  if (notFound || !visitor) {
    return (
      <View style={[styles.screen, styles.center, { padding: 30 }]}>
        <MaterialIcons name="person-off" size={40} color="#bbb" />
        <Text style={styles.nfTitle}>Visitor not found</Text>
        <Text style={styles.nfText}>This record may have been removed.</Text>
        <Pressable style={styles.nfBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security/visitors' as any))}><Text style={styles.nfBtnText}>Go back</Text></Pressable>
      </View>
    );
  }

  const st = state(visitor);
  const stColor = st === 'INSIDE' ? GREEN : st === 'LEFT' ? '#7a7a7a' : PRIMARY;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security/visitors' as any))}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <Text style={styles.protocol}>Visitor Details</Text>
          {visitor.canDelete !== false ? (
            <Pressable style={styles.backBtn} onPress={confirmDelete} disabled={busy === 'del'}>
              {busy === 'del'
                ? <ActivityIndicator size="small" color={PRIMARY} />
                : <MaterialIcons name="delete-outline" size={20} color={PRIMARY} />}
            </Pressable>
          ) : <View style={styles.backBtn} />}
        </View>

        {error ? (
          <Pressable style={styles.errorBanner} onPress={() => setError(null)}>
            <MaterialIcons name="error-outline" size={18} color={PRIMARY} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <MaterialIcons name="close" size={16} color="#a99e99" />
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{visitor.name}</Text>
              <View style={styles.typePill}><Text style={styles.typePillText}>{(visitor.visitorType || 'guest').toUpperCase()}</Text></View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${stColor}1A` }]}>
              <Text style={[styles.statusText, { color: stColor }]}>{st}</Text>
            </View>
          </View>

          <View style={styles.infoItem}><MaterialIcons name="info-outline" size={18} color="#717171" /><Text style={styles.infoValue}>{visitor.purpose || 'Visit'}</Text></View>
          {(visitor.flatId?.flatNumber || visitor.flatNumber) ? (
            <View style={styles.infoItem}><MaterialIcons name="home" size={18} color="#717171" /><Text style={styles.infoValue}>Flat {visitor.flatId?.flatNumber || visitor.flatNumber}</Text></View>
          ) : null}
          {visitor.phone ? (
            <View style={styles.infoItem}><MaterialIcons name="call" size={18} color="#717171" /><Text style={styles.infoValue}>{visitor.phone}</Text></View>
          ) : null}
          {visitor.vehicleNumber ? (
            <View style={styles.infoItem}><MaterialIcons name="directions-car" size={18} color="#717171" /><Text style={styles.infoValue}>{visitor.vehicleNumber}</Text></View>
          ) : null}
          <View style={styles.infoItem}>
            <MaterialIcons name="schedule" size={18} color="#717171" />
            <Text style={styles.infoValue}>In {fmt(visitor.entryTime)}  •  Out {fmt(visitor.exitTime)}</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name={visitor.approved ? 'verified-user' : 'hourglass-empty'} size={18} color={visitor.approved ? GREEN : '#c98a00'} />
            <Text style={[styles.infoValue, { color: visitor.approved ? GREEN : '#c98a00' }]}>{visitor.approved ? 'Approved' : 'Awaiting approval'}</Text>
          </View>
        </View>

        {/* The gate pass. Only the household that invited the guest may open
            the QR — this link used to send everyone to the "create a new pass"
            screen instead, so an issued pass could never be found again. */}
        {visitor.passCode && visitor.canViewPass ? (
          <>
            <Pressable style={styles.qrLink} onPress={showPass} disabled={loadingPass}>
              <MaterialIcons name="qr-code-2" size={20} color={PRIMARY} />
              <Text style={styles.qrLinkText}>
                {pass ? 'Hide gate pass' : 'Show gate pass QR'}
              </Text>
              {loadingPass
                ? <ActivityIndicator size="small" color={PRIMARY} />
                : <MaterialIcons name={pass ? 'expand-less' : 'expand-more'} size={20} color={PRIMARY} />}
            </Pressable>

            {pass ? (
              <View style={styles.passCard}>
                <View style={styles.qrWrap}>
                  <Image source={{ uri: pass.qr }} style={styles.qr} resizeMode="contain" />
                </View>
                <Text style={styles.passCodeLabel}>PASS CODE</Text>
                <Text style={styles.passCode}>{pass.passCode}</Text>
                {pass.expiresAt ? (
                  <Text style={styles.passExpiry}>
                    Valid until {new Date(pass.expiresAt).toLocaleString()}
                  </Text>
                ) : null}
                <Pressable style={styles.shareBtn} onPress={doSharePass}>
                  <MaterialIcons name="share" size={18} color="#fff" />
                  <Text style={styles.shareBtnText}>SHARE WITH GUEST</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : visitor.passCode ? (
          <View style={styles.qrLocked}>
            <MaterialIcons name="lock-outline" size={18} color="#8a7f7a" />
            <Text style={styles.qrLockedText}>
              This guest has a gate pass. Only the resident who invited them can open its QR.
            </Text>
          </View>
        ) : null}

        {/* ── Actions ─────────────────────────────────────── */}
        {isGateStaff ? (
          // Guard / admin: physical entry & exit
          <>
            {!visitor.entryTime && (
              <Pressable style={styles.primaryBtn} disabled={!!busy} onPress={() => call('in', API.SECURITY_VISITOR_ENTRY(visitor._id))}>
                {busy === 'in' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Allow Entry</Text>}
              </Pressable>
            )}
            {visitor.entryTime && !visitor.exitTime && (
              <Pressable style={[styles.primaryBtn, { backgroundColor: '#090C02' }]} disabled={!!busy} onPress={() => call('out', API.SECURITY_VISITOR_EXIT(visitor._id))}>
                {busy === 'out' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Mark Exit</Text>}
              </Pressable>
            )}
            {visitor.exitTime && <Text style={styles.doneNote}>This visit is complete.</Text>}
          </>
        ) : (
          // Resident: approve or reject the visit request
          <>
            {!visitor.approved && (
              <Pressable style={styles.primaryBtn} disabled={!!busy} onPress={() => call('approve', API.SECURITY_VISITOR_APPROVE(visitor._id), 'PATCH', { approved: true })}>
                {busy === 'approve' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Approve Entry</Text>}
              </Pressable>
            )}
            <Pressable style={styles.rejectBtn} disabled={!!busy} onPress={() => call('reject', API.SECURITY_VISITOR_APPROVE(visitor._id), 'PATCH', { approved: false })}>
              {busy === 'reject' ? <ActivityIndicator color="#090C02" /> : <Text style={styles.rejectText}>{visitor.approved ? 'Revoke Approval' : 'Reject'}</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  protocol: { fontSize: 12, color: '#717171', fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  card: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 26, fontWeight: '800', color: '#090C02' },
  typePill: { marginTop: 6, borderRadius: 999, backgroundColor: '#090C02', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4 },
  typePillText: { color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  infoItem: { backgroundColor: '#f8f6f5', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoValue: { fontSize: 14, color: '#090C02', fontWeight: '700', flex: 1 },

  qrLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${PRIMARY}12`, borderRadius: 14, paddingVertical: 12 },
  qrLinkText: { color: PRIMARY, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  qrLocked: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f2efed', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  qrLockedText: { flex: 1, fontSize: 12, color: '#8a7f7a', lineHeight: 17 },

  passCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 6 },
  qrWrap: { padding: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0ece9' },
  qr: { width: 210, height: 210 },
  passCodeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#a99e99', marginTop: 8 },
  passCode: { fontSize: 22, fontWeight: '800', color: '#090C02', letterSpacing: 3 },
  passExpiry: { fontSize: 12, color: '#8a7f7a' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', height: 48, borderRadius: 12, backgroundColor: PRIMARY, marginTop: 10,
  },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fdeceb', borderWidth: 1, borderColor: '#f5c6c2',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#8a2318', lineHeight: 18 },

  primaryBtn: { borderRadius: 16, backgroundColor: PRIMARY, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  rejectBtn: { borderRadius: 16, borderWidth: 2, borderColor: '#090C02', paddingVertical: 15, alignItems: 'center' },
  rejectText: { color: '#090C02', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  doneNote: { textAlign: 'center', color: '#7a7a7a', fontSize: 13, fontWeight: '600', paddingVertical: 8 },

  nfTitle: { fontSize: 18, fontWeight: '800', color: '#090C02', marginTop: 10 },
  nfText: { fontSize: 13, color: '#999', marginTop: 4 },
  nfBtn: { marginTop: 16, backgroundColor: PRIMARY, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 12 },
  nfBtnText: { color: '#fff', fontWeight: '800' },
});
