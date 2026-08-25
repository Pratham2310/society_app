import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { PERM, useAuth, useRole } from '../context/AuthContext';

const BUDGET = [
  { item: 'Murti (Idol)', cost: '500', status: 'Pledged' },
  { item: 'Sweets', cost: '500', status: 'Pending' },
  { item: 'Decoration', cost: '1,000', status: 'In Progress' },
];

type Campaign = {
  id: string;
  title: string;
  goal: string;
  progress: number;
  image: string;
  rawGoal?: number;
};

type MainCampaign = {
  id: string;
  title: string;
  goal: number;
  raised: number;
  progress: number;
};

export default function CommunityFundsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  // The backend gates funds on finance.manage,
  // which is not the same set as the old isManager grouping —
  // it let a treasurer see controls that would 403, and hid
  // them from a committee member who does hold the permission.
  const isManager = can(PERM.FINANCE_MANAGE);
  const [search, setSearch] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [editingFund, setEditingFund] = useState<Campaign | null>(null);
  const [fundTitle, setFundTitle] = useState('');
  const [fundGoal, setFundGoal] = useState('');
  const [fundDescription, setFundDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: '1', title: 'Community Library', goal: '25,000', progress: 40, image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=200&h=150', rawGoal: 25000 },
    { id: '2', title: 'Summer Sports Day', goal: '15,000', progress: 20, image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&h=150', rawGoal: 15000 },
  ]);

  const [mainCampaign, setMainCampaign] = useState<MainCampaign>({
    id: 'main',
    title: 'Ganesh Utsav 2026',
    goal: 100000,
    raised: 65000,
    progress: 65,
  });

  const loadCampaigns = async () => {
    if (!token) return;
    try {
      const res = await fetch(API.FUND_CAMPAIGNS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data) || !json.data.length) return;

      const mapped = json.data.map((item: any, index: number) => ({
        id: String(item.id || item._id || index),
        title: String(item.title || 'Community Campaign'),
        rawGoal: Number(item.goal || 0),
        goal: Number(item.goal || 0).toLocaleString('en-IN'),
        progress: Number(item.progress || 0),
        image: `https://picsum.photos/seed/fund-${index + 1}/200/150`,
        raised: Number(item.raised || 0),
      }));

      setCampaigns(mapped);
      const top = mapped[0];
      setMainCampaign({ id: top.id, title: top.title, goal: top.rawGoal, raised: top.raised, progress: top.progress });
    } catch {
      // Keep static campaigns fallback.
    }
  };

  // Refresh whenever the screen refocuses (e.g. after making a contribution).
  useFocusEffect(useCallback(() => { loadCampaigns(); }, [token]));

  const openCreateModal = () => {
    setEditingFund(null);
    setFundTitle('');
    setFundGoal('');
    setFundDescription('');
    setShowFundModal(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingFund(campaign);
    setFundTitle(campaign.title);
    setFundGoal(String(campaign.rawGoal ?? ''));
    setFundDescription('');
    setShowFundModal(true);
  };

  const saveFund = async () => {
    if (!fundTitle.trim()) {
      Alert.alert('Missing title', 'Please enter a fund title.');
      return;
    }
    const goalNum = Number(fundGoal);
    if (!fundGoal || isNaN(goalNum) || goalNum <= 0) {
      Alert.alert('Invalid goal', 'Please enter a valid goal amount.');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      const body = { title: fundTitle.trim(), goal: goalNum, description: fundDescription.trim() };
      const isEdit = !!editingFund;
      const url = isEdit ? API.FUND_CAMPAIGN(editingFund!.id) : API.FUND_CAMPAIGNS;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Error', json.message || 'Could not save fund.');
        return;
      }
      setShowFundModal(false);
      loadCampaigns();
    } catch {
      Alert.alert('Network error', 'Could not connect to backend server.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteFund = (campaign: Campaign) => {
    Alert.alert('Delete Fund', `Delete "${campaign.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            const res = await fetch(API.FUND_CAMPAIGN(campaign.id), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
            } else {
              const json = await res.json();
              Alert.alert('Error', json.message || 'Could not delete fund.');
            }
          } catch {
            Alert.alert('Network error', 'Could not connect to backend server.');
          }
        },
      },
    ]);
  };

  const filtered = useMemo(
    () => campaigns.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/finance' as any))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Funds</Text>
        {isManager ? (
          <TouchableOpacity style={styles.createHeaderBtn} onPress={openCreateModal}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search funds"
          placeholderTextColor={COLORS.slate[400]}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.mainCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1567591974574-e85263d47316?auto=format&fit=crop&w=900&q=80' }} style={styles.coverImage} />
          <View style={styles.mainBody}>
            <Text style={styles.mainTitle}>{mainCampaign.title}</Text>
            <Text style={styles.mainHint}>Community fundraising for the upcoming festival.</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${mainCampaign.progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {mainCampaign.raised.toLocaleString('en-IN')} raised of {mainCampaign.goal.toLocaleString('en-IN')} target
            </Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/fund-details' as any, params: { id: mainCampaign.id } })}>
              <Text style={styles.breakdownLink}>VIEW CONTRIBUTORS & PROGRESS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/contribute')}>
              <Text style={styles.primaryBtnText}>CONTRIBUTE NOW</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Upcoming Campaigns</Text>
          {isManager && (
            <TouchableOpacity style={styles.addCampaignBtn} onPress={openCreateModal}>
              <Ionicons name="add" size={14} color={COLORS.primary} />
              <Text style={styles.addCampaignBtnText}>New Fund</Text>
            </TouchableOpacity>
          )}
        </View>

        {filtered.map((item) => (
          <View key={item.id} style={styles.campaignCard}>
            <TouchableOpacity
              style={styles.campaignCardInner}
              onPress={() => router.push({ pathname: '/fund-details' as any, params: { id: item.id } })}
              activeOpacity={0.8}
            >
              <Image source={{ uri: item.image }} style={styles.campaignImage} />
              <View style={{ flex: 1 }}>
                <Text style={styles.campaignTitle}>{item.title}</Text>
                <Text style={styles.campaignGoal}>Goal: {item.goal}</Text>
                <View style={styles.campaignTrack}>
                  <View style={[styles.campaignFill, { width: `${item.progress}%` }]} />
                </View>
              </View>
              {!isManager && <Ionicons name="chevron-forward" size={18} color={COLORS.slate[400]} />}
            </TouchableOpacity>
            {isManager && (
              <View style={styles.campaignManagerRow}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
                  <Ionicons name="pencil" size={14} color={COLORS.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteFundBtn} onPress={() => deleteFund(item)}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.red} />
                  <Text style={styles.deleteFundBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Budget Breakdown Modal */}
      <Modal visible={showBreakdown} transparent animationType="slide" onRequestClose={() => setShowBreakdown(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Budget Breakdown</Text>
            {BUDGET.map((row) => (
              <View key={row.item} style={styles.budgetRow}>
                <Text style={styles.budgetItem}>{row.item}</Text>
                <Text style={styles.budgetCost}>{row.cost}</Text>
                <Text style={styles.budgetStatus}>{row.status}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowBreakdown(false)}>
              <Text style={styles.primaryBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create / Edit Fund Modal */}
      <Modal visible={showFundModal} transparent animationType="slide" onRequestClose={() => setShowFundModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingFund ? 'Edit Fund' : 'Create New Fund'}</Text>
            <Text style={styles.modalLabel}>Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Fund title..."
              placeholderTextColor={COLORS.slate[400]}
              value={fundTitle}
              onChangeText={setFundTitle}
            />
            <Text style={styles.modalLabel}>Goal Amount (₹)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50000"
              placeholderTextColor={COLORS.slate[400]}
              value={fundGoal}
              onChangeText={setFundGoal}
              keyboardType="numeric"
            />
            <Text style={styles.modalLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="What is this fund for?"
              placeholderTextColor={COLORS.slate[400]}
              value={fundDescription}
              onChangeText={setFundDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowFundModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, submitting && { opacity: 0.6 }]} onPress={saveFund} disabled={submitting}>
                <Text style={styles.saveBtnText}>{submitting ? 'Saving...' : editingFund ? 'Update' : 'Create Fund'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, paddingHorizontal: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  createHeaderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.dark },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  searchInput: { height: 46, borderRadius: 999, backgroundColor: COLORS.white, paddingHorizontal: 14, color: COLORS.dark, fontSize: 14, marginBottom: 16 },
  mainCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.white, marginBottom: 24 },
  coverImage: { width: '100%', height: 170 },
  mainBody: { padding: 16 },
  mainTitle: { fontSize: 22, fontWeight: '800', color: COLORS.dark },
  mainHint: { fontSize: 12, color: COLORS.slate[500], marginTop: 4 },
  progressTrack: { marginTop: 14, height: 8, borderRadius: 6, backgroundColor: COLORS.slate[100], overflow: 'hidden' },
  progressFill: { width: '65%', height: '100%', backgroundColor: COLORS.primary },
  progressText: { marginTop: 8, fontSize: 11, color: COLORS.slate[500], fontWeight: '600' },
  breakdownLink: { marginTop: 14, color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  primaryBtn: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  addCampaignBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
  addCampaignBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  campaignCard: { backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  campaignCardInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  campaignImage: { width: 52, height: 52, borderRadius: 10 },
  campaignTitle: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  campaignGoal: { fontSize: 11, color: COLORS.slate[400], marginTop: 2 },
  campaignTrack: { height: 5, borderRadius: 3, backgroundColor: COLORS.slate[100], marginTop: 8, overflow: 'hidden' },
  campaignFill: { height: '100%', backgroundColor: COLORS.slate[300] },
  campaignManagerRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.slate[100] },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  deleteFundBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: COLORS.slate[100] },
  deleteFundBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.slate[500] },
  modalInput: { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.slate[200] },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate[500] },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  budgetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.slate[100] },
  budgetItem: { fontSize: 14, color: COLORS.dark, width: '45%' },
  budgetCost: { fontSize: 14, fontWeight: '700', color: COLORS.dark, width: '20%' },
  budgetStatus: { fontSize: 11, fontWeight: '700', color: COLORS.primary, width: '35%', textAlign: 'right' },
});
