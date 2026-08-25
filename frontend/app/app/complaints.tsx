import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../components/ConfirmDialog';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { PERM, useAuth, useRole } from '../context/AuthContext';
import { uploadPickedFile } from '../lib/uploadImage';

type ComplaintStatus = 'Pending' | 'Reviewed' | 'In Progress' | 'Resolved';
type TimelineItem = { status?: string; message?: string; updatedBy?: string; time?: string };
type Complaint = {
  id: string;
  ticketId?: string;
  title: string;
  status: ComplaintStatus;
  date: string;
  category: string;
  details: string;
  image?: string | null;
  isUrgent?: boolean;
  flatNumber?: string;
  bookedBy?: string;
  timeline?: TimelineItem[];
};

const STATUS_SEQUENCE: ComplaintStatus[] = ['Pending', 'Reviewed', 'In Progress', 'Resolved'];
const STATUS_API_MAP: Record<ComplaintStatus, string> = {
  Pending: 'pending', Reviewed: 'reviewed', 'In Progress': 'in_progress', Resolved: 'resolved',
};
const prettyStatus = (s?: string): ComplaintStatus =>
  s === 'resolved' ? 'Resolved' : s === 'in_progress' ? 'In Progress' : s === 'reviewed' ? 'Reviewed' : 'Pending';

const CATEGORIES = ['Noise', 'Parking', 'Cleanliness', 'Security', 'Maintenance', 'Other'];

