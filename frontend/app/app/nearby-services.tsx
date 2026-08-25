import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

type Service = {
  _id: string;
  name: string;
  category: string;
  phones: string[];
  openingTime?: string;
  closingTime?: string;
  is24x7?: boolean;
  address?: string;
  description?: string;
  distance?: string;
  note?: string;
};

// Each category gets a recognisable icon so the list can be scanned rather
// than read.
const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'General Store': 'storefront',
  Pharmacy: 'medkit',
  Laundry: 'shirt',
  'Home Services': 'construct',
  Fitness: 'barbell',
  Dining: 'restaurant',
  Medical: 'pulse',
  Maintenance: 'hammer',
  Education: 'school',
};

export default function NearbyServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [active, setActive] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      const json = await apiFetch(API.NEARBY_SERVICES, {}, token);
      setServices(Array.isArray(json.data?.services) ? json.data.services : []);
      setCategories(Array.isArray(json.data?.categories) ? json.data.categories : []);
    } catch (e: any) {
      setError(
        e?.status
          ? String(e.message)
          : 'Couldn’t reach the server. Pull back and open this again to retry.'
      );
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (active !== 'All' && s.category !== active) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    });
  }, [services, active, search]);

  const call = async (phone: string) => {
    const digits = String(phone).replace(/[^\d+]/g, '');
    const url = `tel:${digits}`;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else setError(`Calling isn’t supported here. The number is ${phone}.`);
    } catch {
      setError(`Could not start the call. The number is ${phone}.`);
    }
  };

  const hours = (s: Service) =>
    s.is24x7
      ? 'Open 24 hours'
      : s.openingTime && s.closingTime
        ? `${s.openingTime} – ${s.closingTime}`
        : '';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Nearby Services</Text>
            <Text style={styles.headerSub}>AROUND YOUR SOCIETY</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {error ? (
          <Pressable style={styles.errBanner} onPress={load}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text style={styles.errBannerText}>{error}</Text>
            <Text style={styles.errRetry}>RETRY</Text>
          </Pressable>
        ) : null}

        {services.length > 0 ? (
          <>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search a shop or category"
              placeholderTextColor={COLORS.slate[400]}
            />

            {categories.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {['All', ...categories].map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, active === c && styles.chipActive]}
                    onPress={() => setActive(c)}
                  >
                    <Text style={[styles.chipText, active === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 40 }} />
        ) : services.length === 0 && !error ? (
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={34} color={COLORS.slate[400]} />
            <Text style={styles.emptyTitle}>No services listed yet</Text>
            <Text style={styles.emptyText}>
              Shops, clinics and other businesses near your society will appear here once they've
              been added.
            </Text>
          </View>
        ) : shown.length === 0 ? (
          <Text style={styles.emptyMini}>Nothing matches that search.</Text>
        ) : null}

        {shown.map((s) => (
          <View key={s._id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Ionicons name={ICON[s.category] || 'business'} size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.meta}>
                  {s.category}
                  {s.distance ? `  •  ${s.distance}` : ''}
                </Text>
                {hours(s) ? (
                  <View style={styles.hoursRow}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={s.is24x7 ? '#1d7a3a' : COLORS.slate[400]}
                    />
                    <Text style={[styles.hours, s.is24x7 && { color: '#1d7a3a' }]}>{hours(s)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {s.address ? <Text style={styles.address}>{s.address}</Text> : null}
            {s.note ? <Text style={styles.note}>{s.note}</Text> : null}

            {s.phones?.length ? (
              <View style={styles.callRow}>
                {s.phones.map((p) => (
                  <Pressable key={p} style={styles.callBtn} onPress={() => call(p)}>
                    <Ionicons name="call" size={14} color={COLORS.white} />
                    <Text style={styles.callText}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: COLORS.slate[400], marginTop: 2 },

  search: {
    height: 46, borderRadius: 14, backgroundColor: COLORS.white, paddingHorizontal: 14,
    fontSize: 14, color: COLORS.dark,
  },
  chipRow: { gap: 8, paddingVertical: 10, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[500] },
  chipTextActive: { color: COLORS.white },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${COLORS.primary}12`,
  },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  meta: { fontSize: 11.5, color: COLORS.slate[400], marginTop: 2 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  hours: { fontSize: 11.5, color: COLORS.slate[400], fontWeight: '600' },
  address: { fontSize: 12, color: COLORS.slate[500], lineHeight: 17 },
  note: { fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 17 },

  callRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  callText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  empty: { alignItems: 'center', paddingVertical: 44, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.slate[600] },
  emptyText: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },
  emptyMini: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center', paddingVertical: 28 },

  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  errBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B' },
  errRetry: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.red },
});
