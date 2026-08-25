import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { uploadPickedFile } from '../../lib/uploadImage';

type Profile = {
  name?: string; email?: string; phone?: string;
  flatNumber?: string; wingName?: string | null;
  occupancyType?: string; livingType?: string; familySize?: number;
  isVerified?: boolean; createdAt?: string;
  avatar?: string | null;
  vehicles?: any[];
  pendingProfile?: { changes?: Record<string, any>; requestedAt?: string } | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(API.ME, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.data) setProfile(json.data);
    } catch {
      /* keep whatever we have */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Gallery access needed', 'Please allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      // Upload to Cloudinary via the backend, then save the URL on the profile.
      const fileUrl = await uploadPickedFile({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType }, token!);

      const res = await fetch(API.ME_AVATAR, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: fileUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not save photo');
      setProfile((prev) => ({ ...(prev || {}), avatar: json.avatar || fileUrl }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update your photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const p = profile || {};
  const displayName = p.name ?? user?.name ?? 'Resident';
  const displayPhone = (p.phone ?? user?.phone) ? `+91 ${p.phone ?? user?.phone}` : 'N/A';
  const displayEmail = p.email ?? user?.email ?? 'N/A';
  const wingLabel = p.wingName
    ? `Wing ${p.wingName}${p.flatNumber ? ` · Flat ${p.flatNumber}` : ''}`
    : (p.flatNumber ? `Flat ${p.flatNumber}` : 'Unit not set');
  const isVerified = Boolean(p.isVerified ?? user?.isVerified);
  const isOwner = (p.occupancyType ?? 'owner') !== 'tenant';
  const memberSince = p.createdAt
    ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const familyCount = p.familySize ?? 1;
  const vehicleCount = Array.isArray(p.vehicles) ? p.vehicles.length : 0;
  const initial = displayName.trim()[0]?.toUpperCase() || 'R';
  const hasPending = Boolean(p.pendingProfile?.changes && Object.keys(p.pendingProfile.changes).length);

  const menuItems = [
    { icon: 'person-outline', label: 'My Profile', route: '/edit-profile' },
    { icon: 'car-outline', label: 'My Vehicles', route: '/my-vehicles' },
    { icon: 'wallet-outline', label: 'Payment History', route: '/maintenance' },
    { icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
    { icon: 'help-circle-outline', label: 'Help & Support', route: '/helpline' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={[styles.profileHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.avatarContainer}>
            {p.avatar ? (
              <Image source={{ uri: p.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            )}
            <TouchableOpacity style={styles.cameraBtn} onPress={changePhoto} disabled={uploadingAvatar} activeOpacity={0.8}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="camera" size={15} color={COLORS.white} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileUnit}>{wingLabel}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.ownerBadge, !isOwner && styles.tenantBadge]}>
              <Text style={styles.badgeText}>{isOwner ? 'OWNER' : 'TENANT'}</Text>
            </View>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            )}
          </View>
        </View>

        {loading && !profile ? <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 16 }} /> : null}

        {hasPending ? (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={styles.pendingBannerText}>Profile changes are awaiting secretary approval.</Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{familyCount}</Text>
            <Text style={styles.statLabel}>FAMILY</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{vehicleCount}</Text>
            <Text style={styles.statLabel}>VEHICLES</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{memberSince}</Text>
            <Text style={styles.statLabel}>MEMBER SINCE</Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{displayPhone}</Text>
              </View>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{displayEmail}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.menuRow, i < menuItems.length - 1 && styles.menuRowBorder]}
                onPress={() => item.route && router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon as any} size={22} color={COLORS.dark} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.slate[300]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/'); }}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.red} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileHeader: { alignItems: 'center', paddingBottom: 20, gap: 8 },
  avatarContainer: { marginBottom: 8, position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: `${COLORS.primary}1A`, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.white },
  avatarText: { fontSize: 38, fontWeight: '900', color: COLORS.primary },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  profileName: { fontSize: 24, fontWeight: '800', color: COLORS.dark },
  profileUnit: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  ownerBadge: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: COLORS.accentGreen, borderRadius: 999 },
  tenantBadge: { backgroundColor: COLORS.surface },
  badgeText: { fontSize: 10, fontWeight: '800', color: COLORS.dark, letterSpacing: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: `${COLORS.primary}1A`, borderRadius: 999 },
  verifiedText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 18, backgroundColor: `${COLORS.primary}12`, borderRadius: 12, padding: 12 },
  pendingBannerText: { flex: 1, fontSize: 12.5, color: COLORS.primary, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.white, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.slate[400], letterSpacing: 1, marginTop: 4 },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 12 },
  infoCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: COLORS.slate[400], fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  infoDivider: { height: 1, backgroundColor: COLORS.background, marginVertical: 12 },
  menuCard: { backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.dark },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: `${COLORS.red}0D`, borderRadius: 16 },
  logoutText: { fontSize: 16, fontWeight: '700', color: COLORS.red },
});
