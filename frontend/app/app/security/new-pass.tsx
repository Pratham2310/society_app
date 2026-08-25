import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { sharePass } from '../../lib/sharePass';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const PRIMARY = COLORS.primary;

const TYPES = [
  { key: 'guest', label: 'Guest', icon: 'person' },
  { key: 'delivery', label: 'Delivery', icon: 'cube' },
  { key: 'cab', label: 'Cab', icon: 'car' },
  { key: 'service', label: 'Service', icon: 'construct' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
] as const;

const VALIDITY = [
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
];

type Pass = { qr: string; passCode: string; id: string; expiresAt?: string };

export default function NewVisitorPassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [form, setForm] = useState({
    name: '', phone: '', purpose: '', vehicleNumber: '', visitorType: 'guest', validHours: 24,
  });
  const [saving, setSaving] = useState(false);
  const [pass, setPass] = useState<Pass | null>(null);
  const [error, setError] = useState('');
  // Web has no native share sheet in every browser, so the helper reports
  // what it did (downloaded / copied) and we show it here.
  const [shareNote, setShareNote] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const createPass = async () => {
    setError('');
    if (!form.name.trim() || form.name.trim().length < 2) return setError('Enter the visitor’s name.');
    if (!form.phone.trim() || form.phone.trim().length < 7) return setError('Enter a valid phone number.');
    if (!form.purpose.trim()) return setError('What is the visit for? (e.g. Delivery)');

    setSaving(true);
    try {
      const res = await fetch(API.SECURITY_VISITOR_CREATE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          purpose: form.purpose.trim(),
          visitorType: form.visitorType,
          vehicleNumber: form.vehicleNumber.trim() || undefined,
          validHours: form.validHours,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not create the pass');
      const d = json.data || {};
      if (!d.qr || !d.passCode) throw new Error('The pass could not be generated. Try again.');
      setPass({ qr: d.qr, passCode: d.passCode, id: String(d._id), expiresAt: d.passExpiresAt });
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const shareText = (p: Pass) => {
    const flat = user?.flatNumber ? `Flat ${user.flatNumber}` : '';
    const expires = p.expiresAt ? `\nValid until: ${new Date(p.expiresAt).toLocaleString()}` : '';
    return `Your Grihive visitor pass 🎫\n\nVisitor: ${form.name}\nPurpose: ${form.purpose}${flat ? `\nVisiting: ${flat}` : ''}\nPass code: ${p.passCode}${expires}\n\nShow the attached QR at the gate for entry.`;
  };

  const doShare = async (p: Pass) => {
    const note = await sharePass({
      qr: p.qr,
      passCode: p.passCode,
      text: shareText(p),
      fileLabel: form.name || p.passCode,
    });
    if (note) setShareNote(note);
  };


  // ── Pass view ─────────────────────────────────────────────
  if (pass) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.iconBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/security')}>
            <MaterialIcons name="chevron-left" size={24} color="#090C02" />
          </Pressable>
          <Text style={styles.headerTitle}>Visitor Pass</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center', paddingBottom: insets.bottom + 30 }}>
          <View style={styles.passCard}>
            <View style={styles.passTop}>
              <View style={styles.passBadge}><Ionicons name="shield-checkmark" size={16} color="#fff" /></View>
              <Text style={styles.passBadgeText}>APPROVED GATE PASS</Text>
            </View>

            <View style={styles.qrWrap}>
              <Image source={{ uri: pass.qr }} style={styles.qr} resizeMode="contain" />
            </View>

            <Text style={styles.passName}>{form.name}</Text>
            <Text style={styles.passMeta}>{form.purpose}{user?.flatNumber ? `  •  Flat ${user.flatNumber}` : ''}</Text>

            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>CODE</Text>
              <Text style={styles.codeValue}>{pass.passCode}</Text>
            </View>
            {pass.expiresAt ? (
              <Text style={styles.expiry}>Valid until {new Date(pass.expiresAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
            ) : null}
          </View>

          <Text style={styles.hint}>Send this QR to your visitor. The guard scans it at the gate to allow entry.</Text>

          {shareNote ? (
            <Pressable style={styles.shareNote} onPress={() => setShareNote(null)}>
              <Ionicons name="information-circle" size={16} color="#1d7a3a" />
              <Text style={styles.shareNoteText}>{shareNote}</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.shareBtn} onPress={() => doShare(pass)}>
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={styles.shareText}>Send QR to Visitor</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={() => { setPass(null); setForm({ name: '', phone: '', purpose: '', vehicleNumber: '', visitorType: 'guest', validHours: 24 }); }}>
            <Text style={styles.ghostText}>Create Another Pass</Text>
          </Pressable>
          <Pressable style={styles.doneBtn} onPress={() => router.replace('/security/visitors')}>
            <Text style={styles.doneText}>View My Visitors</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Form view ─────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/security' as any))}>
          <MaterialIcons name="chevron-left" size={24} color="#090C02" />
        </Pressable>
        <Text style={styles.headerTitle}>New Visitor Pass</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>Generate a QR pass and send it to your guest. They show it at the gate for instant entry.</Text>

          <View>
            <Text style={styles.label}>Visitor type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => {
                const active = form.visitorType === t.key;
                return (
                  <Pressable key={t.key} style={[styles.chip, active && styles.chipActive]} onPress={() => set('visitorType', t.key)}>
                    <Ionicons name={t.icon as any} size={15} color={active ? '#fff' : PRIMARY} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="Visitor name *" value={form.name} onChange={(v: string) => set('name', v)} placeholder="e.g. Rahul Sharma" />
          <Field label="Phone *" value={form.phone} onChange={(v: string) => set('phone', v)} placeholder="10-digit mobile" keyboardType="phone-pad" />
          <Field label="Purpose *" value={form.purpose} onChange={(v: string) => set('purpose', v)} placeholder="Delivery, family visit, cab…" />
          <Field label="Vehicle number (optional)" value={form.vehicleNumber} onChange={(v: string) => set('vehicleNumber', v)} placeholder="MH-12-AB-1234" autoCapitalize="characters" />

          <View>
            <Text style={styles.label}>Pass valid for</Text>
            <View style={styles.chipRow}>
              {VALIDITY.map((v) => {
                const active = form.validHours === v.hours;
                return (
                  <Pressable key={v.hours} style={[styles.chip, active && styles.chipActive]} onPress={() => set('validHours', v.hours)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={PRIMARY} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable style={[styles.submit, saving && { opacity: 0.6 }]} disabled={saving} onPress={createPass}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="qr-code" size={20} color="#fff" />
                <Text style={styles.submitText}>Generate Pass</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, onChange, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#b6b6b6"
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },

  lead: { fontSize: 13, color: '#717171', lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '800', color: '#5e6354', marginBottom: 8, letterSpacing: 0.3 },
  input: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#090C02', borderWidth: 1, borderColor: '#eee' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: `${PRIMARY}33` },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  chipTextActive: { color: '#fff' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${PRIMARY}12`, borderRadius: 12, padding: 12 },
  errorText: { flex: 1, fontSize: 13, color: PRIMARY, fontWeight: '600' },

  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 16, marginTop: 4 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // Pass view
  passCard: { width: '100%', backgroundColor: '#fff', borderRadius: 26, padding: 22, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  passTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  passBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1d7a3a', alignItems: 'center', justifyContent: 'center' },
  passBadgeText: { fontSize: 11, fontWeight: '900', color: '#1d7a3a', letterSpacing: 1 },
  qrWrap: { padding: 14, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#f0ece9' },
  qr: { width: 220, height: 220 },
  passName: { fontSize: 22, fontWeight: '800', color: '#090C02', marginTop: 6 },
  passMeta: { fontSize: 13, color: '#717171' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: '#f8f6f5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  codeLabel: { fontSize: 10, fontWeight: '800', color: '#aaa', letterSpacing: 1 },
  codeValue: { fontSize: 18, fontWeight: '900', color: '#090C02', letterSpacing: 3 },
  expiry: { fontSize: 12, color: '#999', marginTop: 6 },

  hint: { fontSize: 13, color: '#717171', textAlign: 'center', marginTop: 18, marginBottom: 16, lineHeight: 19, paddingHorizontal: 10 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 16, width: '100%' },
  shareText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ghostBtn: { paddingVertical: 14, marginTop: 6, width: '100%', alignItems: 'center' },
  ghostText: { color: PRIMARY, fontSize: 14, fontWeight: '800' },
  doneBtn: { paddingVertical: 6, alignItems: 'center' },
  doneText: { color: '#717171', fontSize: 13, fontWeight: '700' },
  shareNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch',
    backgroundColor: '#eaf6ee', borderWidth: 1, borderColor: '#c5e4d0',
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 10,
  },
  shareNoteText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#1d7a3a', lineHeight: 17 },
});
