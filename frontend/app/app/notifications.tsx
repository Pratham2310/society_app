import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { enableWebPush, webPushState, type WebPushState } from '../lib/push';

type NotificationCard = {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: { screen?: string; id?: string } | null;
};

// Map a notification's link/type to an in-app route.
function routeFor(n: NotificationCard): string | null {
  const screen = n.link?.screen;
  // Straight to the ballot, not to a list the resident then has to search.
  if (screen === 'elections')   return n.link?.id ? `/election-details?id=${n.link.id}` : '/elections';
  if (screen === 'amenities')   return '/amenities';
  if (screen === 'notices')     return '/notices';
  if (screen === 'complaints')  return '/complaints';
  if (screen === 'maintenance') return '/maintenance';
  if (screen === 'security')    return '/security';
  // Fallback by type
  if (n.type === 'fund' || n.type === 'payment' || n.type === 'maintenance') return '/(tabs)/finance';
  if (n.type === 'complaint') return '/complaints';
  if (n.type === 'election') return '/elections';
  if (n.type === 'notice' || n.type === 'announcement') return '/notices';
  if (n.type === 'event') return '/(tabs)/events';
  if (n.type === 'security' || n.type === 'visitor') return '/security';
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  // Starts empty. This list used to be seeded with four invented cards
  // ("Maintenance Due", "Complaint Resolved", …) that survived any fetch
  // failure — real residents were being shown notifications that never
  // happened, about money they may or may not owe.
  const [items, setItems] = useState<NotificationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Browser-notification opt-in state (web only; 'unsupported' on native).
  const [pushState, setPushState] = useState<WebPushState>('unsupported');
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') setPushState(webPushState());
  }, []);

  const turnOnPush = async () => {
    if (!token) return;
    setEnabling(true);
    try {
      // Called straight from the tap so Safari still sees the user gesture.
      await enableWebPush(token);
    } finally {
      setPushState(webPushState());
      setEnabling(false);
    }
  };

  useEffect(() => {
    const loadNotifications = async () => {
      if (!token) { setLoading(false); return; }

      try {
        const res = await fetch(API.NOTIFICATIONS, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !Array.isArray(json.data)) { setLoadError(true); return; }

        const mapped: NotificationCard[] = json.data.map((row: any) => ({
          id: String(row._id),
          title: String(row.title || 'Notification'),
          message: String(row.message || ''),
          type: String(row.type || 'general'),
          link: row.link || null,
        }));

        setItems(mapped);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Opt-in. Permission MUST be asked from a tap — Safari ignores a
            request made from a background effect, which is why this button
            exists rather than an automatic prompt on login. */}
        {pushState === 'prompt' ? (
          <TouchableOpacity style={styles.pushBanner} onPress={turnOnPush} disabled={enabling} activeOpacity={0.85}>
            <Ionicons name="notifications" size={20} color={COLORS.white} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pushTitle}>Turn on notifications</Text>
              <Text style={styles.pushSub}>Get notices, complaints and dues on this device.</Text>
            </View>
            {enabling ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="chevron-forward" size={18} color={COLORS.white} />}
          </TouchableOpacity>
        ) : null}

        {pushState === 'needs-install' ? (
          <View style={styles.pushInfo}>
            <Ionicons name="phone-portrait-outline" size={18} color="#922207" />
            <Text style={styles.pushInfoText}>
              To get alerts on iPhone, tap Share then “Add to Home Screen”, and open Grihive from there.
            </Text>
          </View>
        ) : null}

        {pushState === 'denied' ? (
          <View style={styles.pushInfo}>
            <Ionicons name="notifications-off-outline" size={18} color="#922207" />
            <Text style={styles.pushInfoText}>
              Notifications are blocked for this site. Allow them in your browser’s site settings to turn them back on.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.stateBox}><ActivityIndicator color="#922207" /></View>
        ) : null}

        {!loading && loadError ? (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={28} color={COLORS.slate[400]} />
            <Text style={styles.stateText}>Couldn’t load your notifications. Pull back and try again.</Text>
          </View>
        ) : null}

        {!loading && !loadError && items.length === 0 ? (
          <View style={styles.stateBox}>
            <Ionicons name="notifications-outline" size={28} color={COLORS.slate[400]} />
            <Text style={styles.stateText}>No notifications yet.</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const isFund = item.type === 'fund';
          const isComplaint = item.type === 'complaint';
          const isAnnouncement = item.type === 'announcement';

          const route = routeFor(item);

          const handlePress = () => {
            // Mark read (best-effort) then navigate to the relevant screen.
            if (token && !item.id.match(/^\d+$/)) {
              fetch(API.NOTIFICATION_READ(item.id), { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
            }
            if (route) router.push(route as any);
          };

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={route ? 0.7 : 1}
              onPress={handlePress}
              style={[
                styles.card,
                isFund && styles.alertCard,
                item.title.toLowerCase().includes('cleared') && styles.successCard,
              ]}
            >
              <Ionicons
                name={
                  isFund
                    ? 'alert-circle'
                    : isComplaint
                      ? 'construct'
                      : isAnnouncement
                        ? 'information-circle'
                        : 'notifications'
                }
                size={20}
                color={isFund ? COLORS.primary : isComplaint ? '#ea580c' : '#2563eb'}
              />
              <View style={{ flex: 1 }}>
                <Text style={isFund ? styles.alertTitle : styles.title}>{item.title}</Text>
                <Text style={isFund ? styles.alertText : styles.subText}>{item.message}</Text>
                {isFund && item.title.toLowerCase().includes('due') ? (
                  <TouchableOpacity style={styles.payBtn} onPress={() => router.push('/(tabs)/finance')}>
                    <Text style={styles.payBtnText}>PAY NOW</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {route ? <Ionicons name="chevron-forward" size={18} color={COLORS.slate[400]} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  pushBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#922207', borderRadius: 14, padding: 14, marginBottom: 12 },
  pushTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  pushSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  pushInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fdecea', borderRadius: 14, padding: 14, marginBottom: 12 },
  pushInfoText: { flex: 1, color: '#922207', fontSize: 13, lineHeight: 18 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  stateText: { color: COLORS.slate[500], fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  alertCard: { backgroundColor: `${COLORS.primary}12`, borderWidth: 1, borderColor: `${COLORS.primary}33` },
  successCard: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#bbf7d0' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  alertAmount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  alertText: { marginTop: 2, fontSize: 12, color: COLORS.primary },
  payBtn: { marginTop: 8, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  payBtnText: { color: COLORS.white, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  successTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
  successText: { marginTop: 2, fontSize: 12, color: '#15803d' },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  subText: { marginTop: 2, fontSize: 12, color: COLORS.slate[500] },
});
