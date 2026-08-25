import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CandidatePicker, { PickerMember, loadCandidateMembers } from '../components/CandidatePicker';
import DatePickerField from '../components/DatePickerField';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { POSTS, POST_COLOR, dayEnd, dayStart, postLabel } from '../constants/elections';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Standing = { id: string; name: string; unit: string; statement: string };

/**
 * Schedule an election.
 *
 * Dates only, no times: a society runs a vote over whole days ("voting is open
 * from the 5th to the 8th"), so asking for a time would be precision nobody
 * uses. Voting opens at 00:00 on the first day and closes at 23:59 on the last.
 */
export default function ElectionCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [opensOn, setOpensOn] = useState('');
  const [closesOn, setClosesOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Who is standing, per post, before the election exists. Sent with it.
  const [standing, setStanding] = useState<Record<string, Standing[]>>({});
  const [members, setMembers] = useState<PickerMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadCandidateMembers(token || undefined)
      .then((list) => { if (alive) setMembers(list); })
      .catch(() => { if (alive) setMembers([]); })
      .finally(() => { if (alive) setLoadingMembers(false); });
    return () => { alive = false; };
  }, [token]);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/elections' as any);

  const togglePost = (key: string) =>
    setSeats((prev) => {
      const next = { ...prev };
      if (key in next) {
        delete next[key];
        // Dropping a post drops its candidates — leaving them would silently
        // send people standing for a post that is no longer contested.
        setStanding((s) => {
          const copy = { ...s };
          delete copy[key];
          return copy;
        });
      } else {
        next[key] = 1;
      }
      return next;
    });

  const addStanding = useCallback((post: string, m: PickerMember, statement: string) => {
    setStanding((prev) => ({
      ...prev,
      [post]: [...(prev[post] || []), { id: m.id, name: m.name, unit: m.unit, statement }],
    }));
    setPicking(null);
  }, []);

  const removeStanding = (post: string, id: string) =>
    setStanding((prev) => ({ ...prev, [post]: (prev[post] || []).filter((c) => c.id !== id) }));

  const bumpSeats = (key: string, by: number) =>
    setSeats((prev) => ({ ...prev, [key]: Math.min(15, Math.max(1, (prev[key] || 1) + by)) }));

  const chosen = Object.keys(seats);

  const submit = async () => {
    setError(null);
    if (title.trim().length < 3) return setError('Give the election a title residents will recognise.');
    if (chosen.length === 0) return setError('Pick at least one post to be contested.');
    if (!opensOn || !closesOn) return setError('Choose the day voting opens and the day it closes.');
    if (closesOn < opensOn) return setError('Voting cannot close before it opens.');

    setSaving(true);
    try {
      const json = await apiFetch(
        API.ELECTIONS,
        {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            posts: chosen.map((post) => ({ post, seats: seats[post] || 1 })),
            opensAt: dayStart(opensOn),
            closesAt: dayEnd(closesOn),
            candidates: chosen.flatMap((post) =>
              (standing[post] || []).map((c) => ({
                post,
                userId: c.id,
                statement: c.statement,
              }))
            ),
          }),
        },
        token || undefined,
      );

      // Straight into the ballot rather than back to the list: an election with
      // no candidates on it is useless, and this is the only window in which
      // they can be added.
      const newId = json?.data?._id;
      if (newId) {
        router.replace({ pathname: '/election-details', params: { id: String(newId) } } as any);
      } else {
        goBack();
      }
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so nothing was scheduled.');
    } finally {
      setSaving(false);
    }
  };

  if (!can(PERM.ELECTIONS_MANAGE)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="lock-closed" size={38} color={COLORS.slate[400]} />
        <Text style={styles.deniedText}>Only the secretary can schedule an election.</Text>
        <Pressable style={styles.ghostBtn} onPress={goBack}>
          <Text style={styles.ghostBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={goBack}>
            <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Schedule an Election</Text>
            <Text style={styles.headerSub}>PUT A POST TO A VOTE</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {error ? (
          <Pressable style={styles.errBanner} onPress={() => setError(null)}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errBannerText}>{error}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Annual Committee Election 2026"
          placeholderTextColor={COLORS.slate[400]}
          maxLength={120}
        />

        <Text style={styles.label}>Note to residents (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Why this vote is being held, how the new committee takes over, etc."
          placeholderTextColor={COLORS.slate[400]}
          multiline
          maxLength={1000}
        />

        <Text style={styles.label}>Posts being contested</Text>
        {POSTS.map((p) => {
          const on = p.key in seats;
          const color = POST_COLOR[p.key];
          const runners = standing[p.key] || [];

          return (
            <View
              key={p.key}
              style={[styles.postCard, on && { borderColor: color, backgroundColor: `${color}0A` }]}
            >
              <Pressable style={styles.postHeadRow} onPress={() => togglePost(p.key)}>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={on ? color : COLORS.slate[400]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.postLabel}>{p.label}</Text>
                  <Text style={styles.postBlurb}>{p.blurb}</Text>
                </View>

                {/* Only a committee has more than one seat — the three offices
                    are held by one person each, which the backend enforces too. */}
                {on && !p.single ? (
                  <View style={styles.seatBox}>
                    <Pressable style={styles.seatBtn} onPress={() => bumpSeats(p.key, -1)} hitSlop={6}>
                      <Ionicons name="remove" size={15} color={COLORS.dark} />
                    </Pressable>
                    <Text style={styles.seatCount}>{seats[p.key]}</Text>
                    <Pressable style={styles.seatBtn} onPress={() => bumpSeats(p.key, 1)} hitSlop={6}>
                      <Ionicons name="add" size={15} color={COLORS.dark} />
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>

              {/* Candidates for this post, chosen here rather than after the
                  election exists — a ballot with no names on it is not one. */}
              {on ? (
                <View style={styles.candBlock}>
                  {runners.map((c) => (
                    <View key={c.id} style={styles.candRow}>
                      <View style={[styles.candDot, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.candName}>
                          {c.name}{c.unit ? ` · ${c.unit}` : ''}
                        </Text>
                        {c.statement ? (
                          <Text style={styles.candStatement} numberOfLines={2}>{c.statement}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => removeStanding(p.key, c.id)} hitSlop={8}>
                        <Ionicons name="close-circle" size={19} color={COLORS.slate[400]} />
                      </Pressable>
                    </View>
                  ))}

                  <Pressable style={styles.addCandBtn} onPress={() => setPicking(p.key)}>
                    <Ionicons name="person-add-outline" size={15} color={color} />
                    <Text style={[styles.addCandText, { color }]}>
                      {runners.length ? 'ADD ANOTHER CANDIDATE' : 'ADD A CANDIDATE'}
                    </Text>
                  </Pressable>

                  {runners.length > 0 && runners.length <= (seats[p.key] || 1) ? (
                    <Text style={styles.candWarn}>
                      {runners.length === 1
                        ? 'Only one candidate — they would win unopposed.'
                        : `${runners.length} candidates for ${seats[p.key]} seats — all would win unopposed.`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        {chosen.some((k) => !POSTS.find((p) => p.key === k)?.single) ? (
          <Text style={styles.hint}>
            Seats decide how many candidates win that post — the top {seats.committee_member || 1} by
            votes take it.
          </Text>
        ) : null}

        <Text style={styles.label}>Voting opens on</Text>
        <DatePickerField
          value={opensOn}
          onChange={setOpensOn}
          placeholder="First day residents can vote"
          clearable={false}
        />

        <Text style={styles.label}>Voting closes on</Text>
        <DatePickerField
          value={closesOn}
          onChange={setClosesOn}
          placeholder="Last day residents can vote"
          minDate={opensOn ? new Date(dayStart(opensOn)) : undefined}
          clearable={false}
        />

        <Pressable
          style={[styles.submit, saving && { opacity: 0.6 }]}
          onPress={submit}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.submitText}>SCHEDULE ELECTION</Text>}
        </Pressable>

        <Text style={styles.footnote}>
          You can still add or withdraw candidates up until voting opens, after which the ballot is
          fixed so nobody votes on a shorter list than their neighbours. Every resident is sent a
          notice and a notification as soon as you schedule this. When voting closes and you count
          the votes, the winners get their roles straight away — including your own seat if it was
          contested.
        </Text>
      </ScrollView>

      <CandidatePicker
        visible={!!picking}
        postLabel={picking ? postLabel(picking) : ''}
        members={members}
        excludeIds={picking ? (standing[picking] || []).map((c) => c.id) : []}
        loading={loadingMembers}
        onCancel={() => setPicking(null)}
        onPick={(m, statement) => picking && addStanding(picking, m, statement)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  content: { paddingHorizontal: 20, gap: 8 },

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

  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.slate[600], marginTop: 12 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.dark,
  },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: COLORS.slate[400], lineHeight: 16, paddingHorizontal: 2 },

  postCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  postHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  postLabel: { fontSize: 13.5, fontWeight: '700', color: COLORS.dark },
  postBlurb: { fontSize: 11, color: COLORS.slate[400], marginTop: 2, lineHeight: 15 },
  seatBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.slate[100],
    borderRadius: 9, paddingHorizontal: 5, paddingVertical: 4,
  },
  seatBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  seatCount: { fontSize: 13, fontWeight: '800', color: COLORS.dark, minWidth: 14, textAlign: 'center' },

  candBlock: { marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: COLORS.slate[100], gap: 7 },
  candRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  candDot: { width: 7, height: 7, borderRadius: 4 },
  candName: { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  candStatement: { fontSize: 11, color: COLORS.slate[400], marginTop: 2, lineHeight: 15 },
  addCandBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.2, borderColor: COLORS.slate[200], borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 10, marginTop: 2,
  },
  addCandText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9 },
  candWarn: { fontSize: 10.5, color: '#b45309', lineHeight: 15, paddingHorizontal: 2 },

  submit: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 22,
  },
  submitText: { color: COLORS.white, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.2 },

  footnote: { fontSize: 11, color: COLORS.slate[400], lineHeight: 16, marginTop: 14, paddingHorizontal: 4 },
  deniedText: { fontSize: 14, color: COLORS.slate[600], textAlign: 'center', lineHeight: 20 },
  ghostBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.white },
  ghostBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: COLORS.slate[600] },
});
