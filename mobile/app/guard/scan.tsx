import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../../constants/api';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const GREEN = '#1d7a3a';
const PRIMARY = COLORS.primary;

type Result = {
  ok: boolean;
  action?: 'entry' | 'exit';
  name?: string;
  purpose?: string;
  flat?: string;
  message?: string;
};

export default function GuardScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const lock = useRef(false);

  const submit = async (raw: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(API.SECURITY_VISITOR_SCAN, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: json.message || 'Pass not accepted' });
      } else if (json.kind === 'staff') {
        // Household staff carry a daily pass: scanning marks their attendance
        // rather than logging a one-off visit.
        const s = json.staff || {};
        setResult({
          ok: true,
          action: json.action,
          name: s.name || 'Staff',
          purpose: s.role ? String(s.role).toUpperCase() : 'Daily staff',
          flat: s.flatId?.flatNumber || s.flatNumber || '',
        });
      } else {
        const v = json.visitor || {};
        setResult({
          ok: true,
          action: json.action,
          name: v.name || 'Visitor',
          purpose: v.purpose || '',
          flat: v.flatId?.flatNumber || v.flatNumber || '',
        });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message || 'Network error — is the gate online?' });
    } finally {
      setBusy(false);
    }
  };

  const onScan = ({ data }: { data: string }) => {
    if (lock.current || busy || result) return;
    lock.current = true;
    submit(data);
  };

  const scanAgain = () => {
    setResult(null);
    lock.current = false;
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManual(false);
    setManualCode('');
    lock.current = true;
    submit(code);
  };

  // ── Permission gate ───────────────────────────────────────
  if (!permission) {
    return <View style={styles.screen}><ActivityIndicator color="#fff" style={{ marginTop: 80 }} /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="camera-outline" size={48} color="#fff" />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permText}>Allow the camera to scan visitor QR passes at the gate.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => setManual(true)}>
          <Text style={styles.linkText}>Enter code manually</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/guard' as any))}>
          <Text style={[styles.linkText, { color: '#bbb' }]}>Go back</Text>
        </Pressable>
        <ManualModal
          visible={manual} value={manualCode} onChange={setManualCode}
          onSubmit={submitManual} onClose={() => setManual(false)}
        />
      </View>
    );
  }

  // ── Scanner ───────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        // Without this the preview opens at a fixed focus and a QR held at
        // arm's length stays soft — the camera looked permanently out of focus.
        autofocus="on"
        // A printed or on-screen QR is close up; any zoom just costs sharpness.
        zoom={0}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={result || busy ? undefined : onScan}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.roundBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/guard' as any))}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>Scan Visitor Pass</Text>
        <Pressable style={styles.roundBtn} onPress={() => setManual(true)}>
          <Ionicons name="keypad" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Reticle */}
      {!result && (
        <View style={styles.reticleWrap} pointerEvents="none">
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.reticleHint}>{busy ? 'Checking pass…' : 'Point at the visitor’s QR code'}</Text>
        </View>
      )}

      {busy && !result && (
        <View style={styles.busyPill}><ActivityIndicator color="#fff" /><Text style={styles.busyText}>Verifying…</Text></View>
      )}

      {/* Result overlay */}
      {result && (
        <View style={styles.resultOverlay}>
          <View style={[styles.resultCard, { borderTopColor: result.ok ? GREEN : PRIMARY }]}>
            <View style={[styles.resultIcon, { backgroundColor: result.ok ? GREEN : PRIMARY }]}>
              <Ionicons name={result.ok ? (result.action === 'exit' ? 'exit' : 'checkmark') : 'close'} size={40} color="#fff" />
            </View>

            {result.ok ? (
              <>
                <Text style={styles.resultTitle}>
                  {result.action === 'exit' ? 'Exit Recorded' : 'Entry Granted'}
                </Text>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultMeta}>
                  {result.purpose}{result.flat ? `  •  Flat ${result.flat}` : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.resultTitle, { color: PRIMARY }]}>Not Allowed</Text>
                <Text style={styles.resultMeta}>{result.message}</Text>
              </>
            )}

            <Pressable style={styles.scanNextBtn} onPress={scanAgain}>
              <Ionicons name="scan" size={18} color="#fff" />
              <Text style={styles.scanNextText}>Scan Next</Text>
            </Pressable>
            <Pressable style={styles.doneBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/guard' as any))}>
              <Text style={styles.doneText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ManualModal
        visible={manual} value={manualCode} onChange={setManualCode}
        onSubmit={submitManual} onClose={() => setManual(false)}
      />
    </View>
  );
}

function ManualModal({ visible, value, onChange, onSubmit, onClose }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.mBackdrop}>
        <View style={styles.mCard}>
          <Text style={styles.mTitle}>Enter pass code</Text>
          <Text style={styles.mSub}>Type the code printed under the visitor’s QR.</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            autoCapitalize="characters"
            placeholder="e.g. 9508804FC5"
            placeholderTextColor="#b6b6b6"
            style={styles.mInput}
          />
          <View style={styles.mActions}>
            <Pressable style={[styles.mBtn, styles.mGhost]} onPress={onClose}><Text style={styles.mGhostText}>Cancel</Text></Pressable>
            <Pressable style={[styles.mBtn, styles.mPrimary]} onPress={onSubmit}><Text style={styles.mPrimaryText}>Verify</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0b0b' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 8 },
  permText: { color: '#bbb', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn: { backgroundColor: PRIMARY, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 12 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  linkBtn: { paddingVertical: 10 },
  linkText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },

  reticleWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 250, height: 250 },
  corner: { position: 'absolute', width: 42, height: 42, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  reticleHint: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 26, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },

  busyPill: { position: 'absolute', bottom: 60, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  busyText: { color: '#fff', fontWeight: '700' },

  resultOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard: { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 26, alignItems: 'center', gap: 6, borderTopWidth: 5 },
  resultIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  resultTitle: { fontSize: 22, fontWeight: '900', color: GREEN },
  resultName: { fontSize: 20, fontWeight: '800', color: '#090C02', marginTop: 4 },
  resultMeta: { fontSize: 14, color: '#717171', textAlign: 'center', marginTop: 2 },
  scanNextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 14, width: '100%', marginTop: 18 },
  scanNextText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  doneBtn: { paddingVertical: 12 },
  doneText: { color: '#717171', fontSize: 14, fontWeight: '700' },

  mBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  mCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  mTitle: { fontSize: 18, fontWeight: '800', color: '#090C02' },
  mSub: { fontSize: 13, color: '#717171', marginTop: 4 },
  mInput: { backgroundColor: '#f8f6f5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, letterSpacing: 2, fontWeight: '800', color: '#090C02', marginTop: 14, borderWidth: 1, borderColor: '#eee' },
  mActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  mBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  mGhost: { backgroundColor: '#f1f1f1' },
  mGhostText: { color: '#717171', fontWeight: '800' },
  mPrimary: { backgroundColor: PRIMARY },
  mPrimaryText: { color: '#fff', fontWeight: '800' },
});
