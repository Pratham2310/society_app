import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

const CALENDAR_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const CELL_SIZE = (Dimensions.get('window').width - 40 - 28 - 36) / 7;

const PRIMARY = '#922207';
const GREEN   = '#1d7a3a';

type TimelineEntry = {
  id: string;
  label: string;
  date: string;
  detail: string;
  status: 'present' | 'leave' | 'absent';
};

export default function StaffDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();

  // No seeded sample person here. This screen used to start life as "Anita"
  // with a made-up attendance history, and because GET /staff/:id did not
  // exist the fetch 404'd, leaving that sample on screen under whichever name
  // the list had shown — so every staff member appeared to share one
  // stranger's record.
  const [staff, setStaff] = useState<{ name: string; role: string; photo: string | null; inSociety: boolean } | null>(null);
  const [presentDays, setPresentDays] = useState<Set<number>>(new Set());
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }, []);

  useEffect(() => {
    if (!token || !params.id) { setLoading(false); setError('Staff member not found.'); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const sRes = await fetch(API.SECURITY_STAFF_BY_ID(String(params.id)), { headers });
        const sJson = await sRes.json().catch(() => ({}));
        if (!sRes.ok) {
          throw new Error(
            sRes.status === 403
              ? 'You can only view staff who work in your home.'
              : sJson.message || 'Could not load this staff member.'
          );
        }
        if (cancelled) return;
        setStaff({
          name: String(sJson.data.name || 'Staff'),
          role: String(sJson.data.role || 'staff').toUpperCase(),
          photo: sJson.data.photo || null,
          inSociety: Boolean(sJson.data.isActive),
        });

        // Ask for the whole month: the calendar and the timeline are both
        // month-scale views, but the endpoint defaults to today alone.
        const now = new Date();
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString();
        const aRes = await fetch(
          `${API.SECURITY_ATTENDANCE(String(params.id))}&from=${from}&to=${to}`,
          { headers },
        );
        const aJson = await aRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!aRes.ok || !Array.isArray(aJson.data)) { setTimeline([]); return; }

        const present = new Set<number>();
        const tl: TimelineEntry[] = aJson.data.map((row: any) => {
          const d = new Date(row.date);
          if (row.status === 'present') present.add(d.getUTCDate());
          const inAt = row.checkInAt
            ? new Date(row.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null;
          const outAt = row.checkOutAt
            ? new Date(row.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null;
          return {
            id: String(row._id),
            label: d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' }),
            date: inAt ? `${inAt}${outAt ? ` — ${outAt}` : ''}` : String(row.status).toUpperCase(),
            detail: row.note || '',
            status: row.status === 'present' ? 'present' : row.status === 'leave' ? 'leave' : 'absent',
          };
        });
        setPresentDays(present);
        setTimeline(tl);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || 'Could not load this staff member.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, params.id]);

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (error || !staff) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }]}>
        <MaterialIcons name="person-off" size={40} color="#c9c4c1" />
        <Text style={styles.emptyTitle}>{error || 'Staff member not found.'}</Text>
        <Pressable style={styles.emptyBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
          <Text style={styles.emptyBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  // Real figures from this month's records, not placeholders.
  const daysPresent = presentDays.size;
  const daysAbsent = timeline.filter((t) => t.status !== 'present').length;
  const lastSeen = timeline.find((t) => t.status === 'present');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <MaterialIcons name="arrow-back" size={22} color="#090C02" />
          </Pressable>
          <Pressable style={styles.closeButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <MaterialIcons name="close" size={20} color="#090C02" />
          </Pressable>
        </View>

        <View style={styles.profileWrap}>
          {staff.photo
            ? <Image source={{ uri: staff.photo }} style={styles.profileImage} />
            : (
              <View style={[styles.profileImage, styles.profileFallback]}>
                <Text style={styles.profileInitial}>{staff.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          {staff.inSociety ? (
            <View style={styles.inSocietyBadge}>
              <Text style={styles.inSocietyBadgeText}>IN SOCIETY</Text>
            </View>
          ) : null}
          <Text style={styles.name}>{staff.name}</Text>
          <Text style={styles.role}>{staff.role}</Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>LAST IN</Text>
            <Text style={styles.statValue}>{lastSeen ? lastSeen.date.split(' — ')[0] : '—'}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>PRESENT</Text>
            <Text style={styles.statValue}>{daysPresent} Days</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>MISSED</Text>
            <Text style={styles.statValue}>{daysAbsent} Days</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Attendance Calendar</Text>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarGrid}>
            {CALENDAR_DAYS.map((day, index) => <Text key={`day-${index}`} style={styles.dayHead}>{day}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            {Array.from(
              { length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() },
              (_, idx) => idx + 1,
            ).map((date) => (
              <View key={date} style={[styles.dateCell, presentDays.has(date) && styles.presentDate]}>
                <Text style={[styles.dateText, presentDays.has(date) && styles.presentDateText]}>{date}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Daily Timeline</Text>

        {timeline.length === 0 ? (
          <Text style={styles.emptyMini}>
            No attendance recorded this month yet. Entries appear here once the guard scans
            their gate pass.
          </Text>
        ) : null}

        {timeline.map((entry) => (
          <View key={entry.id} style={styles.timelineRow}>
            <View
              style={[
                styles.timelineIcon,
                entry.status === 'present' && { backgroundColor: '#e6f4eb' },
                entry.status === 'leave'   && { backgroundColor: '#fdecea' },
                entry.status === 'absent'  && { backgroundColor: '#f1ece9' },
              ]}
            >
              <MaterialIcons
                name={entry.status === 'present' ? 'login' : entry.status === 'leave' ? 'event-busy' : 'logout'}
                size={18}
                color={entry.status === 'present' ? GREEN : entry.status === 'leave' ? PRIMARY : '#7a7a7a'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>{entry.label}</Text>
              <Text style={styles.timelineSubtitle}>{entry.date}</Text>
              {entry.detail ? <Text style={styles.timelineDetail}>{entry.detail}</Text> : null}
            </View>
            <View
              style={[
                styles.statusBadge,
                entry.status === 'present' && { backgroundColor: '#e6f4eb' },
                entry.status === 'leave'   && { backgroundColor: '#fdecea' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  entry.status === 'present' && { color: GREEN },
                  entry.status === 'leave'   && { color: PRIMARY },
                ]}
              >
                {entry.status.toUpperCase()}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#f8f6f5' },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  profileWrap: { alignItems: 'center', marginTop: 2 },
  profileImage: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#fff' },
  inSocietyBadge: { marginTop: -12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: GREEN },
  inSocietyBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  name: { marginTop: 10, fontSize: 28, fontWeight: '800', color: '#090C02' },
  role: { marginTop: 2, fontSize: 11, color: '#717171', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginTop: 6 },
  statCell: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#717171', fontWeight: '700', letterSpacing: 1.2 },
  statValue: { fontSize: 14, fontWeight: '800', color: '#090C02', marginTop: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },
  monthLabel: { fontSize: 11, fontWeight: '800', color: PRIMARY, letterSpacing: 1.2 },

  calendarCard: { backgroundColor: '#fff', borderRadius: 24, padding: 14, gap: 10 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayHead: { width: CELL_SIZE, textAlign: 'center', color: '#717171', fontSize: 10, fontWeight: '700' },
  dateCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f6f5' },
  presentDate: { backgroundColor: GREEN },
  dateText: { fontSize: 10, color: '#090C02', fontWeight: '700' },
  presentDateText: { color: '#fff' },

  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  timelineIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timelineTitle: { fontSize: 13, fontWeight: '800', color: '#090C02' },
  timelineSubtitle: { fontSize: 11, color: '#717171', marginTop: 2, fontWeight: '600' },
  timelineDetail: { fontSize: 11, color: '#7a7a7a', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f1ece9' },
  statusBadgeText: { fontSize: 9, fontWeight: '800', color: '#7a7a7a', letterSpacing: 0.6 },
  emptyTitle: { fontSize: 14, color: '#5c534f', textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  emptyBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff' },
  emptyBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#5c534f' },
  emptyMini: { fontSize: 12.5, color: '#a99e99', lineHeight: 18, paddingVertical: 8 },
  profileFallback: { backgroundColor: '#efe9e6', alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontSize: 34, fontWeight: '800', color: '#922207' },
});
