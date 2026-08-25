import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

type Form = { name: string; email: string; occupancyType: 'owner' | 'tenant'; livingType: string; familySize: string };

const LIVING = [
  { key: 'family', label: 'Family' },
  { key: 'bachelor', label: 'Bachelor' },
  { key: 'commercial', label: 'Commercial' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [form, setForm] = useState<Form>({ name: '', email: '', occupancyType: 'owner', livingType: 'family', familySize: '1' });
  const [phone, setPhone] = useState('');
  const [flat, setFlat] = useState('');
  const [originalOccupancy, setOriginalOccupancy] = useState<'owner' | 'tenant'>('owner');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Show the logged-in resident's basics immediately from the auth session,
    // so name/email/phone/unit always appear even before /me responds (or if it
    // fails on a flaky connection). /me then enriches with occupancy/family/wing.
    if (user) {
      setForm((f) => ({ ...f, name: user.name || f.name, email: user.email || f.email }));
      setPhone((p) => p || user.phone || '');
      setFlat((fl) => (fl && fl !== '—' ? fl : (user.flatNumber ? `Flat ${user.flatNumber}` : '—')));
    }

    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(API.ME, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        const d = json?.data;
        if (res.ok && d) {
          setForm({
            name: String(d.name || ''),
            email: String(d.email || ''),
            occupancyType: d.occupancyType === 'tenant' ? 'tenant' : 'owner',
            livingType: String(d.livingType || 'family'),
            familySize: String(d.familySize || 1),
          });
          setOriginalOccupancy(d.occupancyType === 'tenant' ? 'tenant' : 'owner');
          setPhone(String(d.phone || ''));
          setFlat(d.wingName ? `Wing ${d.wingName} · Flat ${d.flatNumber || ''}` : (d.flatNumber ? `Flat ${d.flatNumber}` : '—'));
          setHasPending(Boolean(d.pendingProfile?.changes && Object.keys(d.pendingProfile.changes).length));
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [token, user]);

  const set = (k: keyof Form, v: any) => { setForm((f) => ({ ...f, [k]: v })); if (banner) setBanner(null); };

  const submit = async () => {
    if (submitted) return;
    if (!form.name.trim()) { setBanner({ type: 'error', text: 'Name cannot be empty.' }); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setBanner({ type: 'error', text: 'Enter a valid email address.' }); return; }
    setBanner(null);
    setSaving(true);
    try {
      const res = await fetch(API.ME_PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          occupancyType: form.occupancyType,
          livingType: form.livingType,
          familySize: Number(form.familySize) || 1,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not submit changes');
      setSubmitted(true);
      setBanner({ type: 'success', text: 'Submitted! The secretary will review your changes. Redirecting…' });
      setTimeout(() => router.replace('/(tabs)/profile'), 1800);
    } catch (e: any) {
      const msg = e?.message || '';
      setBanner({
        type: 'error',
        text: (/failed to fetch|network|timed out/i.test(msg))
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : (msg || 'Something went wrong. Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as any))} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={18} color={COLORS.primary} />
          <Text style={styles.noteText}>Changes to your profile are reviewed by the secretary before they take effect.</Text>
        </View>

        {hasPending ? (
          <View style={styles.pendingCard}>
            <Ionicons name="time-outline" size={16} color={COLORS.primary} />
            <Text style={styles.pendingText}>You have changes awaiting approval.</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={(t) => set('name', t)} placeholder="Full name" placeholderTextColor={COLORS.slate[400]} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(t) => set('email', t)} placeholder="name@email.com" placeholderTextColor={COLORS.slate[400]} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Phone (contact the secretary to change)</Text>
        <TextInput style={[styles.input, styles.readonly]} value={phone ? `+91 ${phone}` : ''} editable={false} />

        <Text style={styles.label}>Unit</Text>
        <TextInput style={[styles.input, styles.readonly]} value={flat} editable={false} />

        <Text style={styles.label}>Occupancy</Text>
        {originalOccupancy === 'owner' ? (
          <>
            <View style={[styles.seg, styles.segActive, styles.segLocked]}>
              <Ionicons name="lock-closed" size={13} color={COLORS.white} />
              <Text style={styles.segTextActive}>  Owner</Text>
            </View>
            <Text style={styles.hintText}>You're registered as an owner. Owners can't switch to tenant — contact the secretary if this is wrong.</Text>
          </>
        ) : (
          <>
            <View style={styles.segRow}>
              {(['tenant', 'owner'] as const).map((o) => (
                <TouchableOpacity key={o} style={[styles.seg, form.occupancyType === o && styles.segActive]} onPress={() => set('occupancyType', o)}>
                  <Text style={[styles.segText, form.occupancyType === o && styles.segTextActive]}>{o === 'owner' ? 'Owner' : 'Tenant'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.occupancyType === 'owner' ? (
              <Text style={styles.hintText}>Tenant → Owner conversion is verified by the secretary before it applies.</Text>
            ) : null}
          </>
        )}

        <Text style={styles.label}>Household type</Text>
        <View style={styles.segRow}>
          {LIVING.map((l) => (
            <TouchableOpacity key={l.key} style={[styles.seg, form.livingType === l.key && styles.segActive]} onPress={() => set('livingType', l.key)}>
              <Text style={[styles.segText, form.livingType === l.key && styles.segTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Family size</Text>
        <TextInput style={styles.input} value={form.familySize} onChangeText={(t) => set('familySize', t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1" placeholderTextColor={COLORS.slate[400]} />

        <TouchableOpacity style={styles.vehiclesLink} onPress={() => router.push('/my-vehicles')}>
          <Ionicons name="car-outline" size={20} color={COLORS.primary} />
          <Text style={styles.vehiclesLinkText}>Manage my vehicles</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.slate[300]} />
        </TouchableOpacity>

        {banner ? (
          <View style={[styles.banner, banner.type === 'success' ? styles.bannerSuccess : styles.bannerError]}>
            <Ionicons name={banner.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={banner.type === 'success' ? '#1d7a3a' : COLORS.red} />
            <Text style={[styles.bannerText, { color: banner.type === 'success' ? '#1d7a3a' : COLORS.red }]}>{banner.text}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.saveBtn, (saving || submitted) && { opacity: 0.6 }]} disabled={saving || submitted} onPress={submit}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{submitted ? 'SUBMITTED ✓' : 'SUBMIT FOR APPROVAL'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, paddingHorizontal: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${COLORS.primary}0D`, borderRadius: 12, padding: 12, marginBottom: 12 },
  noteText: { flex: 1, fontSize: 12.5, color: COLORS.dark, lineHeight: 18 },
  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${COLORS.primary}14`, borderRadius: 12, padding: 10, marginBottom: 12 },
  pendingText: { fontSize: 12.5, color: COLORS.primary, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '800', color: COLORS.slate[500], marginTop: 14, marginBottom: 6, marginLeft: 2 },
  input: { height: 52, borderRadius: 12, backgroundColor: COLORS.white, paddingHorizontal: 14, fontSize: 15, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200] },
  readonly: { backgroundColor: COLORS.slate[100], color: COLORS.slate[500] },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  segActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '700', color: COLORS.slate[500] },
  segTextActive: { color: COLORS.white },
  hintText: { fontSize: 11, color: COLORS.slate[400], marginTop: 6, marginLeft: 2 },
  vehiclesLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: COLORS.slate[200] },
  vehiclesLinkText: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.dark },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 18 },
  bannerSuccess: { backgroundColor: '#e6f4eb' },
  bannerError: { backgroundColor: '#fdecec' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  saveBtn: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
