import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../components/ConfirmDialog';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Member = {
  id: string;
  name: string;
  unit: string;
  role: string;
  avatar?: string | null;
  status: string;
};

/**
 * What each office actually carries. Shown to the secretary at the moment of
 * appointing, because "committee member" means nothing without it.
 */
const OFFICES = [
  {
    key: 'chairman',
    label: 'Chairman',
    single: true,
    blurb: 'Oversees everything, money included. Cannot appoint office bearers.',
  },
  {
    key: 'secretary',
    label: 'Secretary',
    single: true,
    blurb: 'Full authority, including appointing others. Hands over your own office.',
  },
  {
    key: 'treasurer',
    label: 'Treasurer',
    single: true,
    blurb: 'Maintenance, expenses, funds, payment details. No gate or membership access.',
  },
  {
    key: 'committee_member',
    label: 'Committee Member',
    single: false,
    blurb: 'Amenities, parking, complaints, events, gate staff. No access to the books.',
  },
  {
    key: 'member',
    label: 'Resident',
    single: false,
    blurb: 'No society-wide authority — their own flat, vehicles and visitors only.',
  },
] as const;

const officeFor = (role: string) => OFFICES.find((o) => o.key === role);
const labelFor = (role: string) => officeFor(role)?.label ?? 'Resident';

const COLOR_FOR: Record<string, string> = {
  chairman: '#6d28d9',
  secretary: '#922207',
  treasurer: '#1d7a3a',
  committee_member: '#b45309',
  member: '#64748b',
};

