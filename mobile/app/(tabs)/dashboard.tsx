import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/Colors';
import { useAuth, useRole } from '../../context/AuthContext';

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { isManager, isSecretary } = useRole();
  const [pendingCount, setPendingCount] = useState(0);
  const [amenityPending, setAmenityPending] = useState(0);
  const [sosState, setSosState] = useState<'idle' | 'counting_down' | 'calling'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [profileName, setProfileName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [occupancy, setOccupancy] = useState<string>('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [urgentNotice, setUrgentNotice] = useState<{ id?: string; title: string; desc: string; date: string } | null>(null);
  const [announcementRows, setAnnouncementRows] = useState<{ category: string; time: string; title: string }[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (sosState === 'counting_down' && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (sosState === 'counting_down' && countdown === 0) {
      setSosState('calling');
    }
    return () => clearTimeout(timer);
  }, [sosState, countdown]);

  const loadDashboard = useCallback(async () => {
      if (!token) return;

      // Load pending member count for admin roles
      if (isSecretary) {
        try {
          const pr = await fetch(API.PENDING_USERS, { headers: { Authorization: `Bearer ${token}` } });
          const pj = await pr.json();
          if (pr.ok && Array.isArray(pj.users)) setPendingCount(pj.users.length);
        } catch { /* silent */ }
      }

      // Pending amenity booking approvals (secretary / committee)
      if (isManager) {
        try {
          const ar = await fetch(API.PENDING_AMENITY_BOOKINGS, { headers: { Authorization: `Bearer ${token}` } });
          const aj = await ar.json();
          if (ar.ok && Array.isArray(aj.data)) setAmenityPending(aj.data.length);
        } catch { /* silent */ }
      }

      // Real profile for the header (name, wing/flat, owner/tenant).
      try {
        const meRes = await fetch(API.ME, { headers: { Authorization: `Bearer ${token}` } });
        const meJson = await meRes.json();
        if (meRes.ok && meJson.data) {
          const d = meJson.data;
          if (d.name) setProfileName(String(d.name));
          const wing = d.wingName ? `Wing ${d.wingName}` : '';
          const flat = d.flatNumber ? `Flat ${d.flatNumber}` : '';
          setUnitLabel([wing, flat].filter(Boolean).join(' • '));
          setOccupancy(d.occupancyType === 'tenant' ? 'TENANT' : 'OWNER');
          setAvatar(d.avatar || null);
        }
      } catch { /* silent */ }

      try {
        const res = await fetch(API.DASHBOARD, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !json?.data) return;

        const dashboard = json.data;

        const n = dashboard.urgentNotice;
        setUrgentNotice(n ? {
          id: n._id ? String(n._id) : undefined,
          title: String(n.title || 'Notice'),
          desc: String(n.description || ''),
          date: n.createdAt
            ? new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '',
        } : null);

        setAnnouncementRows(
          (Array.isArray(dashboard.announcements) ? dashboard.announcements : []).slice(0, 3).map((item: any) => ({
            category: String(item.category || 'GENERAL').toUpperCase(),
            time: item.createdAt
              ? new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric' })
              : 'Recent',
            title: String(item.title || 'Announcement'),
          }))
        );
      } catch {
        // Leave the cards empty rather than showing invented content.
      }
  }, [token, isSecretary, isManager]);

  // Reload on focus so a newly uploaded profile photo / updated details show
  // as soon as the resident returns to Home.
  useFocusEffect(useCallback(() => { loadDashboard(); }, [loadDashboard]));

  const handleSosClick = () => { setSosState('counting_down'); setCountdown(5); };
  const cancelSos = () => { setSosState('idle'); setCountdown(5); };

  const quickActions = [
    { icon: 'people', label: 'Members', route: '/(tabs)/members' as const, tabRoute: true },
    { icon: 'location', label: 'Map', route: '/services' },
    { icon: 'shield-checkmark', label: 'Security', route: '/security', badge: true },
    { icon: 'construct', label: 'Maintenance', route: '/maintenance' },
    { icon: 'megaphone', label: 'Complaints', route: '/complaints' },
    { icon: 'headset', label: 'Help', route: '/helpline' },
    { icon: 'notifications', label: 'Notices', route: '/notices' },
    { icon: 'car', label: 'Parking', route: '/parking' },
    { icon: 'storefront', label: 'Nearby', route: '/nearby-services' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={[styles.headerSection, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.profileRow} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
            <View style={styles.avatarContainer}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {String(profileName || user?.name || 'R').trim()[0]?.toUpperCase() || 'R'}
                  </Text>
                </View>
              )}
            </View>
            <View>
              <Text style={styles.greeting}>Hi, {String(profileName || user?.name || 'Resident').trim().split(/\s+/)[0]}</Text>
              <Text style={styles.unit}>{unitLabel || (user?.flatNumber ? `Flat ${user.flatNumber}` : 'Your unit')}</Text>
              {occupancy ? (
                <View style={styles.badgeRow}>
                  <View style={[styles.ownerBadge, occupancy === 'TENANT' && styles.tenantBadge]}><Text style={styles.badgeText}>{occupancy}</Text></View>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications" size={24} color={COLORS.primary} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          {/* Urgent Notice */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Urgent Notice</Text>
              <TouchableOpacity onPress={() => router.push('/notices')}><Text style={styles.viewAll}>VIEW ALL</Text></TouchableOpacity>
            </View>
            {urgentNotice ? (
              <TouchableOpacity style={styles.noticeCard} onPress={() => router.push('/notices')} activeOpacity={0.85}>
                <View style={styles.noticeHeader}>
                  <Text style={styles.noticeTitle}>{urgentNotice.title}</Text>
                  <Ionicons name="information-circle" size={20} color={`${COLORS.dark}66`} />
                </View>
                {urgentNotice.desc ? <Text style={styles.noticeDesc} numberOfLines={3}>{urgentNotice.desc}</Text> : null}
                {urgentNotice.date ? (
                  <View style={styles.noticeDateRow}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.dark} />
                    <Text style={styles.noticeDateText}>{urgentNotice.date}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : (
              <View style={styles.noticeEmpty}>
                <Ionicons name="megaphone-outline" size={26} color={COLORS.slate[300]} />
                <Text style={styles.noticeEmptyText}>
                  No notices yet.{isManager ? ' Tap “Post Notice” below to publish one.' : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Admin Panel — visible to secretary / treasurer / superadmin only */}
          {isManager && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Manage Society</Text>
              <View style={styles.adminGrid}>
                {isSecretary && (
                  <TouchableOpacity style={[styles.adminCard, styles.adminCardHighlight]} onPress={() => router.push('/(tabs)/members')} activeOpacity={0.8}>
                    <View style={styles.adminCardIcon}><Ionicons name="people" size={22} color={COLORS.primary} /></View>
                    <Text style={styles.adminCardLabel}>Approvals</Text>
                    {pendingCount > 0 && (
                      <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>{pendingCount}</Text></View>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.adminCard}
                  onPress={() => router.push({ pathname: '/notices', params: { compose: '1' } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.adminCardIcon}><Ionicons name="megaphone" size={22} color={COLORS.primary} /></View>
                  <Text style={styles.adminCardLabel}>Post Notice</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adminCard} onPress={() => router.push('/event-create')} activeOpacity={0.8}>
                  <View style={styles.adminCardIcon}><Ionicons name="calendar" size={22} color={COLORS.primary} /></View>
                  <Text style={styles.adminCardLabel}>New Event</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adminCard} onPress={() => router.push('/community-funds')} activeOpacity={0.8}>
                  <View style={styles.adminCardIcon}><Ionicons name="wallet" size={22} color={COLORS.primary} /></View>
                  <Text style={styles.adminCardLabel}>Funds</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adminCard} onPress={() => router.push('/complaints')} activeOpacity={0.8}>
                  <View style={styles.adminCardIcon}><Ionicons name="construct" size={22} color={COLORS.primary} /></View>
                  <Text style={styles.adminCardLabel}>Complaints</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.adminCard, amenityPending > 0 && styles.adminCardHighlight]} onPress={() => router.push('/amenities')} activeOpacity={0.8}>
                  <View style={styles.adminCardIcon}><Ionicons name="business" size={22} color={COLORS.primary} /></View>
                  <Text style={styles.adminCardLabel}>{amenityPending > 0 ? 'Amenity Approvals' : 'Bookings'}</Text>
                  {amenityPending > 0 && (
                    <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>{amenityPending}</Text></View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickAction}
                  onPress={() => action.route && router.push(action.route as any)}
                >
                  <View style={styles.quickIconCircle}>
                    <Ionicons name={action.icon as any} size={24} color={COLORS.primary} />
                    {action.badge && <View style={styles.actionBadge} />}
                  </View>
                  <Text style={styles.quickLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Upcoming Events */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/events')}><Text style={styles.viewAll}>VIEW ALL</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.eventCard} onPress={() => router.push('/(tabs)/events')} activeOpacity={0.8}>
              <View style={styles.eventDateBox}>
                <Text style={styles.eventMonth}>FEB</Text>
                <Text style={styles.eventDay}>24</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>Community Clean Up</Text>
                <Text style={styles.eventLocation}>Main Garden Area</Text>
                <View style={styles.eventTimeRow}>
                  <View style={styles.eventTimeDot} />
                  <Text style={styles.eventTime}>8 AM</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Announcements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <View style={styles.announcementCard}>
              {announcementRows.length === 0 ? (
                <Text style={styles.noticeEmptyText}>No announcements yet.</Text>
              ) : null}
              {announcementRows.map((item, idx) => (
                <React.Fragment key={`${item.category}-${idx}`}>
                  <View style={styles.announcementItem}>
                    <View style={styles.announcementHeader}>
                      <Text style={styles.announcementTag}>{item.category}</Text>
                      <Text style={styles.announcementTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.announcementTitle}>{item.title}</Text>
                  </View>
                  {idx < announcementRows.length - 1 ? <View style={styles.divider} /> : null}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* SOS Button */}
      <TouchableOpacity style={[styles.sosBtn, { bottom: 24 + insets.bottom }]} onPress={handleSosClick} activeOpacity={0.8}>
        <Ionicons name="call" size={24} color={COLORS.white} />
      </TouchableOpacity>

      {/* SOS Overlay */}
      {sosState !== 'idle' && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.sosOverlay}>
          {sosState === 'counting_down' ? (
            <View style={styles.sosContent}>
              <View style={styles.sosIconCircle}>
                <Ionicons name="warning" size={64} color={COLORS.white} />
              </View>
              <Text style={styles.sosTitle}>SOS ALERT</Text>
              <Text style={styles.sosSubtitle}>Calling Security in...</Text>
              <Text style={styles.sosCountdown}>{countdown}</Text>
              <TouchableOpacity style={styles.sosCancelBtn} onPress={cancelSos}>
                <Text style={styles.sosCancelText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sosContent}>
              <View style={styles.sosIconCircle}>
                <Ionicons name="call" size={64} color={COLORS.white} />
              </View>
              <Text style={styles.sosTitle}>CALLING SECURITY</Text>
              <Text style={styles.sosSubtitle}>Connecting to Main Gate...</Text>
              <TouchableOpacity style={styles.sosCancelBtn} onPress={cancelSos}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name="close" size={24} color={COLORS.primary} />
                  <Text style={styles.sosCancelText}>END CALL</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerSection: {
    backgroundColor: COLORS.background, paddingHorizontal: 24, paddingBottom: 32,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarContainer: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.white },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { backgroundColor: `${COLORS.primary}1A`, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 26, fontWeight: '900', color: COLORS.primary },
  greeting: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  unit: { fontSize: 14, fontWeight: '500', opacity: 0.7, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  ownerBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLORS.accentGreen, borderRadius: 999 },
  tenantBadge: { backgroundColor: COLORS.surface },
  familyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: `${COLORS.black}33`, borderRadius: 999 },
  badgeText: { fontSize: 9, fontWeight: '700', color: COLORS.dark, letterSpacing: 2 },
  badgeText2: { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  notifBtn: {
    padding: 12, backgroundColor: COLORS.white, borderRadius: 999, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, backgroundColor: COLORS.red, borderRadius: 5, borderWidth: 2, borderColor: COLORS.white },
  mainContent: { paddingHorizontal: 24, gap: 32 },
  section: {},
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom:  0 },
  viewAll: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  noticeCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderLeftWidth: 4,
    borderLeftColor: COLORS.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  noticeEmpty: { alignItems: 'center', gap: 8, paddingVertical: 26, backgroundColor: COLORS.white, borderRadius: 16 },
  noticeEmptyText: { fontSize: 12.5, color: COLORS.slate[400], fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  noticeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  noticeTitle: { fontSize: 16, fontWeight: '700' },
  noticeDesc: { fontSize: 14, opacity: 0.7, lineHeight: 22, marginBottom: 16 },
  noticeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  noticeDateText: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  adminCard: {
    flex: 1, minWidth: '28%', backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 8, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  adminCardHighlight: { borderWidth: 1, borderColor: `${COLORS.primary}33` },
  adminCardIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  adminCardLabel: { fontSize: 11, fontWeight: '700', color: COLORS.dark, textAlign: 'center', letterSpacing: 0.5 },
  adminBadge: {
    position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  quickAction: { width: '25%', alignItems: 'center', marginBottom: 24 },
  quickIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  quickLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, textAlign: 'center', marginTop: 8 },
  actionBadge: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, backgroundColor: COLORS.primary, borderRadius: 6, borderWidth: 2, borderColor: COLORS.background },
  eventCard: {
    backgroundColor: COLORS.primary, borderRadius: 16, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  eventDateBox: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', minWidth: 70,
  },
  eventMonth: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  eventDay: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  eventTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  eventLocation: { fontSize: 14, fontWeight: '500', color: COLORS.white, opacity: 0.8 },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  eventTimeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: `${COLORS.white}66` },
  eventTime: { fontSize: 12, fontWeight: '700', color: COLORS.white, opacity: 0.7 },
  announcementCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 24, marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, gap: 24,
  },
  announcementItem: { gap: 8 },
  announcementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  announcementTag: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 2 },
  announcementTime: { fontSize: 10, fontWeight: '500', opacity: 0.6 },
  announcementTitle: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.background },
  sosBtn: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    backgroundColor: COLORS.primary, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  sosOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.primary, zIndex: 50, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  sosContent: { alignItems: 'center', gap: 16, width: '100%' },
  sosIconCircle: { width: 128, height: 128, borderRadius: 64, backgroundColor: `${COLORS.white}1A`, alignItems: 'center', justifyContent: 'center' },
  sosTitle: { fontSize: 32, fontWeight: '900', color: COLORS.white, letterSpacing: 4 },
  sosSubtitle: { fontSize: 18, fontWeight: '500', color: `${COLORS.white}CC` },
  sosCountdown: { fontSize: 80, fontWeight: '900', color: COLORS.white },
  sosCancelBtn: {
    marginTop: 48, paddingHorizontal: 48, paddingVertical: 16, backgroundColor: COLORS.white, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  sosCancelText: { fontSize: 20, fontWeight: '900', color: COLORS.primary, letterSpacing: 3 },
});
