import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePickerField from '../components/DatePickerField';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth, useRole } from '../context/AuthContext';
import { uploadPickedFile } from '../lib/uploadImage';

type Attachment = { url: string; type: 'image' | 'document'; name: string };

// Ready-made notice templates the secretary can start from and edit.
const TEMPLATES: { label: string; title: string; description: string }[] = [
  { label: 'Water Supply', title: 'Water Supply Disruption', description: 'Please note the water supply will be interrupted on [date] from [start time] to [end time] due to [reason]. Kindly store water in advance. We regret the inconvenience.' },
  { label: 'AGM', title: 'Annual General Meeting', description: 'All residents are invited to the Annual General Meeting on [date] at [time] in the [venue]. Your presence and participation are requested.' },
  { label: 'Maintenance Due', title: 'Monthly Maintenance Reminder', description: 'This is a reminder to pay your monthly maintenance for [month] by the due date. Kindly clear pending dues to avoid late fees.' },
  { label: 'Lift Service', title: 'Lift Maintenance Notice', description: 'The lift in [wing] will be under maintenance on [date] from [start time] to [end time]. Please use the stairs during this period.' },
  { label: 'Festival', title: 'Festival Celebration', description: 'We are pleased to announce the celebration of [festival] on [date]. All residents are cordially invited to join. Further details will follow.' },
  { label: 'Security', title: 'Security Update', description: 'Please be informed of the following security update: [details]. Residents are requested to cooperate for the safety of the society.' },
];

const CATEGORIES = ['general', 'security', 'amenities', 'maintenance', 'event', 'finance'] as const;
const CATEGORY_LABEL: Record<string, string> = {
  general: 'General', security: 'Security', amenities: 'Amenities',
  maintenance: 'Maintenance', event: 'Event', finance: 'Finance',
  election: 'Election',
};

/**
 * A notice can point at the thing it is about. Election notices carry
 * { screen: 'elections', id } so the resident goes straight to the ballot
 * rather than reading "go and vote" and then having to find where.
 */
type NoticeLink = { screen?: string; id?: string } | null;

const routeForNotice = (link?: NoticeLink): string | null => {
  if (link?.screen !== 'elections') return null;
  return link.id ? `/election-details?id=${link.id}` : '/elections';
};

type NoticeCard = {
  id: string;
  title: string;
  date: string;
  details: string;
  category: string;
  isUrgent: boolean;
  isExpired: boolean;
  postedBy: string;
  ackCount: number;
  acknowledged: boolean;
  attachments?: Attachment[];
  link?: NoticeLink;
};