export default function ManageRolesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user, refreshPermissions } = useAuth();
  const { can } = useRole();
  const { confirm, dialog } = useConfirm();

  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      const json = await apiFetch(API.ALL_USERS, {}, token);
      const list = Array.isArray(json.users) ? json.users : [];
      setMembers(list.map((u: any) => ({
        id: String(u._id),
        name: String(u.name || 'Resident'),
        unit: u.flatNumber ? String(u.flatNumber) : '',
        role: String(u.societyrole || 'member'),
        avatar: u.avatar || null,
        status: String(u.status || 'approved'),
      })));
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server. Reopen this screen to retry.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assign = async (member: Member, role: string) => {
    setBusy(member.id);
    setError(null);
    setBanner(null);
    try {
      const json = await apiFetch(
        API.UPDATE_MEMBER_ROLE(member.id),
        { method: 'PUT', body: JSON.stringify({ role }) },
        token || undefined,
      );
      const replaced = json?.data?.replacedHolder;
      setBanner(
        `${member.name} is now ${labelFor(role)}.` +
        (replaced ? ` ${replaced.name} was stepped down to Resident.` : '') +
        ' Their access changes straight away — no need to sign out.'
      );
      setExpanded(null);
      await load();
      // Authority is read from the account on every request, so this takes
      // effect at once for them. Refresh our own so the screen reflects it if
      // the secretary just handed their office over.
      await refreshPermissions();
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server, so nothing changed.');
    } finally {
      setBusy(null);
    }
  };

  const confirmAssign = (member: Member, role: string) => {
    const office = officeFor(role);
    const sitting = office?.single
      ? members.find((m) => m.role === role && m.id !== member.id)
      : undefined;

    confirm({
      title: `Make ${member.name} ${labelFor(role)}?`,
      message:
        (office?.blurb || '') +
        (sitting ? `\n\n${sitting.name} is currently ${labelFor(role)} and will become a Resident.` : '') +
        (role === 'secretary' ? '\n\nYou will lose your own secretary access.' : ''),
      confirmLabel: 'Assign',
      destructive: role === 'secretary' || Boolean(sitting),
      onConfirm: () => assign(member, role),
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? members.filter((m) => m.name.toLowerCase().includes(q) || m.unit.toLowerCase().includes(q))
      : members;
    // Office bearers first, then everyone else by name.
    const rank = (r: string) => OFFICES.findIndex((o) => o.key === r);
    return [...rows].sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name));
  }, [members, search]);

  if (!can(PERM.MEMBERS_ROLES)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="lock-closed" size={38} color={COLORS.slate[400]} />
        <Text style={styles.deniedText}>Only the secretary can change a member’s role.</Text>
        <Pressable style={styles.ghostBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/members' as any))}>
          <Text style={styles.ghostBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/members' as any))}>
            <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Committee Roles</Text>
            <Text style={styles.headerSub}>WHO HOLDS WHICH OFFICE</Text>
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

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or flat"
          placeholderTextColor={COLORS.slate[400]}
        />

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 32 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyMini}>
            {members.length === 0 ? 'No residents yet.' : 'Nobody matches that search.'}
          </Text>
        ) : (
          filtered.map((m) => {
            const isMe = String(m.id) === String(user?._id);
            const open = expanded === m.id;
            const color = COLOR_FOR[m.role] || COLOR_FOR.member;
            const pending = m.status !== 'approved';

            return (
              <View key={m.id} style={styles.card}>
                <Pressable
                  style={styles.cardRow}
                  onPress={() => setExpanded(open ? null : m.id)}
                  disabled={pending}
                >
                  <View style={styles.avatar}>
                    {m.avatar
                      ? <Image source={{ uri: m.avatar }} style={styles.avatarImg} />
                      : <Text style={styles.avatarInitial}>{m.name.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {m.name}{isMe ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.unit}>{m.unit ? `Flat ${m.unit}` : 'No flat on file'}</Text>
                    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
                      <Text style={[styles.pillText, { color }]}>{labelFor(m.role).toUpperCase()}</Text>
                    </View>
                  </View>
                  {pending
                    ? <Text style={styles.pendingTag}>AWAITING{'\n'}APPROVAL</Text>
                    : busy === m.id
                      ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.slate[400]} />}
                </Pressable>

                {open && !pending ? (
                  <View style={styles.officeList}>
                    {OFFICES.filter((o) => o.key !== m.role).map((o) => (
                      <Pressable
                        key={o.key}
                        style={styles.officeRow}
                        onPress={() => confirmAssign(m, o.key)}
                        disabled={!!busy}
                      >
                        <View style={[styles.officeDot, { backgroundColor: COLOR_FOR[o.key] }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.officeLabel}>{o.label}</Text>
                          <Text style={styles.officeBlurb}>{o.blurb}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.slate[400]} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <Text style={styles.footnote}>
          Chairman, Secretary and Treasurer are single seats — appointing a new one steps the
          sitting holder down to Resident. Changes apply immediately, even if the person is
          already using the app. Guards are managed under Security & Gate, not here.
        </Text>
      </ScrollView>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  content: { paddingHorizontal: 20, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: COLORS.slate[400], marginTop: 2 },

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

  search: {
    height: 46, borderRadius: 14, backgroundColor: COLORS.white, paddingHorizontal: 14,
    fontSize: 14, color: COLORS.dark, marginBottom: 4,
  },
  emptyMini: { fontSize: 13, color: COLORS.slate[400], paddingVertical: 24, textAlign: 'center' },

  card: { backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.slate[100],
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 42, height: 42 },
  avatarInitial: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  name: { fontSize: 14.5, fontWeight: '700', color: COLORS.dark },
  unit: { fontSize: 11.5, color: COLORS.slate[400], marginTop: 1 },
  pill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 5 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  pendingTag: { fontSize: 8, fontWeight: '800', color: '#c98a00', textAlign: 'right', letterSpacing: 0.5 },

  officeList: { borderTopWidth: 1, borderTopColor: COLORS.slate[100] },
  officeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  officeDot: { width: 8, height: 8, borderRadius: 4 },
  officeLabel: { fontSize: 13.5, fontWeight: '700', color: COLORS.dark },
  officeBlurb: { fontSize: 11, color: COLORS.slate[400], marginTop: 2, lineHeight: 15 },

  footnote: { fontSize: 11, color: COLORS.slate[400], lineHeight: 16, marginTop: 16, paddingHorizontal: 4 },
  deniedText: { fontSize: 14, color: COLORS.slate[600], textAlign: 'center', lineHeight: 20 },
  ghostBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.white },
  ghostBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: COLORS.slate[600] },
});
