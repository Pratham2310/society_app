import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function MemberProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadMembers = async () => {
      if (!token) return;

      try {
        const res = await fetch(API.ALL_USERS, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !Array.isArray(json.users)) return;

        const mapped = json.users.map((user: any) => {
          const vehicles = Array.isArray(user.vehicles) ? user.vehicles : [];
          return {
            id: String(user._id),
            name: String(user.name || 'Resident'),
            unit: String(user.flatNumber || 'N/A'),
            role: user.societyrole === 'secretary' ? 'Secretary' : user.societyrole === 'treasurer' ? 'Treasurer' : 'Resident',
            status: String(user.livingType || 'Family'),
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
      } catch {
        // Leave empty when the backend is unavailable.
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [token]);

  const member = members.find((m: any) => m.id === id);

  if (loading && !member) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.primary} /></View>;
  }
  if (!member) {
    return (
      <View style={[styles.container, styles.center, { padding: 30 }]}>
        <Ionicons name="person-circle-outline" size={44} color={COLORS.slate[300]} />
        <Text style={styles.nfText}>Member not found.</Text>
        <TouchableOpacity style={styles.nfBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/members' as any))}><Text style={styles.nfBtnText}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const initial = String(member.name || 'R').trim()[0]?.toUpperCase() || 'R';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/members' as any))} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            {member.avatar ? (
              <Image source={{ uri: member.avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.unit}>{member.unit && member.unit !== 'N/A' ? `Flat ${member.unit}` : 'Unit not set'}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, (member.role === 'Secretary' || member.role === 'Treasurer') && styles.badgeHighlight]}>
              <Text style={[styles.badgeText, (member.role === 'Secretary' || member.role === 'Treasurer') && styles.badgeTextHighlight]}>{member.role}</Text>
            </View>
            {member.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={styles.infoCard}>
            {[
              { icon: 'home-outline', label: 'Occupancy', value: member.occupancyType },
              { icon: 'people-outline', label: 'Total Members', value: member.totalMembers.toString() },
              { icon: 'calendar-outline', label: 'Member Since', value: member.memberSince },
              { icon: 'call-outline', label: 'Mobile', value: member.mobile },
              { icon: 'mail-outline', label: 'Email', value: member.email },
            ].map((item, i) => (
              <View key={i} style={[styles.infoRow, i < 4 && styles.infoRowBorder]}>
                <Ionicons name={item.icon as any} size={20} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {member.vehicles.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionLabel}>VEHICLES</Text>
            {member.vehicles.map((v: any, i: number) => (
              <View key={i} style={styles.vehicleCard}>
                <Ionicons name={v.type === 'car' ? 'car' : 'bicycle'} size={24} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleModel}>{v.model}</Text>
                  <Text style={styles.vehicleNumber}>{v.number} • {v.slot}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {member.parkingSlots.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionLabel}>PARKING SLOTS</Text>
            <View style={styles.slotsRow}>
              {member.parkingSlots.map((slot: any, i: number) => (
                <View key={i} style={styles.slotChip}>
                  <Ionicons name="car" size={14} color={COLORS.primary} />
                  <Text style={styles.slotText}>{slot}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  nfText: { fontSize: 15, fontWeight: '700', color: COLORS.slate[500], marginTop: 6 },
  nfBtn: { marginTop: 10, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  nfBtnText: { color: COLORS.white, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  profileSection: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: `${COLORS.primary}1A`, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  avatarText: { fontSize: 34, fontWeight: '900', color: COLORS.primary },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.dark },
  unit: { fontSize: 14, color: COLORS.muted },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: COLORS.slate[100], borderRadius: 999 },
  badgeHighlight: { backgroundColor: `${COLORS.primary}1A` },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.slate[500], letterSpacing: 1 },
  badgeTextHighlight: { color: COLORS.primary },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: `${COLORS.primary}1A`, borderRadius: 999 },
  verifiedText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  infoSection: { paddingHorizontal: 24, marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.slate[400], letterSpacing: 3, marginBottom: 12, marginLeft: 4 },
  infoCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  infoLabel: { fontSize: 12, color: COLORS.slate[400], fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.white, padding: 16, borderRadius: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  vehicleModel: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  vehicleNumber: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  slotsRow: { flexDirection: 'row', gap: 8 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.white, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  slotText: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
});