export default function NoticesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isManager } = useRole();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const [activeTab, setActiveTab] = useState<'Latest' | 'Past'>('Latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<string>('general');
  const [newUrgent, setNewUrgent] = useState(false);
  const [newValidTill, setNewValidTill] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [notices, setNotices] = useState<NoticeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NoticeCard | null>(null);
  const [acking, setAcking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listBanner, setListBanner] = useState<string | null>(null);

  const loadNotices = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(API.NOTICES, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) { setNotices([]); return; }

      const mapped: NoticeCard[] = json.data.map((item: any) => {
        const created = item.createdAt ? new Date(item.createdAt) : new Date();
        return {
          id: String(item._id),
          title: String(item.title || 'Notice'),
          date: created.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          details: String(item.description || ''),
          category: String(item.category || 'general'),
          isUrgent: Boolean(item.isUrgent),
          isExpired: Boolean(item.isExpired),
          postedBy: String(item.postedBy || 'Society Office'),
          ackCount: Number(item.ackCount || 0),
          acknowledged: Boolean(item.acknowledged),
          attachments: Array.isArray(item.attachments) ? item.attachments : [],
          link: item.link || null,
        };
      });
      setNotices(mapped);
    } catch {
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotices(); }, [token]);

  // Arriving from the dashboard's "Post Notice" opens the composer directly.
  useEffect(() => {
    if (compose === '1' && isManager) setShowCreateModal(true);
  }, [compose, isManager]);

  // Upload a picked file to Cloudinary via the backend, return its URL.
  // (uploadPickedFile handles the web/native multipart difference.)
  const uploadFile = (uri: string, name: string, mime: string): Promise<string> =>
    uploadPickedFile({ uri, name, mimeType: mime }, token!);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to attach images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || `image-${Date.now()}.jpg`;
      const url = await uploadFile(asset.uri, name, asset.mimeType || 'image/jpeg');
      if (url) setAttachments((prev) => [...prev, { url, type: 'image', name }]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
      if (url) setAttachments((prev) => [...prev, { url, type: 'document', name: asset.name }]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setFormError(null);
    setNewTitle('');
    setNewDescription('');
    setNewCategory('general');
    setNewUrgent(false);
    setNewValidTill('');
    setAttachments([]);
  };

  const postNotice = async () => {
    if (newTitle.trim().length < 3) {
      setFormError('Enter a title (at least 3 characters).');
      return;
    }
    let validTill: string | undefined;
    if (newValidTill.trim()) {
      // The picker gives YYYY-MM-DD; treat it as "valid through the END of
      // that day" so picking today still counts as a future expiry.
      const [y, m, day] = newValidTill.trim().split('-').map(Number);
      const d = new Date(y, (m || 1) - 1, day || 1, 23, 59, 59, 999);
      if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        setFormError('Pick a valid-until date that is today or later.');
        return;
      }
      validTill = d.toISOString();
    }
    if (!token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(API.NOTICES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          isUrgent: newUrgent,
          attachments,
          ...(validTill ? { validTill } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(
          res.status === 403
            ? 'Your account isn’t allowed to post notices. Ask the secretary to check your role.'
            : json.message || `Could not post the notice (${res.status}).`
        );
        return;
      }
      resetForm();
      setListBanner('Notice posted — residents have been notified.');
      loadNotices();
    } catch {
      setFormError('Couldn’t reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const acknowledge = async (notice: NoticeCard) => {
    if (!token || notice.acknowledged) return;
    setAcking(true);
    try {
      const res = await fetch(API.NOTICE_ACK(notice.id), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      const updated = { ...notice, acknowledged: true, ackCount: Number(json.ackCount ?? notice.ackCount + 1) };
      setNotices((prev) => prev.map((n) => (n.id === notice.id ? updated : n)));
      setSelected((s) => (s && s.id === notice.id ? updated : s));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not acknowledge');
    } finally {
      setAcking(false);
    }
  };

  const deleteNotice = (id: string) => {
    Alert.alert('Delete Notice', 'Are you sure you want to delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            const res = await fetch(API.NOTICE(id), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setNotices((prev) => prev.filter((n) => n.id !== id));
            } else {
              const json = await res.json();
              Alert.alert('Error', json.message || 'Could not delete notice.');
            }
          } catch {
            Alert.alert('Network error', 'Could not connect to backend server.');
          }
        },
      },
    ]);
  };

  const filteredNotices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return notices
      .filter((n) => (activeTab === 'Latest' ? !n.isExpired : n.isExpired))
      .filter((n) => n.title.toLowerCase().includes(q) || n.details.toLowerCase().includes(q))
      // Urgent (active) notices pinned to the top of Latest.
      .sort((a, b) => (activeTab === 'Latest' ? Number(b.isUrgent) - Number(a.isUrgent) : 0));
  }, [activeTab, notices, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          {isSearchExpanded ? (
            <View style={styles.searchExpandedRow}>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search" size={18} color={COLORS.slate[400]} style={styles.searchLeadingIcon} />
                <TextInput
                  autoFocus
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search notices..."
                  placeholderTextColor={COLORS.slate[400]}
                  style={styles.searchInput}
                />
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => { setIsSearchExpanded(false); setSearchQuery(''); }}
              >
                <Ionicons name="close" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={() => router.push('/(tabs)/dashboard')} style={styles.iconButtonGhost}>
                <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Society Bulletin</Text>
              <TouchableOpacity onPress={() => setIsSearchExpanded(true)} style={styles.iconButtonGhost}>
                <Ionicons name="search" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {isManager && !isSearchExpanded && (
          <TouchableOpacity style={styles.adminPostBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle" size={17} color={COLORS.white} />
            <Text style={styles.adminPostBtnText}>POST NEW NOTICE</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tabPillWrap}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'Latest' && styles.tabButtonActive]} onPress={() => setActiveTab('Latest')}>
            <Text style={[styles.tabButtonText, activeTab === 'Latest' && styles.tabButtonTextActive]}>Latest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'Past' && styles.tabButtonActive]} onPress={() => setActiveTab('Past')}>
            <Text style={[styles.tabButtonText, activeTab === 'Past' && styles.tabButtonTextActive]}>Past</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {listBanner ? (
          <TouchableOpacity style={styles.okBanner} onPress={() => setListBanner(null)} activeOpacity={0.9}>
            <Ionicons name="checkmark-circle" size={18} color="#1d7a3a" />
            <Text style={styles.okBannerText}>{listBanner}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.sectionTitle}>{activeTab === 'Latest' ? 'Latest Notices' : 'Past Notices'}</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : filteredNotices.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={38} color={COLORS.slate[300]} />
            <Text style={styles.emptyText}>No {activeTab.toLowerCase()} notices.</Text>
          </View>
        ) : filteredNotices.map((notice) => {
          const urgent = notice.isUrgent && !notice.isExpired;
          return (
            <TouchableOpacity key={notice.id} style={[styles.noticeCard, urgent ? styles.noticeCardUrgent : styles.noticeCardNew]} activeOpacity={0.85} onPress={() => setSelected(notice)}>
              <View style={styles.noticeRow}>
                <View style={styles.noticeMain}>
                  <View style={styles.badgeRow}>
                    <View style={styles.catBadge}><Text style={styles.catBadgeText}>{CATEGORY_LABEL[notice.category] || 'General'}</Text></View>
                    {urgent ? <View style={styles.urgentBadge}><Ionicons name="alert" size={10} color={COLORS.white} /><Text style={styles.urgentBadgeText}>URGENT</Text></View> : null}
                    {notice.isExpired ? <View style={styles.expiredBadge}><Text style={styles.expiredBadgeText}>EXPIRED</Text></View> : null}
                  </View>
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                  <Text style={styles.noticeMeta} numberOfLines={1}>{notice.date} · {notice.postedBy}</Text>
                  {notice.details ? <Text style={styles.noticePreview} numberOfLines={2}>{notice.details}</Text> : null}

                  {notice.attachments && notice.attachments.length > 0 ? (
                    <View style={styles.cardAttachments}>
                      {notice.attachments.slice(0, 3).map((a, i) => (
                        a.type === 'image' ? (
                          <Image key={i} source={{ uri: a.url }} style={styles.attachThumb} />
                        ) : (
                          <View key={i} style={styles.docChip}>
                            <Ionicons name="document-text" size={14} color={COLORS.primary} />
                            <Text style={styles.docChipText} numberOfLines={1}>{a.name || 'Document'}</Text>
                          </View>
                        )
                      ))}
                    </View>
                  ) : null}

                  {/* An election notice is an instruction, so it gets the
                      action rather than making the resident hunt for it. */}
                  {routeForNotice(notice.link) && !notice.isExpired ? (
                    <TouchableOpacity
                      style={styles.voteCta}
                      onPress={() => router.push(routeForNotice(notice.link) as any)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkbox" size={15} color={COLORS.white} />
                      <Text style={styles.voteCtaText}>CAST YOUR VOTE</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.cardFooter}>
                    {isManager ? (
                      <View style={styles.readMeta}><Ionicons name="eye-outline" size={13} color={COLORS.slate[400]} /><Text style={styles.readMetaText}>{notice.ackCount} read</Text></View>
                    ) : notice.acknowledged ? (
                      <View style={styles.readTag}><Ionicons name="checkmark-circle" size={13} color="#1d7a3a" /><Text style={styles.readTagText}>Read</Text></View>
                    ) : (
                      <Text style={styles.tapToRead}>Tap to read →</Text>
                    )}
                  </View>
                </View>
                {isManager ? (
                  <TouchableOpacity onPress={() => deleteNotice(notice.id)} style={styles.deleteBtn} hitSlop={6}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Post New Notice</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalLabel}>Start from a template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
              {TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.label}
                  style={styles.templateChip}
                  onPress={() => { setNewTitle(t.title); setNewDescription(t.description); }}
                >
                  <Ionicons name="sparkles-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.templateChipText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Notice title..."
              placeholderTextColor={COLORS.slate[400]}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <Text style={styles.modalLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Add more details..."
              placeholderTextColor={COLORS.slate[400]}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Category</Text>
            <View style={styles.catChipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.catChip, newCategory === c && styles.catChipActive]} onPress={() => setNewCategory(c)}>
                  <Text style={[styles.catChipText, newCategory === c && styles.catChipTextActive]}>{CATEGORY_LABEL[c]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.urgentToggle} onPress={() => setNewUrgent(!newUrgent)} activeOpacity={0.8}>
              <View style={[styles.checkbox, newUrgent && styles.checkboxOn]}>{newUrgent && <Ionicons name="checkmark" size={14} color={COLORS.white} />}</View>
              <Ionicons name="alert-circle" size={18} color={COLORS.primary} />
              <Text style={styles.urgentToggleText}>Mark as urgent (pinned to top)</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Valid until (optional)</Text>
            <DatePickerField
              value={newValidTill}
              onChange={setNewValidTill}
              placeholder="Pick a date — moves to Past after it"
            />

            <Text style={styles.modalLabel}>Attachments</Text>
            <View style={styles.attachRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={pickImage} disabled={uploading}>
                <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                <Text style={styles.attachBtnText}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={pickDocument} disabled={uploading}>
                <Ionicons name="document-attach-outline" size={16} color={COLORS.primary} />
                <Text style={styles.attachBtnText}>Document</Text>
              </TouchableOpacity>
              {uploading ? <ActivityIndicator color={COLORS.primary} style={{ marginLeft: 8 }} /> : null}
            </View>

            {attachments.length > 0 ? (
              <View style={styles.attachList}>
                {attachments.map((a, i) => (
                  <View key={`${a.url}-${i}`} style={styles.attachChip}>
                    <Ionicons name={a.type === 'image' ? 'image' : 'document-text'} size={14} color={COLORS.primary} />
                    <Text style={styles.attachChipText} numberOfLines={1}>{a.name || (a.type === 'image' ? 'Image' : 'Document')}</Text>
                    <TouchableOpacity onPress={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Ionicons name="close-circle" size={16} color={COLORS.slate[400]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            </ScrollView>

            {formError ? (
              <View style={styles.formError}>
                <Ionicons name="alert-circle" size={17} color={COLORS.red} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.postBtn, (submitting || uploading) && { opacity: 0.6 }]} onPress={postNotice} disabled={submitting || uploading}>
                <Text style={styles.postBtnText}>{submitting ? 'Posting...' : 'Post Notice'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notice detail (full read) */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailBackdrop}>
          <View style={[styles.detailSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.detailHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.badgeRow}>
                <View style={styles.catBadge}><Text style={styles.catBadgeText}>{CATEGORY_LABEL[selected?.category || 'general']}</Text></View>
                {selected?.isUrgent && !selected?.isExpired ? <View style={styles.urgentBadge}><Ionicons name="alert" size={10} color={COLORS.white} /><Text style={styles.urgentBadgeText}>URGENT</Text></View> : null}
                {selected?.isExpired ? <View style={styles.expiredBadge}><Text style={styles.expiredBadgeText}>EXPIRED</Text></View> : null}
              </View>
              <Text style={styles.detailTitle}>{selected?.title}</Text>
              <Text style={styles.detailMeta}>{selected?.date} · Posted by {selected?.postedBy}</Text>
              {selected?.details ? <Text style={styles.detailBody}>{selected.details}</Text> : <Text style={styles.detailBodyMuted}>No additional details.</Text>}

              {selected?.attachments && selected.attachments.length > 0 ? (
                <>
                  <Text style={styles.detailSectionLabel}>ATTACHMENTS</Text>
                  <View style={styles.detailAttachments}>
                    {selected.attachments.map((a, i) => (
                      a.type === 'image' ? (
                        <TouchableOpacity key={i} onPress={() => Linking.openURL(a.url)}>
                          <Image source={{ uri: a.url }} style={styles.detailImage} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity key={i} style={styles.detailDoc} onPress={() => Linking.openURL(a.url)}>
                          <Ionicons name="document-text" size={18} color={COLORS.primary} />
                          <Text style={styles.detailDocText} numberOfLines={1}>{a.name || 'Document'}</Text>
                          <Ionicons name="open-outline" size={16} color={COLORS.slate[400]} />
                        </TouchableOpacity>
                      )
                    ))}
                  </View>
                </>
              ) : null}

              {routeForNotice(selected?.link) && !selected?.isExpired ? (
                <TouchableOpacity
                  style={styles.voteCtaLarge}
                  onPress={() => {
                    const to = routeForNotice(selected?.link);
                    setSelected(null);
                    if (to) router.push(to as any);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkbox" size={18} color={COLORS.white} />
                  <Text style={styles.voteCtaLargeText}>Cast Your Vote</Text>
                </TouchableOpacity>
              ) : null}

              {isManager ? (
                <View style={styles.readStat}>
                  <Ionicons name="people-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.readStatText}>{selected?.ackCount || 0} resident{(selected?.ackCount || 0) === 1 ? '' : 's'} acknowledged this notice</Text>
                </View>
              ) : selected?.acknowledged ? (
                <View style={styles.ackedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color="#1d7a3a" />
                  <Text style={styles.ackedText}>You've acknowledged this notice.</Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.ackBtn, acking && { opacity: 0.6 }]} disabled={acking} onPress={() => selected && acknowledge(selected)}>
                  {acking ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="checkmark-done" size={18} color={COLORS.white} /><Text style={styles.ackBtnText}>Mark as Read</Text></>}
                </TouchableOpacity>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.detailClose} onPress={() => setSelected(null)}>
              <Text style={styles.detailCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  voteCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, marginTop: 10,
  },
  voteCtaText: { color: COLORS.white, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  voteCtaLarge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, marginTop: 16,
  },
  voteCtaLargeText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24, paddingBottom: 12 },
  headerRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchExpandedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInputWrap: { flex: 1, height: 40, borderRadius: 20, backgroundColor: COLORS.white, justifyContent: 'center' },
  searchLeadingIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: { height: 40, paddingLeft: 38, paddingRight: 14, fontSize: 13, color: COLORS.dark },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  iconButtonGhost: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${COLORS.white}99`, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 21, fontWeight: '800', color: COLORS.dark },
  adminPostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 11, marginTop: 12,
  },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: `${COLORS.primary}40`, backgroundColor: `${COLORS.primary}0D` },
  attachBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  attachList: { gap: 6, marginTop: 10 },
  attachChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.slate[100] },
  attachChipText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.dark },
  cardAttachments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  attachThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: COLORS.slate[100] },
  docChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: `${COLORS.primary}12`, maxWidth: 180 },
  docChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  adminPostBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white, letterSpacing: 1 },
  tabPillWrap: { marginTop: 10, borderRadius: 999, padding: 4, backgroundColor: `${COLORS.white}80`, borderWidth: 1, borderColor: `${COLORS.primary}1A`, flexDirection: 'row' },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabButtonActive: { backgroundColor: COLORS.primary },
  tabButtonText: { fontSize: 13, fontWeight: '700', color: `${COLORS.primary}B3` },
  tabButtonTextActive: { color: COLORS.white },
  listContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24, gap: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.dark, marginBottom: 2 },
  noticeCard: { borderRadius: 14, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  noticeCardNew: { backgroundColor: COLORS.white, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  noticeCardPast: { backgroundColor: '#edf3df', borderLeftWidth: 3, borderLeftColor: COLORS.slate[400] },
  noticeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noticeMain: { flex: 1 },
  statusRow: { marginBottom: 5 },
  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusChipNew: { backgroundColor: `${COLORS.primary}1A` },
  statusChipClosed: { backgroundColor: COLORS.black },
  statusChipText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: COLORS.primary },
  statusChipTextClosed: { color: COLORS.white },
  noticeTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', lineHeight: 20 },
  noticeMeta: { marginTop: 4, fontSize: 12, color: COLORS.slate[500], fontWeight: '600' },
  noticeIconWrap: { marginLeft: 12, opacity: 0.8 },
  deleteBtn: { marginLeft: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: `${COLORS.red}15`, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, gap: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.slate[500] },
  templateRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}0D`, borderWidth: 1, borderColor: `${COLORS.primary}33` },
  templateChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  modalInput: { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  modalTextArea: { minHeight: 100, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.slate[200] },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate[500] },
  postBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary },
  postBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // ── enhancements ──
  formError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdecec', borderRadius: 12, padding: 12, marginTop: 6 },
  formErrorText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.red, lineHeight: 18 },
  okBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6f4eb', borderRadius: 12, padding: 12 },
  okBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1d7a3a' },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.slate[400], fontWeight: '600' },
  noticeCardUrgent: { backgroundColor: COLORS.white, borderLeftWidth: 3, borderLeftColor: COLORS.red },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  catBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: `${COLORS.primary}14` },
  catBadgeText: { fontSize: 9.5, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.6, textTransform: 'uppercase' },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.red },
  urgentBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  expiredBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.slate[200] },
  expiredBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 0.5 },
  noticePreview: { fontSize: 13, color: COLORS.slate[500], lineHeight: 18, marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  readMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readMetaText: { fontSize: 11, color: COLORS.slate[400], fontWeight: '700' },
  readTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readTagText: { fontSize: 11, color: '#1d7a3a', fontWeight: '800' },
  tapToRead: { fontSize: 11, color: COLORS.primary, fontWeight: '800' },

  catChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.slate[200] },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[600] },
  catChipTextActive: { color: COLORS.white },
  urgentToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: COLORS.slate[200] },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.slate[300], alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  urgentToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.dark },
  modalScroll: { maxHeight: 400 },

  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  detailHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.slate[300], marginBottom: 14 },
  detailTitle: { fontSize: 22, fontWeight: '900', color: COLORS.dark, marginTop: 4 },
  detailMeta: { fontSize: 12, color: COLORS.slate[500], marginTop: 4, marginBottom: 14, fontWeight: '600' },
  detailBody: { fontSize: 15, lineHeight: 23, color: COLORS.slate[800] },
  detailBodyMuted: { fontSize: 14, color: COLORS.slate[400], fontStyle: 'italic' },
  detailSectionLabel: { fontSize: 10, fontWeight: '800', color: COLORS.slate[400], letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  detailAttachments: { gap: 10 },
  detailImage: { width: '100%', height: 200, borderRadius: 14, backgroundColor: COLORS.slate[100] },
  detailDoc: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.slate[200] },
  detailDocText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.dark },
  readStat: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${COLORS.primary}12`, borderRadius: 12, padding: 14, marginTop: 20 },
  readStatText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  ackedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6f4eb', borderRadius: 12, padding: 14, marginTop: 20 },
  ackedText: { fontSize: 14, fontWeight: '700', color: '#1d7a3a' },
  ackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, marginTop: 20 },
  ackBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  detailClose: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  detailCloseText: { fontSize: 14, fontWeight: '800', color: COLORS.slate[500] },
});
