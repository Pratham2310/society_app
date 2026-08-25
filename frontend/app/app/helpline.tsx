import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth, useRole } from '../context/AuthContext';

type Contact = {
  _id: string;
  icon: string;
  label: string;
  number: string;
  desc: string;
  type: 'Society' | 'Emergency';
  isDefault?: boolean;
};

// Fallback list shown only if the backend is unreachable.
const FALLBACK: Contact[] = [
  { _id: 'f1', icon: 'shield-checkmark', label: 'Security Office', number: '1800-123-4567', desc: 'Main gate security — 24/7', type: 'Society' },
  { _id: 'f5', icon: 'medkit', label: 'Medical Emergency', number: '108', desc: 'Ambulance service', type: 'Emergency', isDefault: true },
  { _id: 'f6', icon: 'flame', label: 'Fire Brigade', number: '101', desc: 'Fire emergencies', type: 'Emergency', isDefault: true },
  { _id: 'f7', icon: 'call', label: 'Police', number: '100', desc: 'Law enforcement', type: 'Emergency', isDefault: true },
];

const ICON_CHOICES = ['call', 'shield-checkmark', 'water', 'flash', 'construct', 'medkit', 'flame', 'business', 'people', 'car'];

export default function HelplineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isSecretary, isManager } = useRole();
  const canManage = isSecretary || isManager;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Society' | 'Emergency'>('All');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<{ label: string; number: string; desc: string; icon: string }>({
    label: '', number: '', desc: '', icon: 'call',
  });
  const [saving, setSaving] = useState(false);

  const loadContacts = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(API.HELPLINE, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data) && json.data.length) {
        setContacts(json.data);
      } else {
        setContacts(FALLBACK);
      }
    } catch {
      setContacts(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, [token]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return contacts.filter((item) => {
      const matchesFilter = activeFilter === 'All' || item.type === activeFilter;
      const matchesQuery =
        item.label.toLowerCase().includes(q) ||
        item.number.toLowerCase().includes(q) ||
        (item.desc || '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, contacts, searchQuery]);

  const openAdd = () => {
    setEditing(null);
    setForm({ label: '', number: '', desc: '', icon: 'call' });
    setShowModal(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ label: c.label, number: c.number, desc: c.desc || '', icon: c.icon || 'call' });
    setShowModal(true);
  };

  const submit = async () => {
    if (!form.label.trim() || !form.number.trim()) {
      Alert.alert('Missing info', 'Name and phone number are required.');
      return;
    }
    setSaving(true);
    try {
      const url    = editing ? API.HELPLINE_ITEM(editing._id) : API.HELPLINE;
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: form.label.trim(),
          number: form.number.trim(),
          description: form.desc.trim(),
          icon: form.icon,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to save');
      setShowModal(false);
      loadContacts();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const removeContact = (c: Contact) => {
    Alert.alert('Delete contact', `Remove "${c.label}" from the helpline?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(API.HELPLINE_ITEM(c._id), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed');
            loadContacts();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete contact');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Helpline</Text>
        {canManage ? (
          <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, gap: 12 }}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={COLORS.slate[400]} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contact or number"
            placeholderTextColor={COLORS.slate[400]}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {(['All', 'Society', 'Emergency'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.emergencyBanner}>
          <Ionicons name="warning" size={24} color={COLORS.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>Emergency?</Text>
            <Text style={styles.emergencyDesc}>Long press the SOS button on dashboard for immediate assistance</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : (
          filteredContacts.map((c) => (
            <View key={c._id} style={styles.contactCard}>
              <TouchableOpacity
                style={styles.contactMain}
                onPress={() => Linking.openURL(`tel:${c.number}`)}
                activeOpacity={0.8}
              >
                <View style={styles.contactIcon}>
                  <Ionicons name={c.icon as any} size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>{c.label}</Text>
                  <Text style={styles.contactDesc}>{c.desc || c.number}</Text>
                </View>
                <View style={styles.callBtn}>
                  <Ionicons name="call" size={18} color={COLORS.white} />
                </View>
              </TouchableOpacity>

              {/* Secretary controls — only for editable society contacts */}
              {canManage && c.type === 'Society' && !c.isDefault ? (
                <View style={styles.adminRow}>
                  <TouchableOpacity style={styles.adminAction} onPress={() => openEdit(c)}>
                    <Ionicons name="create-outline" size={14} color={COLORS.slate[600]} />
                    <Text style={styles.adminActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.adminAction} onPress={() => removeContact(c)}>
                    <Ionicons name="trash-outline" size={14} color={COLORS.red} />
                    <Text style={[styles.adminActionText, { color: COLORS.red }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add / edit modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Contact' : 'Add Society Contact'}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Name (e.g. Plumber on call)"
              placeholderTextColor={COLORS.slate[400]}
              value={form.label}
              onChangeText={(t) => setForm({ ...form, label: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone number"
              placeholderTextColor={COLORS.slate[400]}
              keyboardType="phone-pad"
              value={form.number}
              onChangeText={(t) => setForm({ ...form, number: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Short description (optional)"
              placeholderTextColor={COLORS.slate[400]}
              value={form.desc}
              onChangeText={(t) => setForm({ ...form, desc: t })}
            />

            <Text style={styles.iconLabel}>ICON</Text>
            <View style={styles.iconRow}>
              {ICON_CHOICES.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconChip, form.icon === ic && styles.iconChipActive]}
                  onPress={() => setForm({ ...form, icon: ic })}
                >
                  <Ionicons name={ic as any} size={18} color={form.icon === ic ? COLORS.white : COLORS.slate[500]} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowModal(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={submit}
              >
                <Text style={styles.modalBtnPrimaryText}>{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primary },
  addBtnText: { color: COLORS.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[500] },
  filterChipTextActive: { color: COLORS.white },
  emergencyBanner: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, marginBottom: 8 },
  emergencyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  emergencyDesc: { fontSize: 12, color: `${COLORS.white}CC`, marginTop: 4 },
  contactCard: { backgroundColor: COLORS.white, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, overflow: 'hidden' },
  contactMain: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  contactIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: `${COLORS.primary}1A`, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  contactDesc: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  adminRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.slate[100] },
  adminAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  adminActionText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[600] },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  modalInput: { padding: 14, borderWidth: 1, borderColor: COLORS.slate[200], borderRadius: 12, fontSize: 15, color: COLORS.dark, backgroundColor: COLORS.background },
  iconLabel: { fontSize: 10, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 1 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.slate[100] },
  iconChipActive: { backgroundColor: COLORS.primary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  modalBtnGhost: { backgroundColor: COLORS.slate[100] },
  modalBtnGhostText: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  modalBtnPrimary: { backgroundColor: COLORS.primary },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});
