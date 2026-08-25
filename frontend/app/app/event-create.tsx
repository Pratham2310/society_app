import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [fee, setFee] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // Real residents from the API. No bundled sample list to fall back on:
  // inviting people who don't live here is worse than an empty list.
  const [members, setMembers] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);

  React.useEffect(() => {
    const loadMembers = async () => {
      if (!token) return;

      try {
        const res = await fetch(API.ALL_USERS, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !Array.isArray(json.users)) return;

        const mapped = json.users.map((user: any) => ({
          id: String(user._id),
          name: String(user.name || 'Resident'),
          unit: String(user.flatNumber || 'N/A'),
          role: 'Resident',
          status: String(user.livingType || 'Family'),
          avatar: user.avatar
            || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(user.name || user._id))}`,
          mobile: String(user.phone || 'N/A'),
          email: String(user.email || 'N/A'),
          memberSince: user.createdAt
            ? new Date(user.createdAt).toLocaleString('en-US', { month: 'short', year: 'numeric' })
            : 'N/A',
          verified: Boolean(user.isVerified),
          occupancyType: String(user.occupancyType || 'Owner'),
          totalMembers: Number(user.familySize || 1),
          parkingSlots: [],
          vehicles: [],
        }));

        setMembers(mapped);
      } catch {
        setMembers([]);
      }
    };

    loadMembers();
  }, [token]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => member.name.toLowerCase().includes(search.toLowerCase()));
  }, [members, search]);

  const allSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selectedMemberIds.includes(m.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedMemberIds((prev) => prev.filter((id) => !filteredMembers.find((m) => m.id === id)));
      return;
    }
    setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...filteredMembers.map((m) => m.id)])));
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => (prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]));
  };

  const canPublish = title.trim() && date.trim() && time.trim() && location.trim();

  const handlePublish = async () => {
    if (!token) {
      Alert.alert('Session expired', 'Please login again.');
      return;
    }

    if (!canPublish) return;

    // Backend expects an ISO `eventDate`. Build it from the date + time inputs,
    // falling back to a week out if the free-text can't be parsed.
    const buildEventDate = () => {
      const combined = new Date(`${date} ${time}`);
      if (!isNaN(combined.getTime())) return combined;
      const dOnly = new Date(date);
      if (!isNaN(dOnly.getTime())) return dOnly;
      return new Date(Date.now() + 7 * 86400000);
    };
    const feeValue = Number(fee) || 0;

    setPublishing(true);
    try {
      const res = await fetch(API.EVENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          location,
          eventDate: buildEventDate().toISOString(),
          time,
          eventType: 'Society',
          fee: feeValue,
          invitedMembers: selectedMemberIds,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Unable to publish', json.message || 'Please try again');
        return;
      }

      router.replace('/(tabs)/events');
    } catch {
      Alert.alert('Network error', 'Could not connect to backend server.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/events' as any))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host an Event</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 130 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Event Details</Text>

        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={COLORS.slate[400]} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={date} onChangeText={setDate} placeholder="Date" placeholderTextColor={COLORS.slate[400]} />
          <TextInput style={[styles.input, styles.half]} value={time} onChangeText={setTime} placeholder="Time" placeholderTextColor={COLORS.slate[400]} />
        </View>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor={COLORS.slate[400]} />
        <TextInput
          style={styles.input}
          value={fee}
          onChangeText={setFee}
          placeholder="Entry fee in ₹ (leave blank for a free event)"
          placeholderTextColor={COLORS.slate[400]}
          keyboardType="number-pad"
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={COLORS.slate[400]}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.guestHeader}>
          <Text style={styles.sectionTitle}>Guest Selection</Text>
          <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>{allSelected ? 'UNSELECT' : 'SELECT ALL'}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search residents"
          placeholderTextColor={COLORS.slate[400]}
        />

        <View style={styles.memberList}>
          {filteredMembers.map((member) => {
            const selected = selectedMemberIds.includes(member.id);
            return (
              <TouchableOpacity key={member.id} style={styles.memberRow} onPress={() => toggleMember(member.id)}>
                <View style={styles.memberInfo}>
                  <Image source={{ uri: member.avatar }} style={styles.avatar} />
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberUnit}>{member.unit}</Text>
                  </View>
                </View>
                <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? COLORS.primary : COLORS.slate[400]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.footerText}>{selectedMemberIds.length} members selected</Text>
        <TouchableOpacity
          style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
          disabled={!canPublish || publishing}
          onPress={handlePublish}
        >
          {publishing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.publishText}>PUBLISH EVENT</Text>}
        </TouchableOpacity>
      </View>
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
  content: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark, marginBottom: 12, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    height: 52, backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14,
    fontSize: 14, color: COLORS.dark, marginBottom: 10,
  },
  half: { flex: 1 },
  textArea: { height: 100, paddingTop: 12 },
  guestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  selectAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: `${COLORS.primary}1A` },
  selectAllText: { fontSize: 10, color: COLORS.primary, fontWeight: '700', letterSpacing: 1 },
  memberList: { backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  memberName: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  memberUnit: { fontSize: 11, color: COLORS.slate[400], marginTop: 1 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: `${COLORS.black}12`, backgroundColor: COLORS.background,
  },
  footerText: { textAlign: 'center', fontSize: 12, color: COLORS.slate[500], marginBottom: 8 },
  publishBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  publishBtnDisabled: { opacity: 0.45 },
  publishText: { color: COLORS.white, fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
});
