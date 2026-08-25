import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/Colors';
import { PERM, useAuth, useRole } from '../../context/AuthContext';
import { Member } from '../../types';

type PendingMember = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  flatNumber: string;
  societyrole: string;
};

export default function MembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isSecretary, isManager, can } = useRole();
  // `searchText` is what's being typed; `searchQuery` is what's actually
  // applied — so results appear when the user taps Search or presses enter.
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Members');
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPendingMembers = useCallback(async () => {
    if (!token || !isSecretary) return;
    try {
      const res = await fetch(API.PENDING_USERS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.users)) {
        setPendingMembers(json.users);
      }
    } catch {
      // Silently fail — not critical
    }
  }, [token, isSecretary]);

  const loadProfileRequests = useCallback(async () => {
    if (!token || !isSecretary) return;
    try {
      const res = await fetch(API.PROFILE_CHANGE_REQUESTS, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) setProfileRequests(json.data);
    } catch { /* ignore */ }
  }, [token, isSecretary]);

  const decideProfile = async (userId: string, approve: boolean) => {
    if (!token) return;
    setActionMsg(null);
    setActionLoading(userId + (approve ? 'pa' : 'pr'));
    try {
      const res = await fetch(API.PROFILE_CHANGE_DECIDE(userId), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Action failed (${res.status})`);
      setProfileRequests((prev) => prev.filter((r) => r._id !== userId));
      setActionMsg({ type: 'success', text: approve ? 'Profile changes approved.' : 'Profile changes rejected.' });
      loadMembers();
    } catch (err: any) {
      const m = String(err?.message || '');
      setActionMsg({
        type: 'error',
        text: /failed to fetch|network|timed out/i.test(m)
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : m || 'Could not update the request.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMemberAction = async (userId: string, status: 'approved' | 'rejected') => {
    if (!token) return;
    setActionMsg(null);
    setActionLoading(userId + status);
    try {
      const res = await fetch(API.UPDATE_MEMBER_STATUS(userId), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Action failed (${res.status})`);
      setPendingMembers(prev => prev.filter(m => m._id !== userId));
      setActionMsg({ type: 'success', text: `Member ${status === 'approved' ? 'approved' : 'rejected'} successfully.` });
      loadMembers();
    } catch (err: any) {
      const m = String(err?.message || '');
      setActionMsg({
        type: 'error',
        text: /failed to fetch|network|timed out/i.test(m)
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : m || 'Could not update member status.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const loadMembers = useCallback(async () => {
      if (!token) { setLoadingMembers(false); return; }
      setMembersError(null);

      try {
        const res = await fetch(API.ALL_USERS, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !Array.isArray(json.users)) {
          throw new Error(json.message || `Could not load members (${res.status})`);
        }

        const mapped: Member[] = json.users.map((user: any) => {
          const vehicles = Array.isArray(user.vehicles) ? user.vehicles : [];
          const flat = user.flatNumber ? String(user.flatNumber) : 'N/A';
          const wingPrefix = flat.includes('-') ? flat.split('-')[0] : 'A';
          const unit = `${wingPrefix} - ${flat.replace(`${wingPrefix}-`, '')}`;
          const roleRaw = String(user.societyrole || 'member');
          const role = roleRaw === 'secretary'
            ? 'Secretary'
            : roleRaw === 'treasurer'
              ? 'Treasurer'
              : 'Resident';

          return {
            id: String(user._id),
            name: String(user.name || 'Resident'),
            unit,
            role,
            status: String(user.livingType || 'Family'),
            // Real uploaded photo when the resident has set one; the card
            // falls back to their initial otherwise.
            avatar: String(user.avatar || ''),
            mobile: String(user.phone || 'N/A'),
            email: String(user.email || 'N/A'),
            memberSince: user.createdAt
              ? new Date(user.createdAt).toLocaleString('en-US', { month: 'short', year: 'numeric' })
              : 'N/A',
            verified: Boolean(user.isVerified),
            occupancyType: String(user.occupancyType || 'Owner'),
            totalMembers: Number(user.familySize || 1),
            parkingSlots: vehicles.map((v: any) => String(v.parkingSlot || 'N/A')),
            vehicles: vehicles.map((v: any) => ({
              type: v.type === 'bike' ? 'bike' : 'car',
              model: String(v.model || (v.type === 'bike' ? 'Bike' : 'Car')),
              slot: String(v.parkingSlot || 'N/A'),
              number: String(v.number || 'N/A'),
            })),
          };
        });

        setMembers(mapped);
      } catch (e: any) {
        // Never silently show an empty list — surface it so a connection
        // problem can't be mistaken for missing data.
        const msg = String(e?.message || '');
        setMembersError(
          /failed to fetch|network|timed out|abort/i.test(msg)
            ? 'Couldn’t reach the server. Check your connection and tap retry.'
            : msg || 'Could not load members.'
        );
      } finally {
        setLoadingMembers(false);
      }
  }, [token]);

  // Reload members, pending approvals and profile-change requests every time
  // the Members tab is focused, so new data appears without restarting the app.
  useFocusEffect(useCallback(() => {
    loadMembers();
    loadPendingMembers();
    loadProfileRequests();
  }, [loadMembers, loadPendingMembers, loadProfileRequests]));

  // Live suggestions shown directly under the search box — they sit above the
  // keyboard, so results are visible while typing instead of being covered.
  const suggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (q.length < 1) return [];
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.unit.toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchText, members]);

  const runSearch = useCallback(() => {
    setSearchQuery(searchText.trim());
    Keyboard.dismiss();
  }, [searchText]);

  const clearSearch = useCallback(() => {
    setSearchText('');
    setSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const stats = useMemo(() => {
    const total = members.length;
    const families = members.filter((m) => m.status.toLowerCase() === 'family').length;
    const bachelors = members.filter((m) => m.status.toLowerCase() === 'bachelor').length;
    return [
      { label: 'TOTAL', value: String(total) },
      { label: 'FAMILIES', value: String(families) },
      { label: 'BACHELORS', value: String(bachelors) },
    ];
  }, [members]);
  const filters = ['All Members', 'Wing A', 'Wing B', 'Wing C', 'Committee'];

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.unit.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'All Members') return true;
    if (activeFilter === 'Committee') return member.role === 'Secretary' || member.role === 'Treasurer';
    if (activeFilter.startsWith('Wing ')) {
      const wingLetter = activeFilter.split(' ')[1];
      return member.unit.startsWith(wingLetter);
    }
    return true;
  });

  const groupedMembers = activeFilter === 'All Members' && searchQuery === '' ? [
    { title: 'Committee Members', members: filteredMembers.filter(m => m.role === 'Secretary' || m.role === 'Treasurer') },
    { title: 'Residents', members: filteredMembers.filter(m => m.role !== 'Secretary' && m.role !== 'Treasurer') }
  ] : [
    { title: searchQuery !== '' ? 'Search Results' : activeFilter, members: filteredMembers }
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Society Members</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.slate[400]} />
            <TextInput
              placeholder="Search by name or unit"
              placeholderTextColor={COLORS.slate[400]}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={runSearch}
              // outlineStyle kills the browser's focus square on the web build.
              style={[styles.searchInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
              returnKeyType="search"
            />
            {searchText || searchQuery ? (
              <TouchableOpacity onPress={clearSearch} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={COLORS.slate[400]} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={runSearch} activeOpacity={0.85}>
            <Ionicons name="search" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Live suggestions — visible above the keyboard while typing */}
        {searchText.trim() && searchText.trim() !== searchQuery ? (
          <View style={styles.suggestBox}>
            {suggestions.length === 0 ? (
              <Text style={styles.suggestEmpty}>No member matches “{searchText.trim()}”</Text>
            ) : (
              suggestions.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.suggestRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Keyboard.dismiss();
                    router.push({ pathname: '/member-profile', params: { id: m.id } });
                  }}
                >
                  {m.avatar
                    ? <Image source={{ uri: m.avatar }} style={styles.suggestAvatar} />
                    : <View style={styles.suggestAvatar}><Text style={styles.suggestInitial}>{m.name[0]?.toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestName}>{m.name}</Text>
                    <Text style={styles.suggestUnit}>{m.unit} · {m.role}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={15} color={COLORS.slate[300]} />
                </TouchableOpacity>
              ))
            )}
            {suggestions.length > 0 ? (
              <TouchableOpacity style={styles.seeAllRow} onPress={runSearch}>
                <Text style={styles.seeAllText}>See all results for “{searchText.trim()}”</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {searchQuery ? (
          <View style={styles.resultBar}>
            <Text style={styles.resultText}>
              {filteredMembers.length} result{filteredMembers.length === 1 ? '' : 's'} for “{searchQuery}”
            </Text>
            <TouchableOpacity onPress={clearSearch}>
              <Text style={styles.clearLink}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>

        {actionMsg ? (
          <TouchableOpacity
            style={[styles.actionBanner, actionMsg.type === 'success' ? styles.actionBannerOk : styles.actionBannerErr]}
            onPress={() => setActionMsg(null)}
            activeOpacity={0.9}
          >
            <Ionicons name={actionMsg.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={actionMsg.type === 'success' ? '#1d7a3a' : COLORS.red} />
            <Text style={[styles.actionBannerText, { color: actionMsg.type === 'success' ? '#1d7a3a' : COLORS.red }]}>{actionMsg.text}</Text>
            <Ionicons name="close" size={16} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {/* Appointing office bearers — gated on the permission the backend
            actually enforces, not on a role guess. */}
        {can(PERM.MEMBERS_ROLES) && !searchQuery ? (
          <TouchableOpacity
            style={styles.rolesCta}
            onPress={() => router.push('/manage-roles' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.rolesCtaIcon}>
              <Ionicons name="ribbon" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rolesCtaTitle}>Committee Roles</Text>
              <Text style={styles.rolesCtaSub}>
                Appoint a treasurer, committee members or hand over your office
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {/* Elections — everyone, not just the secretary. Residents come here to
            vote; the secretary also gets the scheduling button inside. */}
        {!searchQuery ? (
          <TouchableOpacity
            style={styles.rolesCta}
            onPress={() => router.push('/elections' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.rolesCtaIcon}>
              <Ionicons name="checkbox" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rolesCtaTitle}>Elections</Text>
              <Text style={styles.rolesCtaSub}>
                {can(PERM.ELECTIONS_MANAGE)
                  ? 'Put a committee post to a vote, or cast your own ballot'
                  : 'Cast your secret ballot for the committee'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {/* Pending Approval — Secretary / Chairman only */}
        {isSecretary && !searchQuery && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingSectionHeader}>
              <View style={styles.pendingTitleRow}>
                <Ionicons name="time" size={18} color={COLORS.primary} />
                <Text style={styles.pendingSectionTitle}>Pending Approvals</Text>
                {pendingMembers.length > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pendingMembers.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => { loadPendingMembers(); loadProfileRequests(); }}>
                <Ionicons name="refresh" size={18} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            {pendingMembers.length === 0 ? (
              <View style={styles.noPendingBox}>
                <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.slate[300]} />
                <Text style={styles.noPendingText}>No pending requests</Text>
              </View>
            ) : (
              pendingMembers.map(member => (
                <View key={member._id} style={styles.pendingCard}>
                  <View style={styles.pendingAvatar}>
                    <Text style={styles.pendingAvatarText}>
                      {(member.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>{member.name || 'Unknown'}</Text>
                    <Text style={styles.pendingMeta}>
                      {member.flatNumber ? `Flat ${member.flatNumber}  ·  ` : ''}{member.phone}
                    </Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      disabled={actionLoading !== null}
                      onPress={() => Alert.alert(
                        'Reject Member',
                        `Reject ${member.name}'s registration?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Reject', style: 'destructive', onPress: () => handleMemberAction(member._id, 'rejected') },
                        ]
                      )}
                    >
                      {actionLoading === member._id + 'rejected'
                        ? <ActivityIndicator size="small" color={COLORS.red} />
                        : <Ionicons name="close" size={18} color={COLORS.red} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      disabled={actionLoading !== null}
                      onPress={() => handleMemberAction(member._id, 'approved')}
                    >
                      {actionLoading === member._id + 'approved'
                        ? <ActivityIndicator size="small" color={COLORS.white} />
                        : <Ionicons name="checkmark" size={18} color={COLORS.white} />}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Profile change requests — Secretary / Chairman only */}
        {isSecretary && !searchQuery && profileRequests.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingTitleRow}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={styles.pendingSectionTitle}>Profile Change Requests</Text>
              <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{profileRequests.length}</Text></View>
            </View>
            {profileRequests.map((r) => {
              const changes = r.pendingProfile?.changes || {};
              const summary = Object.entries(changes)
                .map(([k, v]) => `${k === 'occupancyType' ? 'occupancy' : k}: ${v}`)
                .join(' · ');
              return (
                <View key={r._id} style={styles.pendingCard}>
                  <View style={styles.pendingAvatar}><Text style={styles.pendingAvatarText}>{(r.name || 'U')[0].toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>{r.name || 'Resident'}{r.flatNumber ? ` · Flat ${r.flatNumber}` : ''}</Text>
                    <Text style={styles.pendingMeta}>{summary || 'Profile update'}</Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity style={styles.rejectBtn} disabled={actionLoading !== null} onPress={() => decideProfile(r._id, false)}>
                      {actionLoading === r._id + 'pr' ? <ActivityIndicator size="small" color={COLORS.red} /> : <Ionicons name="close" size={18} color={COLORS.red} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.approveBtn} disabled={actionLoading !== null} onPress={() => decideProfile(r._id, true)}>
                      {actionLoading === r._id + 'pa' ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark" size={18} color={COLORS.white} />}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Member List */}
        <View style={styles.listContainer}>
          {loadingMembers ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : membersError ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cloud-offline-outline" size={36} color={COLORS.red} />
              <Text style={styles.errorText}>{membersError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoadingMembers(true); loadMembers(); }}>
                <Ionicons name="refresh" size={16} color={COLORS.white} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={36} color={COLORS.slate[300]} />
              <Text style={styles.emptyText}>No members yet.</Text>
            </View>
          ) : groupedMembers.map((group, idx) => group.members.length > 0 && (
            <View key={idx} style={styles.groupSection}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberCard}
                  onPress={() => router.push({ pathname: '/member-profile', params: { id: member.id } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.memberAvatar}>
                    {member.avatar ? (
                      <Image source={{ uri: member.avatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={styles.memberAvatarInitial}>
                        {String(member.name || 'R').trim()[0]?.toUpperCase() || 'R'}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {member.verified && <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />}
                    </View>
                    <Text style={styles.memberUnit}>{member.unit}</Text>
                    <View style={[styles.roleBadge, (member.role === 'Secretary' || member.role === 'Treasurer') && styles.roleBadgeHighlight]}>
                      <Text style={[styles.roleText, (member.role === 'Secretary' || member.role === 'Treasurer') && styles.roleTextHighlight]}>{member.role}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.slate[500]} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingBottom: 16, paddingHorizontal: 24, gap: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.dark },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16,
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.slate[200],
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.dark },
  searchBtn: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestBox: {
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.slate[200],
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.slate[100] },
  suggestAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  suggestInitial: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  suggestName: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  suggestUnit: { fontSize: 11, color: COLORS.slate[400], marginTop: 1 },
  suggestEmpty: { fontSize: 13, color: COLORS.slate[400], fontWeight: '600', padding: 16, textAlign: 'center' },
  seeAllRow: { paddingVertical: 11, alignItems: 'center', backgroundColor: `${COLORS.primary}0D` },
  seeAllText: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  resultBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  resultText: { fontSize: 12.5, fontWeight: '700', color: COLORS.slate[500] },
  clearLink: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.slate[400], fontWeight: '600' },
  errorText: { fontSize: 14, color: COLORS.red, fontWeight: '700', textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  actionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 16, borderRadius: 12, padding: 12 },
  actionBannerOk: { backgroundColor: '#e6f4eb' },
  actionBannerErr: { backgroundColor: '#fdecec' },
  actionBannerText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, paddingVertical: 16, borderRadius: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 1, marginTop: 4 },
  filterScroll: { marginBottom: 24 },
  filterChip: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  filterChipActive: { backgroundColor: COLORS.primary, shadowOpacity: 0.15 },
  filterText: { fontSize: 14, fontWeight: '700', color: COLORS.slate[400] },
  filterTextActive: { color: COLORS.white },
  listContainer: { paddingHorizontal: 24, gap: 32 },
  groupSection: { gap: 16 },
  groupTitle: { fontSize: 10, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 3, paddingLeft: 4 },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.white, padding: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  memberAvatar: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  memberAvatarInitial: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  memberName: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  memberUnit: { fontSize: 12, fontWeight: '500', color: COLORS.slate[400], marginBottom: 8 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.slate[100], alignSelf: 'flex-start' },
  roleBadgeHighlight: { backgroundColor: `${COLORS.primary}1A` },
  roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: COLORS.slate[500], textTransform: 'uppercase' },
  roleTextHighlight: { color: COLORS.primary },

  // Pending approvals section
  pendingSection: {
    marginHorizontal: 24, marginBottom: 24, backgroundColor: COLORS.white, borderRadius: 16,
    padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  pendingSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pendingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  pendingBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  noPendingBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  noPendingText: { fontSize: 13, color: COLORS.slate[400] },
  pendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.slate[100],
  },
  pendingAvatar: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: `${COLORS.primary}1A`,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingAvatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  pendingName: { fontSize: 14, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  pendingMeta: { fontSize: 12, color: COLORS.slate[400] },
  pendingActions: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
  },
  approveBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rolesCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  rolesCtaIcon: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${COLORS.primary}12`,
  },
  rolesCtaTitle: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  rolesCtaSub: { fontSize: 11.5, color: COLORS.slate[400], marginTop: 2, lineHeight: 16 },
});
