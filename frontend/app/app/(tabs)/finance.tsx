import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/Colors';
import { PERM, useAuth, useRole } from '../../context/AuthContext';

export default function FinanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  // The backend gates the money screens on finance.manage,
  // which is not the same set as the old isManager grouping —
  // it let a treasurer see controls that would 403, and hid
  // them from a committee member who does hold the permission.
  const isManager = can(PERM.FINANCE_MANAGE);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [dueAmount, setDueAmount] = useState(150);
  const [societyBalance, setSocietyBalance] = useState(12400);

  const [activities, setActivities] = useState([
    { id: 1, title: 'You paid March Maintenance', time: 'Today, 2:45 PM', amount: '₹150', icon: 'checkmark-circle', iconBg: '#dcfce7', iconColor: '#16a34a' },
    { id: 2, title: 'Secretary paid Watchman Salary', time: 'Yesterday, 10:15 AM', amount: '₹450', icon: 'cash', iconBg: '#f1f5f9', iconColor: '#475569' },
    { id: 3, title: 'Unit 402 paid Maintenance', time: 'Mar 12, 2024', amount: '₹150', icon: 'business', iconBg: '#dbeafe', iconColor: '#2563eb' },
  ]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(API.FINANCE_OVERVIEW, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.data) return;

      setDueAmount(Number(json.data.dueAmount || 0));
      setSocietyBalance(Number(json.data.societyBalance || 0));

      if (Array.isArray(json.data.activities) && json.data.activities.length) {
        const mapped = json.data.activities.map((item: any, index: number) => ({
          id: index + 1,
          title: String(item.title || 'Contribution update'),
          time: String(item.time || 'Recent'),
          amount: `₹${Number(item.amount || 0).toLocaleString('en-IN')}`,
          icon: String(item.title || '').toLowerCase().includes('paid') ? 'checkmark-circle' : 'cash',
          iconBg: String(item.title || '').toLowerCase().includes('paid') ? '#dcfce7' : '#f1f5f9',
          iconColor: String(item.title || '').toLowerCase().includes('paid') ? '#16a34a' : '#475569',
        }));
        setActivities(mapped);
      }
    } catch {
      // Keep default finance cards when backend is unavailable.
    }
  }, [token]);

  // Refresh on focus so a new contribution shows in the overview immediately.
  useFocusEffect(useCallback(() => { loadOverview(); }, [loadOverview]));

  const filteredActivities = useMemo(
    () => activities.filter((activity) => activity.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [activities, searchQuery],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}> 
        {isSearchExpanded ? (
          <View style={styles.searchExpandedRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={18} color={COLORS.slate[400]} style={styles.searchLeadingIcon} />
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search finance..."
                placeholderTextColor={COLORS.slate[400]}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setIsSearchExpanded(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close" size={20} color={COLORS.dark} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/dashboard')}>
              <Ionicons name="arrow-back" size={20} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Finance</Text>
            <TouchableOpacity style={styles.iconButton} onPress={() => setIsSearchExpanded(true)}>
              <Ionicons name="search" size={20} color={COLORS.dark} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Admin quick-actions bar — secretary / treasurer / superadmin only */}
      {isManager && (
        <View style={styles.adminBar}>
          <TouchableOpacity style={styles.adminBarBtn} onPress={() => router.push('/community-funds')} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={styles.adminBarBtnText}>New Fund</Text>
          </TouchableOpacity>
          <View style={styles.adminBarDivider} />
          <TouchableOpacity style={styles.adminBarBtn} onPress={() => router.push('/maintenance-hub')} activeOpacity={0.8}>
            <Ionicons name="receipt" size={18} color={COLORS.white} />
            <Text style={styles.adminBarBtnText}>Add Expense</Text>
          </TouchableOpacity>
          <View style={styles.adminBarDivider} />
          <TouchableOpacity style={styles.adminBarBtn} onPress={() => router.push('/contributors-wall')} activeOpacity={0.8}>
            <Ionicons name="people" size={18} color={COLORS.white} />
            <Text style={styles.adminBarBtnText}>Contributors</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summarySplitRight}>
            <Text style={styles.summaryLabel}>YOUR DUES</Text>
            <Text style={styles.summaryValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summarySplitLeft}>
            <Text style={styles.summaryLabel}>SOCIETY BALANCE</Text>
            <Text style={styles.summaryValue}>₹{societyBalance.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.microTitle}>CATEGORIES</Text>
          <View style={styles.categoryGrid}>
            <TouchableOpacity style={styles.categoryCard} onPress={() => router.push('/maintenance')}>
              <View style={styles.categoryIconWrap}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.slate[600]} />
              </View>
              <Text style={styles.categoryTitle}>Maintenance & Bills</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryCard} onPress={() => router.push('/community-funds')}>
              <View style={styles.categoryIconWrap}>
                <Ionicons name="business-outline" size={24} color={COLORS.slate[600]} />
              </View>
              <Text style={styles.categoryTitle}>Community Funds</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.microTitle}>RECENT ACTIVITY</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>VIEW ALL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityStack}>
            {filteredActivities.map((activity) => (
              <View key={activity.id} style={styles.activityRow}>
                <View style={[styles.activityIconWrap, { backgroundColor: activity.iconBg }]}> 
                  <Ionicons name={activity.icon as any} size={23} color={activity.iconColor} />
                </View>
                <View style={styles.activityMain}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
                <Text style={styles.activityAmount}>{activity.amount}</Text>
              </View>
            ))}

            {!filteredActivities.length ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No finance records found</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  adminBar: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    marginHorizontal: 24, marginBottom: 12, borderRadius: 14,
    overflow: 'hidden',
  },
  adminBarBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  adminBarBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  adminBarDivider: { width: 1, backgroundColor: `${COLORS.white}33`, marginVertical: 10 },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingBottom: 12, paddingHorizontal: 24 },
  headerRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.dark, paddingHorizontal: 16, flex: 1, textAlign: 'center' },
  searchExpandedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInputWrap: { flex: 1, height: 40, borderRadius: 20, backgroundColor: COLORS.white, justifyContent: 'center' },
  searchLeadingIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: { height: 40, paddingLeft: 38, paddingRight: 14, fontSize: 13, color: COLORS.dark },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 28, gap: 28 },
  summaryCard: { marginTop: 4, backgroundColor: COLORS.dark, borderRadius: 32, paddingVertical: 30, paddingHorizontal: 18, flexDirection: 'row' },
  summarySplitRight: { flex: 1, paddingRight: 12, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  summarySplitLeft: { flex: 1, paddingLeft: 16 },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  summaryValue: { fontSize: 39, lineHeight: 42, fontWeight: '700', color: COLORS.white },
  microTitle: { fontSize: 11, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 2, marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', gap: 12 },
  categoryCard: { flex: 1, backgroundColor: COLORS.accentGreen, borderRadius: 32, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  categoryIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  categoryTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.dark },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  viewAll: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 1.5 },
  activityStack: { gap: 10 },
  activityRow: { backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', padding: 16, flexDirection: 'row', alignItems: 'center' },
  activityIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityMain: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  activityTime: { marginTop: 2, fontSize: 10, fontWeight: '700', letterSpacing: 1, color: COLORS.slate[400], textTransform: 'uppercase' },
  activityAmount: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  emptyState: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  emptyStateText: { color: COLORS.slate[500], fontWeight: '600' },
});
