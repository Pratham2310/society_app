import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import {
  ElectionStatus, POST_COLOR, STATUS_META, postLabel, shortDate, timeLeft,
} from '../constants/elections';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Election = {
  _id: string;
  title: string;
  description?: string;
  posts: { post: string; seats: number }[];
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  myVotedPosts: string[];
};

export default function ElectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      const json = await apiFetch(API.ELECTIONS, {}, token);
      setElections(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      // Never blank the list on a failed refresh — an empty screen reads as
      // "the elections were deleted", which is a far worse lie than a banner.
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server. Pull back and reopen to retry.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const manages = can(PERM.ELECTIONS_MANAGE);
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/(tabs)/members' as any);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={goBack}>
            <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Elections</Text>
            <Text style={styles.headerSub}>WHO RUNS THE SOCIETY</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {error ? (
          <Pressable style={styles.errBanner} onPress={() => setError(null)}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errBannerText}>{error}</Text>
          </Pressable>
        ) : null}

        {manages ? (
          <Pressable
            style={styles.newBtn}
            onPress={() => router.push('/election-create' as any)}
            android_ripple={{ color: '#ffffff22' }}
          >
            <Ionicons name="add-circle-outline" size={19} color={COLORS.white} />
            <Text style={styles.newBtnText}>SCHEDULE AN ELECTION</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 40 }} />
        ) : elections.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkbox-outline" size={40} color={COLORS.slate[300]} />
            <Text style={styles.emptyTitle}>No elections yet</Text>
            <Text style={styles.emptyText}>
              {manages
                ? 'When a committee term ends, schedule a vote here and every resident gets one secret ballot per post.'
                : 'When the secretary schedules a vote for a committee post, it will appear here for you to cast your ballot.'}
            </Text>
          </View>
        ) : (
          elections.map((e) => {
            const meta = STATUS_META[e.status] || STATUS_META.scheduled;
            const pending = e.posts.filter((p) => !e.myVotedPosts.includes(p.post));
            const needsMyVote = e.status === 'open' && pending.length > 0;

            return (
              <Pressable
                key={e._id}
                style={[styles.card, needsMyVote && styles.cardLive]}
                onPress={() => router.push({ pathname: '/election-details', params: { id: e._id } } as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{e.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.postRow}>
                  {e.posts.map((p) => (
                    <View
                      key={p.post}
                      style={[styles.postChip, { backgroundColor: `${POST_COLOR[p.post] || '#64748b'}14` }]}
                    >
                      <Text style={[styles.postChipText, { color: POST_COLOR[p.post] || '#64748b' }]}>
                        {postLabel(p.post)}{p.seats > 1 ? ` ×${p.seats}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.cardDates}>
                  {e.status === 'scheduled'
                    ? `Opens in ${timeLeft(e.opensAt)} · ${shortDate(e.opensAt)}`
                    : e.status === 'open'
                      ? `Closes in ${timeLeft(e.closesAt)} · ${shortDate(e.closesAt)}`
                      : `${shortDate(e.opensAt)} — ${shortDate(e.closesAt)}`}
                </Text>

                {e.status === 'open' ? (
                  needsMyVote ? (
                    <View style={styles.callout}>
                      <Ionicons name="hand-right" size={14} color={COLORS.primary} />
                      <Text style={styles.calloutText}>
                        Your vote is pending for {pending.map((p) => postLabel(p.post)).join(', ')}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.callout, styles.calloutDone]}>
                      <Ionicons name="checkmark-circle" size={14} color="#1d7a3a" />
                      <Text style={[styles.calloutText, { color: '#1d7a3a' }]}>
                        You have voted. Your choice stays private.
                      </Text>
                    </View>
                  )
                ) : null}
              </Pressable>
            );
          })
        )}

        <Text style={styles.footnote}>
          Every approved resident gets one vote per post. Ballots are stored without any link to
          the person who cast them, so nobody — not even the secretary — can see how you voted.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: COLORS.slate[400], marginTop: 2 },

  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12,
  },
  errBannerText: { flex: 1, fontSize: 12.5, color: '#991B1B', fontWeight: '600', lineHeight: 17 },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 4,
  },
  newBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },

  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, gap: 9 },
  cardLive: { borderWidth: 1.5, borderColor: `${COLORS.primary}44` },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.dark, lineHeight: 20 },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8 },

  postRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  postChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  postChipText: { fontSize: 10.5, fontWeight: '700' },

  cardDates: { fontSize: 11.5, color: COLORS.slate[400] },

  callout: {
    flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: `${COLORS.primary}0D`,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  calloutDone: { backgroundColor: '#eaf6ee' },
  calloutText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: COLORS.primary, lineHeight: 16 },

  empty: { alignItems: 'center', gap: 10, paddingVertical: 44, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.slate[600] },
  emptyText: { fontSize: 12.5, color: COLORS.slate[400], textAlign: 'center', lineHeight: 18 },

  footnote: { fontSize: 11, color: COLORS.slate[400], lineHeight: 16, marginTop: 16, paddingHorizontal: 4 },
});
