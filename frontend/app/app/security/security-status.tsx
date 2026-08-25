import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

const PRIMARY = '#922207';
const GREEN = '#1d7a3a';

// The API calls the at-home state "safe"; the screen calls it "At Home".
type Status = 'safe' | 'away' | 'dnd';

const STATUSES: Array<{ key: Status; label: string; blurb: string }> = [
  { key: 'safe', label: 'At Home',        blurb: 'Visitors are announced as usual.' },
  { key: 'dnd',  label: 'Do Not Disturb', blurb: 'No visitors unless the guard calls you first.' },
  { key: 'away', label: 'Away',           blurb: 'Visitors and parcels are held at the gate.' },
];

const DURATIONS = [
  { minutes: 60,        label: '1 hour' },
  { minutes: 4 * 60,    label: '4 hours' },
  { minutes: 12 * 60,   label: '12 hours' },
  { minutes: 24 * 60,   label: '1 day' },
  { minutes: 7 * 24*60, label: '1 week' },
  { minutes: 0,         label: 'Until I change it' },
];

const NOTE_CHIPS = ['Hold all parcels', 'Allow my maid in', 'No visitors', 'Call before sending anyone up'];

export default function SecurityStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [status, setStatus] = useState<Status>('safe');
  const [duration, setDuration] = useState<number>(0);
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  // What the server currently holds, so the screen can show it rather than
  // pretending the local pick is already in force.
  const [current, setCurrent] = useState<{ status: string; expiresAt?: string | null; instruction?: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      const json = await apiFetch(API.SECURITY_STATUS_ME, {}, token || undefined);
      const d = json?.data || {};
      setCurrent({ status: d.status || 'safe', expiresAt: d.expiresAt, instruction: d.instruction });
      // Panic isn't one of the three choices — leave the picker on At Home and
      // let the banner explain what's going on.
      if (['safe', 'away', 'dnd'].includes(d.status)) setStatus(d.status);
      setNote(d.instruction || '');
    } catch (e: any) {
      setError(e?.status ? String(e.message) : 'Couldn’t reach the server. Reopen this screen to retry.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      const json = await apiFetch(
        API.SECURITY_STATUS_SET,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            durationMinutes: status === 'safe' ? 0 : duration,
            instruction: note.trim(),
          }),
        },
        token || undefined,
      );
      const d = json?.data || {};
      setCurrent({ status: d.status, expiresAt: d.expiresAt, instruction: d.instruction });
      const label = STATUSES.find((s) => s.key === d.status)?.label ?? d.status;
      setBanner(
        d.expiresAt
          ? `Status set to ${label} until ${new Date(d.expiresAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
          : `Status set to ${label}.`
      );
    } catch (e: any) {
      setError(
        e?.status ? String(e.message) : 'Couldn’t reach the server, so your status wasn’t saved.'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleChip = (chip: string) => {
    const parts = note.split(' • ').map((p) => p.trim()).filter(Boolean);
    const next = parts.includes(chip) ? parts.filter((p) => p !== chip) : [...parts, chip];
    setNote(next.join(' • '));
  };

  const chipOn = (chip: string) => note.split(' • ').map((p) => p.trim()).includes(chip);

  const dirty =
    !!current &&
    (current.status !== status || (note.trim() !== (current.instruction || '').trim()));

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <Text style={styles.headerTitle}>Manage Status</Text>
          <View style={{ width: 40 }} />
        </View>

        {current?.status === 'panic' ? (
          <View style={styles.panicCard}>
            <MaterialIcons name="warning" size={18} color="#fff" />
            <Text style={styles.panicText}>
              An emergency alert is active. Tap “I’m safe” on the security screen to clear it
              before changing your status.
            </Text>
          </View>
        ) : (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>RIGHT NOW</Text>
            <Text style={styles.currentValue}>
              {STATUSES.find((s) => s.key === current?.status)?.label ?? 'At Home'}
            </Text>
            {current?.expiresAt ? (
              <Text style={styles.currentMeta}>
                Returns to At Home at{' '}
                {new Date(current.expiresAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : (
              <Text style={styles.currentMeta}>No time limit — stays until you change it.</Text>
            )}
          </View>
        )}

        {banner ? (
          <Pressable style={styles.okBanner} onPress={() => setBanner(null)}>
            <MaterialIcons name="check-circle" size={18} color={GREEN} />
            <Text style={styles.okBannerText}>{banner}</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Pressable style={styles.errBanner} onPress={() => setError(null)}>
            <MaterialIcons name="error-outline" size={18} color={PRIMARY} />
            <Text style={styles.errBannerText}>{error}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>Set Status</Text>
        <View style={styles.segment}>
          {STATUSES.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setStatus(item.key)}
              style={[styles.segmentBtn, status === item.key && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentBtnText, status === item.key && styles.segmentBtnTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.blurb}>{STATUSES.find((s) => s.key === status)?.blurb}</Text>

        {/* Duration only makes sense for a temporary status. */}
        {status !== 'safe' ? (
          <>
            <Text style={styles.sectionLabel}>Set Duration</Text>
            <View style={styles.durationRow}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d.minutes}
                  onPress={() => setDuration(d.minutes)}
                  style={[styles.ghostButton, duration === d.minutes && styles.ghostButtonActive]}
                >
                  <Text style={[styles.ghostButtonText, duration === d.minutes && styles.ghostButtonTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.blurb}>
              {duration > 0
                ? 'Your status returns to At Home on its own when the time is up.'
                : 'Your status stays as it is until you change it.'}
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Note for the Guard</Text>
        <View style={styles.chipRow}>
          {NOTE_CHIPS.map((chip) => (
            <Pressable
              key={chip}
              onPress={() => toggleChip(chip)}
              style={[styles.chip, chipOn(chip) && styles.chipActive]}
            >
              <Text style={[styles.chipText, chipOn(chip) && styles.chipTextActive]}>{chip}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Anything else the guard should know"
          placeholderTextColor="#b4aca8"
          multiline
          maxLength={160}
        />

        <Pressable
          style={[styles.submitBtn, (saving || current?.status === 'panic') && { opacity: 0.5 }]}
          onPress={save}
          disabled={saving || current?.status === 'panic'}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>{dirty ? 'UPDATE STATUS' : 'SAVE'}</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },

  currentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#ece7e5' },
  currentLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#a99e99' },
  currentValue: { fontSize: 22, fontWeight: '800', color: '#090C02', marginTop: 4 },
  currentMeta: { fontSize: 12, color: '#8a7f7a', marginTop: 4, lineHeight: 17 },

  panicCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: PRIMARY, borderRadius: 16, padding: 16,
  },
  panicText: { flex: 1, fontSize: 12.5, color: '#fff', fontWeight: '600', lineHeight: 18 },

  okBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    backgroundColor: '#eaf6ee', borderWidth: 1, borderColor: '#c5e4d0', borderRadius: 12, padding: 12,
  },
  okBannerText: { flex: 1, fontSize: 12.5, color: GREEN, fontWeight: '600', lineHeight: 17 },
  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    backgroundColor: '#fdeceb', borderWidth: 1, borderColor: '#f5c6c2', borderRadius: 12, padding: 12,
  },
  errBannerText: { flex: 1, fontSize: 12.5, color: '#8a2318', fontWeight: '600', lineHeight: 17 },

  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: '#a99e99', marginTop: 22 },
  blurb: { fontSize: 12, color: '#a99e99', marginTop: 8, lineHeight: 17 },

  segment: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 4, marginTop: 10, borderWidth: 1, borderColor: '#ece7e5' },
  segmentBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: PRIMARY },
  segmentBtnText: { fontSize: 12, fontWeight: '700', color: '#5c534f' },
  segmentBtnTextActive: { color: '#fff' },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  ghostButton: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ece7e5',
  },
  ghostButtonActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  ghostButtonText: { fontSize: 12, fontWeight: '700', color: '#5c534f' },
  ghostButtonTextActive: { color: '#fff' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ece7e5' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: '700', color: '#5c534f' },
  chipTextActive: { color: '#fff' },

  noteInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#ece7e5',
    padding: 14, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: '#090C02', marginTop: 10,
  },

  submitBtn: {
    height: 54, borderRadius: 14, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', marginTop: 26,
  },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
});
