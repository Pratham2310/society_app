import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { shareContributionReceipt } from '../lib/receipt';

export default function ContributeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [amount, setAmount] = useState('');
  const [showPending, setShowPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  // Alert.alert is a no-op on the web build, so results are shown on screen.
  const [notice, setNotice] = useState<string | null>(null);
  // Where the money actually goes. Entered by this society's own secretary or
  // treasurer — this screen used to display an invented payee and UPI number,
  // which residents could have paid into for real.
  const [payment, setPayment] = useState<{ upiId: string; payeeName: string; note: string } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(true);

  useEffect(() => {
    if (!token) { setLoadingPayment(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const json = await apiFetch(API.MY_SOCIETY, {}, token);
        if (!cancelled) {
          const p = json?.data?.payment || {};
          setPayment({ upiId: p.upiId || '', payeeName: p.payeeName || '', note: p.note || '' });
        }
      } catch {
        if (!cancelled) setPayment(null);
      } finally {
        if (!cancelled) setLoadingPayment(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);


  const submitContribution = async () => {
    if (!amount.trim()) return;
    if (!token) {
      setNotice('Your session expired. Please log in again.');
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(API.FUND_CONTRIBUTIONS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Resident confirms they've paid → record as paid so it reflects in
        // the fund's raised total, contributors wall, and finance overview.
        body: JSON.stringify({ amount: Number(amount), status: 'paid' }),
      });
      const json = await res.json();

      if (!res.ok) {
        setNotice(json.message || 'Could not record your contribution. Please try again.');
        return;
      }

      setContributionId(json.data?._id ? String(json.data._id) : null);
      setShowPending(true);
    } catch {
      setNotice('Couldn’t reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/finance' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finalize Contribution</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {loadingPayment ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : payment?.upiId ? (
            <>
              <View style={styles.payToBox}>
                <Text style={styles.payToLabel}>PAY TO</Text>
                <Text style={styles.upiNumber}>{payment.upiId}</Text>
                {payment.payeeName ? <Text style={styles.name}>{payment.payeeName}</Text> : null}
              </View>

              <View style={styles.instructionBox}>
                <Text style={styles.instructionTitle}>Payment Instruction</Text>
                <Text style={styles.instructionText}>
                  {payment.note
                    || 'Pay to the UPI id above, then enter the amount here so the treasurer can verify it.'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.notSetBox}>
              <Ionicons name="alert-circle" size={20} color="#9A3412" />
              <Text style={styles.notSetText}>
                Your society hasn’t added its UPI details yet, so there is nowhere to pay from
                here. Ask the secretary or treasurer to add them under Finance, then come back.
              </Text>
            </View>
          )}

          <Text style={styles.amountLabel}>Amount Paid</Text>
          <TextInput
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={COLORS.slate[400]}
            style={styles.amountInput}
          />

          {notice ? (
            <TouchableOpacity style={styles.notice} onPress={() => setNotice(null)} activeOpacity={0.9}>
              <Ionicons name="alert-circle" size={18} color={COLORS.red} />
              <Text style={styles.noticeText}>{notice}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            disabled={!amount.trim() || submitting || !payment?.upiId}
            style={[styles.primaryBtn, (!amount.trim() || !payment?.upiId) && styles.btnDisabled]}
            onPress={submitContribution}
          >
            {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>I HAVE PAID</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showPending} transparent animationType="fade" onRequestClose={() => setShowPending(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={48} color="#1d7a3a" />
            <Text style={styles.modalTitle}>Contribution Recorded</Text>
            <Text style={styles.modalText}>Thank you! Your contribution has been recorded. Download your receipt below.</Text>
            {contributionId ? (
              <TouchableOpacity
                style={[styles.receiptBtn, downloadingReceipt && { opacity: 0.6 }]}
                disabled={downloadingReceipt}
                onPress={async () => {
                  setDownloadingReceipt(true);
                  try { await shareContributionReceipt(contributionId, token!); }
                  finally { setDownloadingReceipt(false); }
                }}
              >
                {downloadingReceipt ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.receiptBtnText}>Download Receipt (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setShowPending(false);
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)/finance');
              }}
            >
              <Text style={styles.primaryBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 20,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.dark },
  content: { padding: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 24, padding: 18 },
  treasurerWrap: { alignItems: 'center', marginBottom: 18 },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 10 },
  verifyTag: { fontSize: 10, color: COLORS.primary, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.dark, marginTop: 2 },
  instructionBox: { backgroundColor: COLORS.background, borderRadius: 16, padding: 14 },
  instructionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: COLORS.slate[500] },
  instructionText: { marginTop: 4, fontSize: 13, color: COLORS.slate[600], lineHeight: 20 },
  upiLabel: { marginTop: 18, fontSize: 10, fontWeight: '700', color: COLORS.slate[500], letterSpacing: 1.2, textTransform: 'uppercase' },
  upiNumber: { marginTop: 4, fontSize: 28, fontWeight: '800', color: COLORS.dark },
  amountLabel: { marginTop: 16, fontSize: 10, fontWeight: '700', color: COLORS.slate[500], letterSpacing: 1.2, textTransform: 'uppercase' },
  amountInput: { marginTop: 6, height: 52, borderRadius: 12, backgroundColor: COLORS.background, paddingHorizontal: 14, fontSize: 16, fontWeight: '700', color: COLORS.dark },
  primaryBtn: { marginTop: 18, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  btnDisabled: { opacity: 0.45 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 20 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 22, padding: 22, alignItems: 'center' },
  modalTitle: { marginTop: 12, fontSize: 22, fontWeight: '800', color: COLORS.dark, textAlign: 'center' },
  modalText: { marginTop: 8, fontSize: 13, color: COLORS.slate[500], textAlign: 'center', lineHeight: 20 },
  receiptBtn: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', paddingVertical: 13, borderRadius: 12, borderWidth: 2, borderColor: COLORS.primary },
  receiptBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  payToBox: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  payToLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: COLORS.slate[400] },
  notSetBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 12, padding: 14, marginBottom: 4,
  },
  notSetText: { flex: 1, fontSize: 12.5, color: '#9A3412', lineHeight: 18, fontWeight: '600' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#991B1B', lineHeight: 18 },
});
