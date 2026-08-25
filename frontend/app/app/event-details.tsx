import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function EventDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  // Every event now comes from the API, so the id is always real. There is no
  // longer a "demo mode": it let RSVPs toggle in local state only, which is
  // why tapping "I'm attending" looked fine until the screen reloaded.
  const eventId = params.id ? String(params.id) : null;

  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [attending, setAttending] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(32);
  const [fee, setFee] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [paidCount, setPaidCount] = useState(0);
  const [payLoading, setPayLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  // Alert.alert is a no-op on the web build, so RSVP results are shown here.
  const [notice, setNotice] = useState<string | null>(null);

  const [event, setEvent] = useState({
    title: '', subtitle: '', type: 'Society', date: '', time: '',
    location: '', organizer: '', description: '',
  });

  const load = useCallback(async () => {
    if (!eventId || !token) { setLoading(false); setLoadError('Event not found.'); return; }
    try {
      const res = await fetch(API.EVENT(eventId), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      const d = json?.data;
      if (!res.ok || !d) throw new Error(json.error || json.message || 'Could not load this event.');

      const dt = d.eventDate ? new Date(d.eventDate) : new Date();
      setEvent({
        title: String(d.title || 'Society Event'),
        subtitle: d.eventType === 'Social' ? 'A community get-together' : 'A society event',
        type: d.eventType === 'Social' ? 'Social' : 'Society',
        date: dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        time: String(d.time || dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })),
        location: String(d.location || 'Society Premises'),
        organizer: String(d.hostName || 'Society Committee'),
        description: String(d.description || 'No description provided.'),
      });
      setAttendeeCount(Number(d.attendeeCount || 0));
      setAttending(Boolean(d.isAttending));
      setFee(Number(d.fee || 0));
      setIsPaid(Boolean(d.isPaid));
      setPaidCount(Number(d.paidCount || 0));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(
        /failed to fetch|network/i.test(String(e?.message))
          ? 'Couldn’t reach the server. Pull back and try again.'
          : String(e?.message || 'Could not load this event.')
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, token]);

  // Refetch whenever the screen comes back into view, so the RSVP state shown
  // is always the one on the server.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRsvp = async () => {
    if (!eventId || !token) return;
    setRsvpLoading(true);
    setNotice(null);
    try {
      const res = await fetch(API.EVENT_RSVP(eventId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || json.message || 'Could not update RSVP');
      setAttending(Boolean(json.data?.attending));
      setAttendeeCount(Number(json.data?.attendeeCount ?? attendeeCount));
      setNotice(json.data?.attending ? 'You’re on the list — see you there.' : 'RSVP cancelled.');
    } catch (err: any) {
      setNotice(
        /failed to fetch|network/i.test(String(err?.message))
          ? 'Couldn’t reach the server, so your RSVP wasn’t saved. Try again.'
          : String(err?.message || 'Could not update RSVP')
      );
    } finally {
      setRsvpLoading(false);
    }
  };

  const handlePay = async () => {
    if (!eventId || !token) return;
    setPayLoading(true);
    try {
      const res = await fetch(API.EVENT_PAY(eventId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Could not update payment');
      setIsPaid(Boolean(json.data?.paid));
      setPaidCount(Number(json.data?.paidCount ?? paidCount));
      setNotice(json.data?.paid ? 'Marked as paid.' : 'Payment mark removed.');
    } catch (err: any) {
      setNotice(String(err?.message || 'Could not update payment'));
    } finally {
      setPayLoading(false);
    }
  };

  const rows = [
    { icon: 'calendar', label: 'Date', value: event.date },
    { icon: 'time', label: 'Time', value: event.time },
    { icon: 'location', label: 'Location', value: event.location },
    { icon: 'people', label: 'Organizer', value: event.organizer },
    { icon: 'person', label: 'Attending', value: `${attendeeCount} member${attendeeCount === 1 ? '' : 's'}` },
    ...(fee > 0
      ? [{ icon: 'cash', label: 'Entry Fee', value: `₹${fee.toLocaleString('en-IN')} · ${paidCount} paid` }]
      : []),
  ];

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (loadError && !event.title) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }]}>
        <Ionicons name="calendar-outline" size={38} color={COLORS.slate[400]} />
        <Text style={styles.errText}>{loadError}</Text>
        <TouchableOpacity style={styles.errBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/events' as any))}>
          <Text style={styles.errBtnText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/events' as any))} style={styles.backBtn}><Ionicons name="chevron-back" size={20} color={COLORS.dark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        {notice ? (
          <TouchableOpacity style={styles.notice} onPress={() => setNotice(null)} activeOpacity={0.9}>
            <Ionicons name="information-circle" size={18} color={COLORS.primary} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Ionicons name="close" size={15} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.heroCard}>
          <Text style={styles.heroTag}>{event.type.toUpperCase()} EVENT</Text>
          <Text style={styles.heroTitle}>{event.title}</Text>
          <Text style={styles.heroSubtitle}>{event.subtitle}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
        ) : null}

        <View style={styles.detailsCard}>
          {rows.map((item, i) => (
            <View key={i} style={[styles.detailRow, i < rows.length - 1 && styles.detailRowBorder]}>
              <Ionicons name={item.icon as any} size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>About This Event</Text>
        <Text style={styles.aboutText}>{event.description}</Text>

        <TouchableOpacity
          style={[styles.rsvpBtn, attending && styles.rsvpBtnActive, rsvpLoading && { opacity: 0.6 }]}
          onPress={handleRsvp}
          disabled={rsvpLoading}
          activeOpacity={0.85}
        >
          {rsvpLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name={attending ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={COLORS.white} />
              <Text style={styles.rsvpBtnText}>{attending ? "You're Attending" : "RSVP - I'm Attending"}</Text>
            </>
          )}
        </TouchableOpacity>

        {fee > 0 && eventId ? (
          <TouchableOpacity
            style={[styles.payBtn, isPaid && styles.payBtnPaid, payLoading && { opacity: 0.6 }]}
            onPress={handlePay}
            disabled={payLoading}
            activeOpacity={0.85}
          >
            {payLoading ? (
              <ActivityIndicator color={isPaid ? '#1d7a3a' : COLORS.primary} />
            ) : (
              <>
                <Ionicons name={isPaid ? 'checkmark-circle' : 'card-outline'} size={20} color={isPaid ? '#1d7a3a' : COLORS.primary} />
                <Text style={[styles.payBtnText, isPaid && { color: '#1d7a3a' }]}>
                  {isPaid ? `Paid ₹${fee.toLocaleString('en-IN')} · tap to undo` : `Mark Fee Paid (₹${fee.toLocaleString('en-IN')})`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.wallBtn}
          onPress={() => router.push({
            pathname: '/contributors-wall',
            params: { eventId: String(eventId), eventTitle: event.title },
          } as any)}
        >
          <Ionicons name="trophy" size={18} color={COLORS.primary} />
          <Text style={styles.wallBtnText}>View Contributors Wall</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, gap: 8, marginBottom: 24 },
  heroTag: { fontSize: 10, fontWeight: '700', color: `${COLORS.white}99`, letterSpacing: 2 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: COLORS.white },
  heroSubtitle: { fontSize: 14, color: `${COLORS.white}CC` },
  detailsCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  detailLabel: { fontSize: 12, color: COLORS.slate[400] },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  aboutText: { fontSize: 14, color: COLORS.slate[500], lineHeight: 24, marginBottom: 24 },
  rsvpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: COLORS.primary, borderRadius: 12 },
  rsvpBtnActive: { backgroundColor: '#1d7a3a' },
  rsvpBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  payBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 12, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}0D` },
  payBtnPaid: { borderColor: '#1d7a3a', backgroundColor: '#e6f4eb' },
  payBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  wallBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
  },
  wallBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#9A3412', lineHeight: 18 },
  errText: { fontSize: 14, color: COLORS.slate[600], textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  errBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.white },
  errBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: COLORS.slate[600] },
});