export default function ComplaintsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  // The backend gates complaints on complaints.manage,
  // which is not the same set as the old isManager grouping —
  // it let a treasurer see controls that would 403, and hid
  // them from a committee member who does hold the permission.
  const isManager = can(PERM.COMPLAINTS_MANAGE);

  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  // create form
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // manager status modal
  const [statusTarget, setStatusTarget] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('Reviewed');
  const [statusNote, setStatusNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { confirm, dialog } = useConfirm();

  const loadComplaints = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const url = isManager ? `${API.COMPLAINTS}?scope=society` : API.COMPLAINTS;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) { setComplaints([]); return; }
      const mapped: Complaint[] = json.data.map((item: any) => ({
        id: String(item._id),
        ticketId: item.ticketId || undefined,
        title: String(item.title || 'Complaint'),
        status: prettyStatus(String(item.status || 'pending')),
        date: new Date(item.createdAt || Date.now()).toLocaleString('en-US', { day: '2-digit', month: 'short' }),
        category: String(item.category || 'Other'),
        details: String(item.description || ''),
        image: item.image || null,
        isUrgent: Boolean(item.isUrgent),
        flatNumber: item.flatNumber || '',
        timeline: Array.isArray(item.timeline) ? item.timeline : [],
      }));
      setComplaints(mapped);
    } catch {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadComplaints(); }, [token, isManager]);

  const filtered = useMemo(
    () => (statusFilter === 'All' ? complaints : complaints.filter((c) => c.status === statusFilter)),
    [complaints, statusFilter],
  );
  const selectedComplaint = useMemo(
    () => complaints.find((c) => c.id === selectedComplaintId) ?? null,
    [complaints, selectedComplaintId],
  );
  const stats = useMemo(() => ({
    open: complaints.filter((c) => c.status !== 'Resolved').length,
    resolved: complaints.filter((c) => c.status === 'Resolved').length,
  }), [complaints]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to attach an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadPickedFile({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType }, token!);
      setImage(url);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const submitComplaint = async () => {
    if (!category || !description.trim()) {
      Alert.alert('Incomplete', 'Choose a category and describe your complaint.');
      return;
    }
    if (!token) { Alert.alert('Session expired', 'Please login again.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(API.COMPLAINTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${category} complaint`,
          category: category.toLowerCase(),
          description: description.trim(),
          isUrgent,
          ...(image ? { image } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert('Unable to submit', json.message || 'Please try again.'); return; }
      setDescription(''); setCategory(''); setImage(null); setIsUrgent(false);
      setActiveTab('list');
      await loadComplaints();
      Alert.alert('Complaint registered', json.data?.ticketId ? `Your ticket is ${json.data.ticketId}. You'll be notified on updates.` : 'Your complaint has been registered.');
    } catch {
      Alert.alert('Network error', 'Could not connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyStatus = async () => {
    if (!statusTarget || !token) return;
    setSavingStatus(true);
    try {
      const res = await fetch(API.COMPLAINT_STATUS(statusTarget.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: STATUS_API_MAP[newStatus], message: statusNote.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      setStatusTarget(null); setStatusNote('');
      await loadComplaints();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const reopen = async (c: Complaint) => {
    if (!token) return;
    setBusyId(c.id);
    try {
      const res = await fetch(API.COMPLAINT_STATUS(c.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'pending', message: 'Reopened by resident' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      await loadComplaints();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteComplaint = (c: Complaint) => {
    confirm({
      title: 'Delete complaint?',
      message: `“${c.title}” will be removed permanently. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        if (!token) return;
        setBusyId(c.id);
        try {
          const res = await fetch(API.COMPLAINT(c.id), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.message || `Could not delete (${res.status})`);
          setComplaints((prev) => prev.filter((x) => x.id !== c.id));
          if (selectedComplaintId === c.id) setSelectedComplaintId(null);
          setBanner({ type: 'success', text: 'Complaint deleted.' });
        } catch (e: any) {
          const m = String(e?.message || '');
          setBanner({
            type: 'error',
            text: /failed to fetch|network|timed out/i.test(m)
              ? 'Couldn’t reach the server. Check your connection and try again.'
              : m || 'Could not delete the complaint.',
          });
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const statusColor = (status: ComplaintStatus) => {
    if (status === 'Resolved') return { bg: COLORS.accentGreen, text: '#1d7a3a' };
    if (status === 'In Progress') return { bg: '#FEF3C7', text: '#92400E' };
    if (status === 'Reviewed') return { bg: '#EDE9FE', text: '#6D28D9' };
    return { bg: `${COLORS.red}1A`, text: COLORS.red };
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaints</Text>
        <TouchableOpacity onPress={() => setActiveTab('new')} style={styles.newBtn}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'list' && styles.tabActive]} onPress={() => setActiveTab('list')}>
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>{isManager ? 'All Complaints' : 'My Complaints'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'new' && styles.tabActive]} onPress={() => setActiveTab('new')}>
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>Raise Complaint</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        {banner ? (
          <TouchableOpacity
            style={[styles.banner, banner.type === 'success' ? styles.bannerOk : styles.bannerErr]}
            onPress={() => setBanner(null)}
            activeOpacity={0.9}
          >
            <Ionicons name={banner.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={banner.type === 'success' ? '#1d7a3a' : COLORS.red} />
            <Text style={[styles.bannerText, { color: banner.type === 'success' ? '#1d7a3a' : COLORS.red }]}>{banner.text}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}

        {activeTab === 'new' ? (
          <View style={styles.formSection}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.categoryChip, category === cat && styles.categoryChipActive]} onPress={() => setCategory(cat)}>
                  <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.urgentRow} onPress={() => setIsUrgent(!isUrgent)} activeOpacity={0.8}>
              <View style={[styles.checkbox, isUrgent && styles.checkboxOn]}>
                {isUrgent && <Ionicons name="checkmark" size={15} color={COLORS.white} />}
              </View>
              <Ionicons name="alert-circle" size={18} color={COLORS.primary} />
              <Text style={styles.urgentText}>Mark as urgent / high priority</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea} multiline numberOfLines={6} textAlignVertical="top"
              placeholder="Describe your complaint in detail..." placeholderTextColor={COLORS.slate[400]}
              value={description} onChangeText={setDescription}
            />

            <Text style={styles.label}>Photo (optional)</Text>
            {image ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: image }} style={styles.previewImage} />
                <TouchableOpacity style={styles.previewRemove} onPress={() => setImage(null)}>
                  <Ionicons name="close-circle" size={24} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={pickImage} disabled={uploading}>
                {uploading ? <ActivityIndicator color={COLORS.primary} /> : (
                  <><Ionicons name="camera-outline" size={20} color={COLORS.primary} /><Text style={styles.photoBtnText}>Attach a photo</Text></>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.submitBtn, (submitting || uploading) && { opacity: 0.6 }]} onPress={submitComplaint} disabled={submitting || uploading}>
              <Ionicons name="send" size={18} color={COLORS.white} />
              <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Complaint'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.historyList}>
            {isManager ? (
              <View style={styles.statsRow}>
                <View style={styles.statCard}><Text style={styles.statValue}>{stats.open}</Text><Text style={styles.statLabel}>OPEN</Text></View>
                <View style={styles.statCard}><Text style={[styles.statValue, { color: '#1d7a3a' }]}>{stats.resolved}</Text><Text style={styles.statLabel}>RESOLVED</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>{complaints.length}</Text><Text style={styles.statLabel}>TOTAL</Text></View>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {(['All', ...STATUS_SEQUENCE] as const).map((f) => (
                <TouchableOpacity key={f} style={[styles.filterChip, statusFilter === f && styles.filterChipActive]} onPress={() => setStatusFilter(f)}>
                  <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
            ) : filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbox-ellipses-outline" size={40} color={COLORS.slate[300]} />
                <Text style={styles.emptyText}>{complaints.length === 0 ? 'No complaints yet.' : `No ${statusFilter.toLowerCase()} complaints.`}</Text>
                {complaints.length === 0 ? (
                  <TouchableOpacity style={styles.emptyCta} onPress={() => setActiveTab('new')}>
                    <Ionicons name="add" size={18} color={COLORS.white} />
                    <Text style={styles.emptyCtaText}>Raise a Complaint</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : filtered.map((c) => {
              const colors = statusColor(c.status);
              const open = selectedComplaintId === c.id;
              return (
                <TouchableOpacity key={c.id} style={styles.complaintCard} onPress={() => setSelectedComplaintId(open ? null : c.id)} activeOpacity={0.85}>
                  <View style={styles.complaintHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View style={styles.complaintCatBadge}><Text style={styles.complaintCatText}>{c.category}</Text></View>
                      {c.isUrgent ? <View style={styles.urgentBadge}><Ionicons name="alert" size={10} color={COLORS.white} /><Text style={styles.urgentBadgeText}>URGENT</Text></View> : null}
                    </View>
                    <Text style={styles.complaintDate}>{c.date}</Text>
                  </View>

                  <Text style={styles.complaintTitle}>{c.title}</Text>
                  <View style={styles.metaRow}>
                    {c.ticketId ? <Text style={styles.ticketId}>{c.ticketId}</Text> : null}
                    {isManager && c.flatNumber ? <Text style={styles.flatMeta}>· Flat {c.flatNumber}</Text> : null}
                  </View>

                  {c.image ? (
                    <TouchableOpacity onPress={() => c.image && Linking.openURL(c.image)}>
                      <Image source={{ uri: c.image }} style={styles.cardImage} />
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.complaintFooter}>
                    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.statusText, { color: colors.text }]}>{c.status}</Text>
                    </View>
                    <View style={styles.actionRow}>
                      {isManager ? (
                        <TouchableOpacity style={styles.updateBtn} onPress={() => { setStatusTarget(c); setNewStatus(c.status); setStatusNote(''); }}>
                          <Ionicons name="options-outline" size={15} color={COLORS.primary} />
                          <Text style={styles.updateBtnText}>Update</Text>
                        </TouchableOpacity>
                      ) : c.status === 'Resolved' ? (
                        <TouchableOpacity style={styles.updateBtn} disabled={busyId === c.id} onPress={() => reopen(c)}>
                          {busyId === c.id ? <ActivityIndicator size="small" color={COLORS.primary} /> : <><Ionicons name="refresh" size={15} color={COLORS.primary} /><Text style={styles.updateBtnText}>Reopen</Text></>}
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={styles.deleteSmallBtn} disabled={busyId === c.id} onPress={() => deleteComplaint(c)}>
                        <Ionicons name="trash-outline" size={15} color={COLORS.red} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Expanded detail + timeline */}
                  {open ? (
                    <View style={styles.detailBlock}>
                      {c.details ? <Text style={styles.detailBody}>{c.details}</Text> : null}
                      <Text style={styles.timelineHead}>ACTIVITY</Text>
                      {(c.timeline && c.timeline.length) ? c.timeline.map((t, i) => (
                        <View key={i} style={styles.timelineRow}>
                          <View style={styles.timelineDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.timelineStatus}>{prettyStatus(t.status)}</Text>
                            {t.message ? <Text style={styles.timelineMsg}>{t.message}</Text> : null}
                            <Text style={styles.timelineMeta}>{t.updatedBy || 'User'} · {t.time ? new Date(t.time).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                          </View>
                        </View>
                      )) : <Text style={styles.timelineMeta}>No activity yet.</Text>}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Manager: set status modal */}
      <Modal visible={!!statusTarget} transparent animationType="fade" onRequestClose={() => setStatusTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Status</Text>
            <Text style={styles.modalSub}>{statusTarget?.title}{statusTarget?.ticketId ? ` · ${statusTarget.ticketId}` : ''}</Text>
            <View style={styles.statusPickRow}>
              {STATUS_SEQUENCE.map((s) => (
                <TouchableOpacity key={s} style={[styles.statusPick, newStatus === s && styles.statusPickActive]} onPress={() => setNewStatus(s)}>
                  <Text style={[styles.statusPickText, newStatus === s && styles.statusPickTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.noteInput} placeholder="Add a note for the resident (optional)"
              placeholderTextColor={COLORS.slate[400]} value={statusNote} onChangeText={setStatusNote} multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.mBtn, styles.mGhost]} onPress={() => setStatusTarget(null)}><Text style={styles.mGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mPrimary, savingStatus && { opacity: 0.6 }]} disabled={savingStatus} onPress={applyStatus}>
                {savingStatus ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.mPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {dialog}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  newBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  tabRow: { flexDirection: 'row', marginHorizontal: 24, backgroundColor: COLORS.white, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.slate[500] },
  tabTextActive: { color: COLORS.white },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 16 },
  bannerOk: { backgroundColor: '#e6f4eb' },
  bannerErr: { backgroundColor: '#fdecec' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  formSection: { gap: 16 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { fontSize: 14, fontWeight: '600', color: COLORS.slate[600] },
  categoryTextActive: { color: COLORS.white },
  urgentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.slate[200] },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.slate[300], alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  urgentText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.dark },
  textArea: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, fontSize: 14, minHeight: 150, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: COLORS.primary, borderRadius: 12, marginTop: 4 },
  submitBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: `${COLORS.primary}55`, borderStyle: 'dashed', backgroundColor: `${COLORS.primary}0D` },
  photoBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  previewWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  previewImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: COLORS.slate[100] },
  previewRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },

  historyList: { gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.slate[400], letterSpacing: 1, marginTop: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[500] },
  filterTextActive: { color: COLORS.white },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.slate[400], fontWeight: '600' },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyCtaText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  complaintCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  complaintHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  complaintCatBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: `${COLORS.primary}1A` },
  complaintCatText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.red },
  urgentBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  complaintDate: { fontSize: 12, color: COLORS.slate[400] },
  complaintTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2 },
  ticketId: { fontSize: 11, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 0.5 },
  flatMeta: { fontSize: 11, color: COLORS.slate[400] },
  cardImage: { width: '100%', height: 160, borderRadius: 12, marginTop: 4, backgroundColor: COLORS.slate[100] },
  complaintFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: `${COLORS.primary}14` },
  updateBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  deleteSmallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${COLORS.red}15`, alignItems: 'center', justifyContent: 'center' },

  detailBlock: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.slate[100], gap: 8 },
  detailBody: { fontSize: 13, lineHeight: 20, color: COLORS.slate[600] },
  timelineHead: { fontSize: 10, fontWeight: '800', color: COLORS.slate[400], letterSpacing: 1.5, marginTop: 2 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 5 },
  timelineStatus: { fontSize: 13, fontWeight: '800', color: COLORS.dark },
  timelineMsg: { fontSize: 12.5, color: COLORS.slate[600], marginTop: 1 },
  timelineMeta: { fontSize: 11, color: COLORS.slate[400], marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  modalSub: { fontSize: 12, color: COLORS.slate[500] },
  statusPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.slate[100] },
  statusPickActive: { backgroundColor: COLORS.primary },
  statusPickText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[600] },
  statusPickTextActive: { color: COLORS.white },
  noteInput: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.dark, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.slate[200] },
  modalActions: { flexDirection: 'row', gap: 10 },
  mBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  mGhost: { backgroundColor: COLORS.slate[100] },
  mGhostText: { fontWeight: '800', color: COLORS.slate[600] },
  mPrimary: { backgroundColor: COLORS.primary },
  mPrimaryText: { fontWeight: '800', color: COLORS.white },
});
