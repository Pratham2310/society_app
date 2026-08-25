import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

type Row = {
  id: string;
  name: string;
  unit: string;
  avatar: string;
  amount?: number;
  hasPaid: boolean;
};

const avatarFor = (seed: string, url?: string | null) =>
  url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

export default function ContributorsWallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  // Opened from an event, this wall shows only the people who paid for THAT
  // event. It used to show the society-wide donor list across every fund no
  // matter which event you opened it from.
  const params = useLocalSearchParams<{ eventId?: string; eventTitle?: string }>();
  const eventId = params.eventId ? String(params.eventId) : null;
  const eventTitle = params.eventTitle ? String(params.eventTitle) : '';

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [fee, setFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      if (eventId) {
        const json = await apiFetch(API.EVENT_CONTRIBUTORS(eventId), {}, token);
        const list = Array.isArray(json.data?.contributors) ? json.data.contributors : [];
        setFee(Number(json.data?.fee || 0));
        setRows(list.map((c: any) => ({
          id: String(c.userId),
          name: String(c.name || 'Resident'),
          unit: c.flatNumber ? `Flat ${c.flatNumber}` : '',
          avatar: avatarFor(String(c.name || c.userId), c.avatar),
          amount: Number(c.amount || 0),
          hasPaid: true,
        })));
      } else {
        // Society-wide wall: every member, marked with what they have given.
        const [usersJson, contribJson] = await Promise.all([
          apiFetch(API.ALL_USERS, {}, token),
          apiFetch(API.CONTRIBUTORS, {}, token).catch(() => ({ data: [] })),
        ]);
        // Join on user id, not on display name — two residents can share a name.
        const given = new Map<string, number>();
        (Array.isArray(contribJson.data) ? contribJson.data : []).forEach((c: any) => {
          if (c.userId) given.set(String(c.userId), Number(c.amount || 0));
        });
        const users = Array.isArray(usersJson.users) ? usersJson.users : [];
        setRows(users.map((u: any) => {
          const amount = given.get(String(u._id));
          return {
            id: String(u._id),
            name: String(u.name || 'Resident'),
            unit: u.flatNumber ? `Flat ${u.flatNumber}` : '',
            avatar: avatarFor(String(u.name || u._id), u.avatar),
            amount,
            hasPaid: amount !== undefined,
          };
        }));
      }
    } catch (e: any) {
      // Never fall back to invented names: an empty wall is the truth, a
      // fabricated one is not.
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server. Tap retry.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.unit.toLowerCase().includes(q));
  }, [search, rows]);

  const paidCount = rows.filter((r) => r.hasPaid).length;
  const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/finance' as any))}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{eventId ? 'Contributors' : 'Wall of Fame'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {eventId ? (
          <View style={styles.scopeCard}>
            <Text style={styles.scopeTitle}>{eventTitle || 'This event'}</Text>
            <Text style={styles.scopeMeta}>
              {paidCount} {paidCount === 1 ? 'person has' : 'people have'} contributed
              {total > 0 ? `  •  ₹${total.toLocaleString('en-IN')} collected` : ''}
              {fee > 0 ? `  •  ₹${fee.toLocaleString('en-IN')} each` : ''}
            </Text>
          </View>
        ) : null}

        {error ? (
          <TouchableOpacity style={styles.errBanner} onPress={load} activeOpacity={0.85}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errBannerText}>{error}</Text>
            <Text style={styles.errRetry}>RETRY</Text>
          </TouchableOpacity>
        ) : null}

        {rows.length > 0 ? (
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={eventId ? 'Search contributors' : 'Search member or unit'}
            placeholderTextColor={COLORS.slate[400]}
          />
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
        ) : rows.length === 0 && !error ? (
          <View style={styles.emptyBox}>
            <Ionicons name="trophy-outline" size={32} color={COLORS.slate[400]} />
            <Text style={styles.emptyTitle}>
              {eventId ? 'No contributions yet' : 'Nothing collected yet'}
            </Text>
            <Text style={styles.emptyText}>
              {eventId
                ? 'Residents who pay for this event will be listed here.'
                : 'Contributions to society funds will show up here.'}
            </Text>
          </View>
        ) : null}

        {filtered.map((row) => (
          <View key={row.id} style={styles.memberRow}>
            <View style={styles.memberInfo}>
              <Image source={{ uri: row.avatar }} style={styles.avatar} />
              <View>
                <Text style={styles.memberName}>{row.name}</Text>
                {row.unit ? <Text style={styles.memberSub}>{row.unit}</Text> : null}
              </View>
            </View>
            {row.hasPaid ? (
              <View style={styles.amountWrap}>
                <Text style={styles.amountText}>
                  {row.amount ? `₹${row.amount.toLocaleString('en-IN')}` : ''}
                </Text>
                <Text style={styles.verifiedText}>PAID</Text>
              </View>
            ) : (
              <Text style={styles.pendingText}>Not paid yet</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 20,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.dark },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  searchInput: { height: 46, borderRadius: 14, backgroundColor: COLORS.white, paddingHorizontal: 14, fontSize: 14, color: COLORS.dark, marginBottom: 16 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10,
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  memberName: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  memberSub: { marginTop: 1, fontSize: 11, color: COLORS.slate[400] },
  amountWrap: { alignItems: 'flex-end' },
  amountText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  verifiedText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, marginTop: 2, letterSpacing: 1 },
  pendingText: { fontSize: 11, color: '#d97706', fontWeight: '600' },

  scopeCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 14 },
  scopeTitle: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  scopeMeta: { fontSize: 12, color: COLORS.slate[500], marginTop: 4, lineHeight: 17 },
  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  errBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B' },
  errRetry: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.red },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.slate[600] },
  emptyText: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center', paddingHorizontal: 30, lineHeight: 18 },
});
