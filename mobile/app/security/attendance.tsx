import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, BASE_URL } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

type StaffRow = {
  id: string;
  name: string;
  role: string;
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'unmarked';
  checkInAt?: string;
  checkOutAt?: string;
};

const PRIMARY = '#922207';
const STATUS_COLOR: Record<StaffRow['status'], string> = {
  present:  '#1d7a3a',
  absent:   '#922207',
  half_day: '#c98a00',
  leave:    '#5a5a5a',
  unmarked: '#aaa',
};

function fmtTime(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

export default function StaffAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffRow[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    Promise.all([
      fetch(API.SECURITY_STAFF,            { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch(`${BASE_URL}/api/security/attendance`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : { data: [] }),
    ])
      .then(([staffRes, attRes]) => {
        const staff = Array.isArray(staffRes?.data) ? staffRes.data : [];
        const att   = Array.isArray(attRes?.data)   ? attRes.data   : [];

        const byStaff = new Map<string, any>();
        att.forEach((row: any) => {
          const sid = String(row.staffId?._id || row.staffId);
          byStaff.set(sid, row);
        });

        setRows(staff.map((s: any) => {
          const row = byStaff.get(String(s._id));
          return {
            id:         String(s._id),
            name:       String(s.name || 'Staff'),
            role:       String(s.role || 'other'),
            status:     (row?.status as StaffRow['status']) || 'unmarked',
            checkInAt:  row?.checkInAt  || undefined,
            checkOutAt: row?.checkOutAt || undefined,
          };
        }));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [token]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, half_day: 0, leave: 0, unmarked: 0 };
    rows.forEach((r) => { c[r.status] += 1; });
    return c;
  }, [rows]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
          <MaterialIcons name="chevron-left" size={24} color="#090C02" />
        </Pressable>
        <Text style={styles.headerTitle}>Staff Attendance</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryPill, { backgroundColor: `${STATUS_COLOR.present}1A` }]}>
          <Text style={[styles.summaryNum, { color: STATUS_COLOR.present }]}>{counts.present}</Text>
          <Text style={styles.summaryLbl}>PRESENT</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: `${STATUS_COLOR.absent}1A` }]}>
          <Text style={[styles.summaryNum, { color: STATUS_COLOR.absent }]}>{counts.absent + counts.leave}</Text>
          <Text style={styles.summaryLbl}>ABSENT</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: `${STATUS_COLOR.unmarked}1A` }]}>
          <Text style={[styles.summaryNum, { color: STATUS_COLOR.unmarked }]}>{counts.unmarked}</Text>
          <Text style={styles.summaryLbl}>PENDING</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="badge" size={32} color="#aaa" />
            <Text style={styles.emptyText}>No staff registered yet. Ask your secretary to add staff.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/security/staff-detail' as any, params: { id: r.id } })}
            >
              <View style={[styles.iconBubble, { backgroundColor: `${STATUS_COLOR[r.status]}1A` }]}>
                <MaterialIcons
                  name={r.status === 'present' ? 'check-circle' : r.status === 'unmarked' ? 'help-outline' : 'event-busy'}
                  size={18}
                  color={STATUS_COLOR[r.status]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.role}>{r.role.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[r.status] }]}>{r.status.replace('_', ' ').toUpperCase()}</Text>
                {r.status === 'present' ? (
                  <Text style={styles.timeText}>{fmtTime(r.checkInAt)} → {fmtTime(r.checkOutAt)}</Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  summaryPill: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  summaryNum: { fontSize: 22, fontWeight: '900' },
  summaryLbl: { marginTop: 2, fontSize: 9, fontWeight: '800', color: '#5a5a5a', letterSpacing: 0.8 },

  empty: { alignItems: 'center', padding: 40, gap: 6 },
  emptyText: { fontSize: 12, color: '#aaa', fontWeight: '600', textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderRadius: 14 },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '800', color: '#090C02' },
  role: { fontSize: 10, color: '#717171', fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  timeText: { fontSize: 11, color: '#717171', marginTop: 2 },
});
