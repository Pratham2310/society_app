import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/Colors';
import { useAuth, useRole } from '../../context/AuthContext';

type EventRow = {
  id: string; title: string; date: string; time: string; location: string;
  type: 'Society' | 'Social'; image: string | null; attendeeCount: number; isAttending: boolean;
};



export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isManager } = useRole();
  const [activeFilter, setActiveFilter] = useState<'All' | 'Society' | 'Social'>('All');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoadError(null);
    try {
      const res = await fetch(API.EVENTS, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json.data)) {
        throw new Error(json.message || json.error || 'Could not load events.');
      }

      const mapped: EventRow[] = json.data.map((item: any) => {
        const eventDate = item.eventDate ? new Date(item.eventDate) : new Date();
        const month = eventDate.toLocaleString('en-US', { month: 'short' });
        const day = eventDate.toLocaleString('en-US', { day: 'numeric' });
        const time = eventDate.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
        return {
          id: String(item._id),
          title: String(item.title || 'Society Event'),
          date: `${month} ${day}`,
          time,
          location: String(item.location || 'Society Premises'),
          type: item.eventType === 'Social' ? 'Social' : 'Society',
          image: null,
          attendeeCount: Number(item.attendeeCount || 0),
          isAttending: Boolean(item.isAttending),
        };
      });

      setEvents(mapped);
    } catch (e: any) {
      // Never fall back to invented events: their ids aren't real, so the
      // details screen could not RSVP against them and every tap was lost.
      setLoadError(
        /failed to fetch|network/i.test(String(e?.message))
          ? 'Couldn’t reach the server. Pull to retry.'
          : String(e?.message || 'Could not load events.')
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload every time the screen refocuses — so RSVPs made on the details
  // screen show up here the moment the user comes back.
  useFocusEffect(useCallback(() => { loadEvents(); }, [loadEvents]));

  const filteredEvents = useMemo(() => {
    return events.filter((event) => activeFilter === 'All' || event.type === activeFilter);
  }, [activeFilter, events]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Events</Text>
        {isManager && (
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/event-create')}>
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.createBtnText}>CREATE</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Featured Event — the first upcoming event */}
        {events[0] ? (
          <View style={styles.mainSection}>
            <TouchableOpacity
              style={styles.featuredCard}
              onPress={() => router.push({
                pathname: events[0].type === 'Social' ? '/social-event-details' : '/event-details',
                params: { id: events[0].id },
              } as any)}
              activeOpacity={0.8}
            >
              <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>UPCOMING</Text></View>
              <Text style={styles.featuredTitle}>{events[0].title}</Text>
              <Text style={styles.featuredLocation}>{events[0].location}</Text>
              <View style={styles.featuredMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar" size={14} color={COLORS.white} />
                  <Text style={styles.metaText}>{events[0].date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time" size={14} color={COLORS.white} />
                  <Text style={styles.metaText}>{events[0].time}</Text>
                </View>
              </View>
              <View style={styles.attendeeRow}>
                <Text style={styles.attendeeText}>
                  {events[0].attendeeCount} attending{events[0].isAttending ? ' · You’re going' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Event List */}
        <View style={styles.mainSection}>
          <Text style={styles.sectionTitle}>All Events</Text>
          <View style={styles.filterRow}>
            {(['All', 'Society', 'Social'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>{filter}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {loadError ? (
            <TouchableOpacity style={styles.errBanner} onPress={loadEvents} activeOpacity={0.8}>
              <Ionicons name="alert-circle" size={18} color={COLORS.red} />
              <Text style={styles.errBannerText}>{loadError}</Text>
              <Text style={styles.errRetry}>RETRY</Text>
            </TouchableOpacity>
          ) : null}

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 28 }} />
          ) : filteredEvents.length === 0 && !loadError ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.slate[400]} />
              <Text style={styles.emptyTitle}>
                {events.length === 0 ? 'No upcoming events' : `No ${activeFilter.toLowerCase()} events`}
              </Text>
              <Text style={styles.emptyText}>
                {isManager
                  ? 'Tap CREATE to announce the first one.'
                  : 'Events posted by the committee will appear here.'}
              </Text>
            </View>
          ) : null}

          <View style={styles.eventList}>
            {filteredEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push({
                  pathname: event.type === 'Social' ? '/social-event-details' : '/event-details',
                  params: { id: event.id },
                } as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.eventDateBox, event.type === 'Social' && { backgroundColor: `${COLORS.primary}1A` }]}>
                  <Text style={[styles.eventDateMonth, event.type === 'Social' && { color: COLORS.primary }]}>
                    {event.date.split(' ')[0]}
                  </Text>
                  <Text style={[styles.eventDateDay, event.type === 'Social' && { color: COLORS.primary }]}>
                    {event.date.split(' ')[1]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventLocation}>{event.location}</Text>
                  <View style={styles.eventBottomRow}>
                    <Text style={styles.eventTime}>{event.time}</Text>
                    <Text style={styles.eventAttendees}>· {event.attendeeCount} going</Text>
                    {event.isAttending ? (
                      <View style={styles.goingBadge}>
                        <Ionicons name="checkmark-circle" size={11} color="#1d7a3a" />
                        <Text style={styles.goingBadgeText}>Going</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.eventTypeBadge, event.type === 'Social' && styles.eventTypeSocial]}>
                  <Text style={[styles.eventTypeText, event.type === 'Social' && styles.eventTypeTextSocial]}>{event.type}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingBottom: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.dark },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: 999,
  },
  createBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white, letterSpacing: 1 },
  mainSection: { paddingHorizontal: 24, marginTop: 8 },
  featuredCard: {
    backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  featuredBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: `${COLORS.white}33`, borderRadius: 999 },
  featuredBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white, letterSpacing: 2 },
  featuredTitle: { fontSize: 24, fontWeight: '700', color: COLORS.white, marginTop: 8 },
  featuredLocation: { fontSize: 14, color: `${COLORS.white}CC`, fontWeight: '500' },
  featuredMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: `${COLORS.white}CC`, fontWeight: '500' },
  attendeeRow: { marginTop: 8 },
  attendeeText: { fontSize: 12, fontWeight: '600', color: `${COLORS.white}99` },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark, marginBottom: 16, marginTop: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[500] },
  filterChipTextActive: { color: COLORS.white },
  eventList: { gap: 12 },
  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.white, padding: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  eventDateBox: { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.accentGreen, alignItems: 'center', justifyContent: 'center' },
  eventDateMonth: { fontSize: 10, fontWeight: '700', color: COLORS.dark, letterSpacing: 0.5 },
  eventDateDay: { fontSize: 20, fontWeight: '900', color: COLORS.dark },
  eventTitle: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  eventLocation: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  eventTime: { fontSize: 12, color: COLORS.slate[400], marginTop: 2 },
  eventBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  eventAttendees: { fontSize: 12, color: COLORS.slate[400] },
  goingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#e6f4eb' },
  goingBadgeText: { fontSize: 9, fontWeight: '800', color: '#1d7a3a' },
  eventTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: COLORS.accentGreen },
  eventTypeSocial: { backgroundColor: `${COLORS.primary}1A` },
  eventTypeText: { fontSize: 10, fontWeight: '700', color: COLORS.dark, letterSpacing: 1 },
  eventTypeTextSocial: { color: COLORS.primary },
  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  errBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B' },
  errRetry: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.red },
  emptyBox: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.slate[600] },
  emptyText: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
});
