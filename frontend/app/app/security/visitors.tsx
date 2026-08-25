import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

type Visitor = {
  id: string;
  name: string;
  purpose?: string;
  vehicleNumber?: string;
  entryTime?: string;
  exitTime?: string;
  flatNumber?: string;
  approved?: boolean;
  photo?: string;
  // A gate pass this viewer is allowed to reopen — only the household that
  // invited the guest gets this.
  hasPass?: boolean;
};

const PRIMARY = '#922207';

function statusOf(v: Visitor): 'AT GATE' | 'INSIDE' | 'LEFT' {
  if (v.exitTime) return 'LEFT';
  if (v.entryTime) return 'INSIDE';
  return 'AT GATE';
}

export default function VisitorsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [tab, setTab] = useState<'today' | 'mine' | 'society'>('today');
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<Visitor[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(API.SECURITY_VISITORS(tab), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setVisitors(j.data.map((v: any) => ({
            id:            String(v._id),
            name:          String(v.name || 'Visitor'),
            purpose:       v.purpose || '',
            vehicleNumber: v.vehicleNumber || '',
            entryTime:     v.entryTime || null,
            exitTime:      v.exitTime || null,
            flatNumber:    v.flatId?.flatNumber || v.flatNumber || '',
            approved:      Boolean(v.approved),
            hasPass:       Boolean(v.passCode && v.canViewPass),
            photo:         `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(v._id)}`,
          })));
        } else {
          setVisitors([]);
        }
      })
      .catch(() => setVisitors([]))
      .finally(() => setLoading(false));
  }, [token, tab]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
          <MaterialIcons name="chevron-left" size={24} color="#090C02" />
        </Pressable>
        <Text style={styles.headerTitle}>Guest Visitors</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/security/new-pass' as any)}>
          <MaterialIcons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {(['today', 'mine', 'society'] as const).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : visitors.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="people-outline" size={32} color="#aaa" />
            <Text style={styles.emptyText}>No visitors in this view yet.</Text>
          </View>
        ) : (
          visitors.map((v) => {
            const status = statusOf(v);
            const statusColor = status === 'INSIDE' ? '#1d7a3a' : status === 'LEFT' ? '#7a7a7a' : PRIMARY;
            return (
              <Pressable
                key={v.id}
                style={styles.row}
                onPress={() => router.push({ pathname: '/security/visitor-detail' as any, params: { id: v.id } })}
              >
                <Image source={{ uri: v.photo }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{v.name}</Text>
                  <Text style={styles.meta}>
                    {v.purpose ? v.purpose : 'Visit'}
                    {v.flatNumber ? `  •  Flat ${v.flatNumber}` : ''}
                  </Text>
                  {v.vehicleNumber ? <Text style={styles.metaSub}>Vehicle {v.vehicleNumber}</Text> : null}
                  {v.hasPass ? (
                    <View style={styles.passChip}>
                      <MaterialIcons name="qr-code-2" size={12} color={PRIMARY} />
                      <Text style={styles.passChipText}>GATE PASS — TAP TO VIEW</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1A` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  tabRow: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: `${PRIMARY}1A` },
  tabText: { fontSize: 10, fontWeight: '800', color: '#717171', letterSpacing: 1 },
  tabTextActive: { color: PRIMARY },

  empty: { alignItems: 'center', padding: 40, gap: 6 },
  emptyText: { fontSize: 12, color: '#aaa', fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderRadius: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  name: { fontSize: 14, fontWeight: '800', color: '#090C02' },
  meta: { fontSize: 11, color: '#717171', marginTop: 2 },
  metaSub: { fontSize: 11, color: '#aaa', marginTop: 1 },
  passChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: `${PRIMARY}12`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, marginTop: 5,
  },
  passChipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: PRIMARY },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
});
