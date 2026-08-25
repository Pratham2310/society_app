import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';

export type PickerMember = { id: string; name: string; unit: string; role: string };

/**
 * Pick a resident to stand for a post, and optionally write their pitch.
 *
 * Shared by the schedule screen and the election detail screen so the two
 * cannot disagree about who is eligible — a guard filtered out of one list and
 * left in the other would only be caught by the backend, as a confusing error.
 */
export async function loadCandidateMembers(token?: string): Promise<PickerMember[]> {
  const json = await apiFetch(API.ALL_USERS, {}, token);
  const list = Array.isArray(json.users) ? json.users : [];
  return list
    // Gate staff are employees of the society, not members who stand for a post.
    .filter((u: any) => u.status === 'approved' && u.societyrole !== 'security')
    .map((u: any) => ({
      id: String(u._id),
      name: String(u.name || 'Resident'),
      unit: u.flatNumber ? String(u.flatNumber) : '',
      role: String(u.societyrole || 'member'),
    }))
    .sort((a: PickerMember, b: PickerMember) => a.name.localeCompare(b.name));
}

type Props = {
  visible: boolean;
  postLabel: string;
  members: PickerMember[];
  /** Residents already standing for this post — hidden from the list. */
  excludeIds?: string[];
  loading?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onPick: (member: PickerMember, statement: string) => void;
};

export default function CandidatePicker({
  visible, postLabel, members, excludeIds = [], loading, busy, onCancel, onPick,
}: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickerMember | null>(null);
  const [statement, setStatement] = useState('');

  const close = () => {
    setSearch('');
    setPicked(null);
    setStatement('');
    onCancel();
  };

  const confirm = () => {
    if (!picked) return;
    onPick(picked, statement.trim());
    setSearch('');
    setPicked(null);
    setStatement('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const available = members.filter((m) => !excludeIds.includes(m.id));
    if (!q) return available.slice(0, 60);
    return available
      .filter((m) => m.name.toLowerCase().includes(q) || m.unit.toLowerCase().includes(q))
      .slice(0, 60);
  }, [members, excludeIds, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Text style={styles.title}>Standing for {postLabel}</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Ionicons name="close" size={22} color={COLORS.slate[600]} />
            </Pressable>
          </View>

          {picked ? (
            <>
              <View style={styles.pickedRow}>
                <View style={styles.avatar}>
                  <Text style={styles.initial}>{picked.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{picked.name}</Text>
                  <Text style={styles.unit}>{picked.unit ? `Flat ${picked.unit}` : 'No flat on file'}</Text>
                </View>
                <Pressable onPress={() => setPicked(null)} hitSlop={8}>
                  <Text style={styles.changeLink}>CHANGE</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Their pitch to voters (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={statement}
                onChangeText={setStatement}
                placeholder="What they want to do if elected — shown on the ballot"
                placeholderTextColor={COLORS.slate[400]}
                multiline
                maxLength={400}
              />

              <Pressable
                style={[styles.confirmBtn, busy && { opacity: 0.6 }]}
                onPress={confirm}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.confirmText}>ADD CANDIDATE</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or flat"
                placeholderTextColor={COLORS.slate[400]}
              />
              {loading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 28 }} />
              ) : (
                <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
                  {filtered.length === 0 ? (
                    <Text style={styles.empty}>
                      {members.length === 0
                        ? 'No approved residents found.'
                        : 'Nobody left to add for this post.'}
                    </Text>
                  ) : (
                    filtered.map((m) => (
                      <Pressable key={m.id} style={styles.row} onPress={() => setPicked(m)}>
                        <View style={styles.avatar}>
                          <Text style={styles.initial}>{m.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{m.name}</Text>
                          <Text style={styles.unit}>
                            {m.unit ? `Flat ${m.unit}` : 'No flat on file'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={COLORS.slate[400]} />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, gap: 9,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { flex: 1, fontSize: 15.5, fontWeight: '800', color: COLORS.dark },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: COLORS.white,
    borderRadius: 12, padding: 11, marginBottom: 7,
  },
  pickedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: COLORS.white,
    borderRadius: 12, padding: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.slate[100],
    alignItems: 'center', justifyContent: 'center',
  },
  initial: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  name: { fontSize: 13.5, fontWeight: '700', color: COLORS.dark },
  unit: { fontSize: 11, color: COLORS.slate[400], marginTop: 1 },
  changeLink: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: COLORS.primary },

  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.slate[600], marginTop: 8 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.dark,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  empty: { fontSize: 12.5, color: COLORS.slate[400], textAlign: 'center', paddingVertical: 26 },

  confirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 14,
  },
  confirmText: { color: COLORS.white, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.2 },
});
