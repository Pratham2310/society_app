import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { shareContributionReceipt } from '../lib/receipt';

type Contributor = {
  _id: string; name: string; flatNumber?: string; avatar?: string;
  amount: number; status: string; receiptNo?: string; date?: string; isMine?: boolean;
};
type FundInfo = {
  _id: string; title: string; description?: string;
  goal: number; raised: number; progress: number; status?: string; fundType?: string;
};

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function FundDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [fund, setFund] = useState<FundInfo | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [pending, setPending] = useState<Contributor[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); return; }
    try {
      const res = await fetch(API.FUND_CONTRIBUTIONS_LIST(String(id)), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.data) throw new Error(json.message || 'Could not load this fund');
      const d = json.data;
      setFund(d.fund);
      setContributors(d.contributors || []);
      setPending(d.pending || []);
      setPendingTotal(Number(d.pendingTotal || 0));
      setCanManage(Boolean(d.canManage));
      setError(null);
    } catch (e: any) {
      const m = String(e?.message || '');
      setError(/failed to fetch|network|timed out/i.test(m)
        ? 'Couldn’t reach the server. Pull down to retry.'
        : m || 'Could not load this fund.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const verify = async (c: Contributor) => {
    if (!token) return;
    setBusy(c._id);
    try {
      const res = await fetch(API.CONTRIBUTION_VERIFY(c._id), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not verify');
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not verify the contribution.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/community-funds')} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Fund Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {fund ? (
          <>
            {/* Goal + progress */}
            <View style={styles.heroCard}>
              <Text style={styles.fundTitle}>{fund.title}</Text>
              {fund.description ? <Text style={styles.fundDesc}>{fund.description}</Text> : null}

              <View style={styles.amountRow}>
                <View>
                  <Text style={styles.raisedLabel}>RAISED</Text>
                  <Text style={styles.raisedValue}>{money(fund.raised)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.raisedLabel}>GOAL</Text>
                  <Text style={styles.goalValue}>{money(fund.goal)}</Text>
                </View>
              </View>

              <View style={styles.track}>
                <View style={[styles.fill, { width: `${fund.progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {fund.progress}% funded · {contributors.length} contributor{contributors.length === 1 ? '' : 's'}
              </Text>
            </View>

            {/* Manager-only: awaiting verification */}
            {canManage && pending.length > 0 ? (
              <View style={styles.pendingBlock}>
                <View style={styles.pendingHead}>
                  <Ionicons name="time" size={16} color={COLORS.primary} />
                  <Text style={styles.pendingTitle}>Awaiting verification ({pending.length})</Text>
                  <Text style={styles.pendingSum}>{money(pendingTotal)}</Text>
                </View>
                {pending.map((c) => (
                  <View key={c._id} style={styles.row}>
                    <Avatar c={c} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{c.name}{c.isMine ? ' (You)' : ''}</Text>
                      <Text style={styles.meta}>{c.flatNumber ? `Flat ${c.flatNumber} · ` : ''}{fmtDate(c.date)}</Text>
                    </View>
                    <Text style={styles.amountPending}>{money(c.amount)}</Text>
                    <TouchableOpacity style={styles.verifyBtn} disabled={!!busy} onPress={() => verify(c)}>
                      {busy === c._id ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.verifyText}>Verify</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Contributors — visible to every resident */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Contributors</Text>
              <Text style={styles.sectionCount}>{contributors.length}</Text>
            </View>

            {contributors.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={34} color={COLORS.slate[300]} />
                <Text style={styles.emptyText}>No contributions yet. Be the first!</Text>
              </View>
            ) : (
              contributors.map((c, i) => (
                <View key={c._id} style={[styles.row, styles.contribRow]}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <Avatar c={c} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{c.name}{c.isMine ? ' (You)' : ''}</Text>
                    <Text style={styles.meta}>{c.flatNumber ? `Flat ${c.flatNumber} · ` : ''}{fmtDate(c.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountPaid}>{money(c.amount)}</Text>
                    {c.isMine ? (
                      <TouchableOpacity onPress={() => shareContributionReceipt(c._id, token!)}>
                        <Text style={styles.receiptLink}>Receipt</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.contributeBtn} onPress={() => router.push('/contribute')}>
              <Ionicons name="heart" size={18} color={COLORS.white} />
              <Text style={styles.contributeText}>Contribute to this fund</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Avatar({ c }: { c: Contributor }) {
  if (c.avatar) return <Image source={{ uri: c.avatar }} style={styles.avatarImg} />;
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{String(c.name || 'R').trim()[0]?.toUpperCase() || 'R'}</Text>
    </View>
  );
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.dark },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdecec', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.red },

  heroCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, marginBottom: 18 },
  fundTitle: { fontSize: 22, fontWeight: '900', color: COLORS.dark },
  fundDesc: { fontSize: 13, color: COLORS.slate[500], marginTop: 6, lineHeight: 19 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 },
  raisedLabel: { fontSize: 9, fontWeight: '800', color: COLORS.slate[400], letterSpacing: 1 },
  raisedValue: { fontSize: 26, fontWeight: '900', color: COLORS.primary, marginTop: 2 },
  goalValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate[500], marginTop: 2 },
  track: { height: 10, borderRadius: 6, backgroundColor: COLORS.slate[100], overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  progressText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[500], marginTop: 8 },

  pendingBlock: { backgroundColor: `${COLORS.primary}0D`, borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: `${COLORS.primary}26`, gap: 10 },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primary },
  pendingSum: { fontSize: 13, fontWeight: '900', color: COLORS.primary },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.dark },
  sectionCount: { fontSize: 12, fontWeight: '800', color: COLORS.white, backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 14, padding: 12 },
  contribRow: { marginBottom: 8 },
  rank: { width: 18, fontSize: 12, fontWeight: '900', color: COLORS.slate[400] },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.slate[100] },
  avatarText: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  name: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  meta: { fontSize: 11, color: COLORS.slate[400], marginTop: 2 },
  amountPaid: { fontSize: 15, fontWeight: '900', color: '#1d7a3a' },
  amountPending: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  receiptLink: { fontSize: 11, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  verifyBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, minWidth: 62, alignItems: 'center' },
  verifyText: { fontSize: 12, fontWeight: '800', color: COLORS.white },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, backgroundColor: COLORS.white, borderRadius: 14 },
  emptyText: { fontSize: 13, color: COLORS.slate[400], fontWeight: '600' },

  contributeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, marginTop: 20 },
  contributeText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
