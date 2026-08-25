import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CandidatePicker, { PickerMember, loadCandidateMembers } from '../components/CandidatePicker';
import { useConfirm } from '../components/ConfirmDialog';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import {
  ElectionStatus, POST_COLOR, STATUS_META, postLabel, shortDate, timeLeft,
} from '../constants/elections';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Candidate = {
  _id: string;
  post: string;
  statement: string;
  name: string;
  flatNumber: string;
  userId: string;
};

type Result = { candidateId: string; name: string; flatNumber: string; votes: number };

type Detail = {
  _id: string;
  title: string;
  description?: string;
  posts: { post: string; seats: number }[];
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  myVotedPosts: string[];
  candidates: Candidate[];
  turnout: number;
  results?: Record<string, Result[]>;
};

export default function ElectionDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, refreshPermissions } = useAuth();
  const { can } = useRole();
  const { confirm, dialog } = useConfirm();

  const [election, setElection] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Candidate picker (secretary, before voting opens)
  const [picking, setPicking] = useState<string | null>(null);
  const [members, setMembers] = useState<PickerMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const manages = can(PERM.ELECTIONS_MANAGE);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); return; }
    setError(null);
    try {
      const json = await apiFetch(API.ELECTION(String(id)), {}, token);
      setElection(json.data);
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server. Reopen this screen to retry.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/elections' as any);

  // ── Voting ──────────────────────────────────────────────────────────────────

  const castVote = async (candidate: Candidate) => {
    setBusy(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(
        API.ELECTION_VOTE(String(id)),
        { method: 'POST', body: JSON.stringify({ post: candidate.post, candidateId: candidate._id }) },
        token || undefined,
      );
      setBanner(`Your vote for ${postLabel(candidate.post)} is in. It is stored without your name on it.`);
      await load();
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so no vote was cast.');
    } finally {
      setBusy(false);
    }
  };

  const confirmVote = (candidate: Candidate) =>
    confirm({
      title: `Vote for ${candidate.name}?`,
      message:
        `${candidate.name} for ${postLabel(candidate.post)}.\n\n` +
        'You get one vote for this post and it cannot be changed afterwards. ' +
        'Nobody can see who you voted for.',
      confirmLabel: 'Cast Vote',
      icon: 'checkbox-outline',
      onConfirm: () => castVote(candidate),
    });

  // ── Secretary actions ───────────────────────────────────────────────────────

  const openPicker = async (post: string) => {
    setPicking(post);
    if (members.length) return; // already loaded this visit
    setLoadingMembers(true);
    try {
      setMembers(await loadCandidateMembers(token || undefined));
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const addCandidate = async (member: PickerMember, statement: string) => {
    if (!picking) return;
    const post = picking;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(
        API.ELECTION_CANDIDATES(String(id)),
        { method: 'POST', body: JSON.stringify({ post, userId: member.id, statement }) },
        token || undefined,
      );
      setBanner(`${member.name} is standing for ${postLabel(post)}.`);
      setPicking(null);
      await load();
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so nothing changed.');
    } finally {
      setBusy(false);
    }
  };

  const removeCandidate = (c: Candidate) =>
    confirm({
      title: `Withdraw ${c.name}?`,
      message: `They will no longer be standing for ${postLabel(c.post)}.`,
      confirmLabel: 'Withdraw',
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await apiFetch(
            API.ELECTION_CANDIDATE(String(id), c._id),
            { method: 'DELETE' },
            token || undefined,
          );
          await load();
        } catch (e: any) {
          setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so nothing changed.');
        } finally {
          setBusy(false);
        }
      },
    });

  const countVotes = () =>
    confirm({
      title: 'Count the votes?',
      message:
        'The winners get their roles immediately, and anyone they replace steps down to Resident. ' +
        'This includes your own office if it was contested. It can only be done once.',
      confirmLabel: 'Count Votes',
      icon: 'trophy-outline',
      onConfirm: async () => {
        setBusy(true);
        setError(null);
        try {
          const json = await apiFetch(
            API.ELECTION_CLOSE(String(id)),
            { method: 'POST' },
            token || undefined,
          );
          const applied = json?.data?.applied || [];
          const tied = json?.data?.tied || [];
          setBanner(
            (applied.length
              ? `${applied.map((a: any) => `${a.name} — ${postLabel(a.post)}`).join(', ')}. Their access changes straight away.`
              : 'Counted. No post had a clear winner.') +
            (tied.length
              ? ` ${tied.map((t: any) => postLabel(t.post)).join(', ')} tied — settle that one at the meeting and set it under Committee Roles.`
              : '')
          );
          await load();
          // The secretary may have just voted themselves out of office.
          await refreshPermissions();
        } catch (e: any) {
          setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so nothing was counted.');
        } finally {
          setBusy(false);
        }
      },
    });

  const cancelElection = () =>
    confirm({
      title: 'Cancel this election?',
      message: 'Residents will no longer be able to vote and no result will be applied.',
      confirmLabel: 'Cancel Election',
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await apiFetch(API.ELECTION_CANCEL(String(id)), { method: 'PATCH' }, token || undefined);
          await load();
        } catch (e: any) {
          setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so nothing changed.');
        } finally {
          setBusy(false);
        }
      },
    });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!election) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="alert-circle-outline" size={38} color={COLORS.slate[400]} />
        <Text style={styles.deniedText}>{error || 'This election is no longer available.'}</Text>
        <Pressable style={styles.ghostBtn} onPress={goBack}>
          <Text style={styles.ghostBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const meta = STATUS_META[election.status] || STATUS_META.scheduled;
  const editable = election.status === 'scheduled';

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
            <Text style={styles.headerTitle}>Election</Text>
            <Text style={styles.headerSub}>{meta.label}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {banner ? (
          <Pressable style={styles.okBanner} onPress={() => setBanner(null)}>
            <Ionicons name="checkmark-circle" size={18} color="#1d7a3a" />
            <Text style={styles.okBannerText}>{banner}</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Pressable style={styles.errBanner} onPress={() => setError(null)}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errBannerText}>{error}</Text>
          </Pressable>
        ) : null}

        <View style={styles.hero}>
          <View style={[styles.statusPill, { backgroundColor: meta.bg, alignSelf: 'flex-start' }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.title}>{election.title}</Text>
          {election.description ? <Text style={styles.desc}>{election.description}</Text> : null}
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.slate[400]} />
            <Text style={styles.metaText}>
              {election.status === 'scheduled'
                ? `Voting opens ${shortDate(election.opensAt)} — in ${timeLeft(election.opensAt)}`
                : election.status === 'open'
                  ? `Voting closes ${shortDate(election.closesAt)} — in ${timeLeft(election.closesAt)}`
                  : `${shortDate(election.opensAt)} — ${shortDate(election.closesAt)}`}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.slate[400]} />
            <Text style={styles.metaText}>
              {election.turnout} {election.turnout === 1 ? 'ballot' : 'ballots'} cast so far
            </Text>
          </View>
        </View>

        {/* The one thing the secretary must do next, and the only window in
            which it can be done. */}
        {manages && editable && election.candidates.length === 0 ? (
          <View style={styles.todoCard}>
            <Ionicons name="person-add" size={19} color={COLORS.primary} />
            <Text style={styles.todoText}>
              Nobody is standing yet. Add a candidate under each post below — you can do this until
              voting opens on {shortDate(election.opensAt)}, after which the ballot is fixed.
            </Text>
          </View>
        ) : null}

        {election.posts.map(({ post, seats }) => {
          const color = POST_COLOR[post] || '#64748b';
          const standing = election.candidates.filter((c) => c.post === post);
          const voted = election.myVotedPosts.includes(post);
          const results = election.results?.[post];

          // Mirrors electionService.close exactly: the top `seats` win, unless
          // the runner-up ties the last winner — in which case the backend
          // applies nothing and leaves the post for a person to settle. The
          // badge has to agree with what actually happened to the roles.
          const boundary = results?.[seats - 1];
          const runnerUp = results?.[seats];
          const tiedAtBoundary =
            !!runnerUp && !!boundary && runnerUp.votes === boundary.votes && boundary.votes > 0;

          return (
            <View key={post} style={styles.postSection}>
              <View style={styles.postHead}>
                <View style={[styles.postDot, { backgroundColor: color }]} />
                <Text style={styles.postName}>{postLabel(post)}</Text>
                <Text style={styles.postSeats}>
                  {seats === 1 ? '1 seat' : `${seats} seats`}
                </Text>
              </View>

              {standing.length === 0 ? (
                <Text style={styles.noCandidates}>
                  {editable ? 'Nobody is standing yet.' : 'Nobody stood for this post.'}
                </Text>
              ) : (
                standing.map((c) => {
                  const rank = results?.findIndex((r) => String(r.candidateId) === String(c._id)) ?? -1;
                  const row = rank > -1 ? results![rank] : undefined;
                  const won =
                    election.status === 'completed' &&
                    !!row &&
                    row.votes > 0 &&
                    rank < seats &&
                    !tiedAtBoundary;

                  return (
                    <View key={c._id} style={[styles.candCard, won && styles.candWon]}>
                      <View style={styles.candAvatar}>
                        <Text style={styles.candInitial}>{c.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.candNameRow}>
                          <Text style={styles.candName}>{c.name}</Text>
                          {won ? (
                            <View style={styles.wonPill}>
                              <Ionicons name="trophy" size={10} color="#7a5b00" />
                              <Text style={styles.wonText}>ELECTED</Text>
                            </View>
                          ) : null}
                        </View>
                        {c.flatNumber ? <Text style={styles.candUnit}>Flat {c.flatNumber}</Text> : null}
                        {c.statement ? <Text style={styles.candStatement}>{c.statement}</Text> : null}
                        {row ? (
                          <Text style={styles.voteCount}>
                            {row.votes} {row.votes === 1 ? 'vote' : 'votes'}
                          </Text>
                        ) : null}
                      </View>

                      {election.status === 'open' && !voted ? (
                        <Pressable
                          style={[styles.voteBtn, { backgroundColor: color }]}
                          onPress={() => confirmVote(c)}
                          disabled={busy}
                        >
                          <Text style={styles.voteBtnText}>VOTE</Text>
                        </Pressable>
                      ) : null}

                      {editable && manages ? (
                        <Pressable
                          style={styles.removeBtn}
                          onPress={() => removeCandidate(c)}
                          disabled={busy}
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={20} color={COLORS.slate[400]} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}

              {tiedAtBoundary && (election.status === 'completed' || election.status === 'awaiting_count') ? (
                <View style={styles.tieNote}>
                  <Ionicons name="git-compare-outline" size={13} color="#b45309" />
                  <Text style={styles.tieNoteText}>
                    Tied on {boundary?.votes} votes — no winner was applied for this post. Settle it
                    at the meeting, then set it under Committee Roles.
                  </Text>
                </View>
              ) : null}

              {election.status === 'open' && voted ? (
                <View style={styles.votedNote}>
                  <Ionicons name="lock-closed" size={13} color="#1d7a3a" />
                  <Text style={styles.votedNoteText}>
                    You have voted for this post. Which way is not recorded against your name.
                  </Text>
                </View>
              ) : null}

              {editable && manages ? (
                <Pressable style={styles.addCandBtn} onPress={() => openPicker(post)}>
                  <Ionicons name="person-add-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.addCandText}>ADD A CANDIDATE</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {manages && election.status === 'awaiting_count' ? (
          <Pressable style={styles.primaryBtn} onPress={countVotes} disabled={busy}>
            {busy
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.primaryBtnText}>COUNT VOTES &amp; APPLY ROLES</Text>}
          </Pressable>
        ) : null}

        {manages && (election.status === 'scheduled' || election.status === 'open') ? (
          <Pressable style={styles.dangerBtn} onPress={cancelElection} disabled={busy}>
            <Text style={styles.dangerBtnText}>CANCEL ELECTION</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footnote}>
          {election.status === 'scheduled'
            ? 'Candidates can be added or withdrawn until voting opens. After that the ballot is fixed.'
            : election.status === 'open'
              ? 'Results stay hidden until voting closes, so nobody can see which way it is going and vote accordingly.'
              : 'Ballots carry no link to the resident who cast them, so the result can be counted without anyone learning how a neighbour voted.'}
        </Text>
      </ScrollView>

      <CandidatePicker
        visible={!!picking}
        postLabel={picking ? postLabel(picking) : ''}
        members={members}
        excludeIds={
          picking
            ? election.candidates.filter((c) => c.post === picking).map((c) => String(c.userId))
            : []
        }
        loading={loadingMembers}
        busy={busy}
        onCancel={() => setPicking(null)}
        onPick={addCandidate}
      />


      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  content: { paddingHorizontal: 20, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  headerSub: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.6, color: COLORS.slate[400], marginTop: 2 },

  okBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eaf6ee',
    borderWidth: 1, borderColor: '#c5e4d0', borderRadius: 12, padding: 12,
  },
  okBannerText: { flex: 1, fontSize: 12.5, color: '#1d7a3a', fontWeight: '600', lineHeight: 17 },
  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12,
  },
  errBannerText: { flex: 1, fontSize: 12.5, color: '#991B1B', fontWeight: '600', lineHeight: 17 },

  hero: { backgroundColor: COLORS.white, borderRadius: 14, padding: 15, gap: 7 },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.dark, lineHeight: 24 },
  desc: { fontSize: 13, color: COLORS.slate[600], lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 11.5, color: COLORS.slate[400] },

  postSection: { backgroundColor: COLORS.white, borderRadius: 14, padding: 13, gap: 9, marginTop: 4 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postDot: { width: 9, height: 9, borderRadius: 5 },
  postName: { flex: 1, fontSize: 14.5, fontWeight: '800', color: COLORS.dark },
  postSeats: { fontSize: 10.5, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 0.5 },

  noCandidates: { fontSize: 12, color: COLORS.slate[400], paddingVertical: 8, fontStyle: 'italic' },

  candCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: COLORS.background,
    borderRadius: 12, padding: 11, borderWidth: 1.5, borderColor: 'transparent',
  },
  candWon: { borderColor: '#e8c95a', backgroundColor: '#FFFBEB' },
  candAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.slate[100],
    alignItems: 'center', justifyContent: 'center',
  },
  candInitial: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  candNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  candName: { fontSize: 13.5, fontWeight: '700', color: COLORS.dark },
  candUnit: { fontSize: 11, color: COLORS.slate[400], marginTop: 1 },
  candStatement: { fontSize: 11.5, color: COLORS.slate[600], marginTop: 4, lineHeight: 16 },
  voteCount: { fontSize: 11.5, fontWeight: '800', color: COLORS.dark, marginTop: 5 },
  wonPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FDE68A',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  wonText: { fontSize: 8, fontWeight: '800', color: '#7a5b00', letterSpacing: 0.6 },

  voteBtn: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  voteBtnText: { color: COLORS.white, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  removeBtn: { padding: 2 },

  votedNote: {
    flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#eaf6ee',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  votedNoteText: { flex: 1, fontSize: 11, color: '#1d7a3a', fontWeight: '600', lineHeight: 15 },

  tieNote: {
    flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FEF3C7',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  tieNoteText: { flex: 1, fontSize: 11, color: '#7a5b00', fontWeight: '600', lineHeight: 15 },

  todoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${COLORS.primary}0D`,
    borderWidth: 1, borderColor: `${COLORS.primary}26`, borderRadius: 12, padding: 12,
  },
  todoText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 17 },

  addCandBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.2, borderColor: `${COLORS.primary}33`, borderStyle: 'dashed',
    borderRadius: 11, paddingVertical: 11,
  },
  addCandText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: COLORS.primary },

  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 14,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.2 },
  dangerBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8,
    borderWidth: 1.2, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  dangerBtnText: { color: '#991B1B', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1 },

  footnote: { fontSize: 11, color: COLORS.slate[400], lineHeight: 16, marginTop: 16, paddingHorizontal: 4 },
  deniedText: { fontSize: 14, color: COLORS.slate[600], textAlign: 'center', lineHeight: 20 },
  ghostBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.white },
  ghostBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: COLORS.slate[600] },

});
