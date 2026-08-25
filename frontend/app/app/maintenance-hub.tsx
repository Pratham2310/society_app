import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, apiFetch } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Resident = { id: string; flat: string; name: string; status: 'PAID' | 'PENDING' };
type ExpenseRow = { id: string; label: string; amount: number; date: string };

const PRIMARY = '#922207';

function ProgressRing({ percent }: { percent: number }) {
  const size = 90;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * Math.min(Math.max(percent, 0), 100)) / 100;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#f1ece9" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={PRIMARY}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function MaintenanceHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isSecretary, can } = useRole();

  // The backend gates maintenance on finance.manage,
  // which is not the same set as the old isManager grouping —
  // it let a treasurer see controls that would 403, and hid
  // them from a committee member who does hold the permission.
  const isManager = can(PERM.FINANCE_MANAGE);
  const canManage = isSecretary || isManager;

  const [tab, setTab] = useState<'payments' | 'expenses'>('payments');
  const [filter, setFilter] = useState<'All' | 'Paid' | 'Pending'>('All');

  const [totalCollected, setTotalCollected] = useState(0);
  const [totalPending,   setTotalPending]   = useState(0);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  // The society's real UPI details — what residents are told to pay into.
  // Only the people who run the society may set them; the app never invents one.
  const [payment, setPayment] = useState({ upiId: '', payeeName: '', note: '' });
  const [showPayment, setShowPayment] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  const [showExpense, setShowExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'maintenance', receipt: '' });
  const [savingExpense, setSavingExpense] = useState(false);

  const loadPayment = useCallback(async () => {
    if (!token) return;
    try {
      const json = await apiFetch(API.MY_SOCIETY, {}, token);
      const p = json?.data?.payment || {};
      setPayment({ upiId: p.upiId || '', payeeName: p.payeeName || '', note: p.note || '' });
    } catch {
      // Leave the fields blank rather than guessing at a payee.
    }
  }, [token]);

  const savePayment = async () => {
    setSavingPayment(true);
    setPayNotice(null);
    try {
      await apiFetch(
        API.MY_SOCIETY_PAYMENT,
        { method: 'PATCH', body: JSON.stringify(payment) },
        token || undefined,
      );
      setShowPayment(false);
      setPayNotice('Collection details saved. Residents will now see these on the contribute screen.');
      await loadPayment();
    } catch (e: any) {
      setPayNotice(
        e?.status ? String(e.message) : 'Couldn’t reach the server, so the details weren’t saved.'
      );
    } finally {
      setSavingPayment(false);
    }
  };

  const loadHub = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(API.MAINTENANCE_HUB, { headers: { Authorization: `Bearer ${token}` } });
      const j = r.ok ? await r.json() : null;
      if (!j?.data) return;
      if (j.data.totalCollected !== undefined) setTotalCollected(Number(j.data.totalCollected));
      if (j.data.totalPending   !== undefined) setTotalPending(Number(j.data.totalPending));
      if (Array.isArray(j.data.residents)) {
        setResidents(j.data.residents.map((r: any) => ({
          id: String(r._id || r.id),
          flat: String(r.flatNumber || r.flat || '—'),
          name: String(r.name || 'Resident'),
          status: r.status === 'paid' ? 'PAID' : 'PENDING',
        })));
      }
      if (Array.isArray(j.data.expenses)) {
        setExpenses(j.data.expenses.map((e: any) => ({
          id: String(e._id || e.id),
          label: String(e.label || e.category || 'Expense'),
          amount: Number(e.amount || 0),
          date: String(e.date || ''),
        })));
      }
    } catch {
      /* keep whatever we have */
    }
  }, [token]);

  useEffect(() => { loadHub(); }, [loadHub]);
  useEffect(() => { loadPayment(); }, [loadPayment]);

  const addExpense = async () => {
    const amount = Number(newExpense.amount);
    if (!newExpense.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Enter a title and a positive amount.');
      return;
    }
    setSavingExpense(true);
    try {
      const res = await fetch(API.EXPENSES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newExpense.title.trim(),
          amount,
          category: newExpense.category,
          receipt: newExpense.receipt.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to add expense');
      setShowExpense(false);
      setNewExpense({ title: '', amount: '', category: 'maintenance', receipt: '' });
      await loadHub();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const total = totalCollected + totalPending;
  const percent = total > 0 ? Math.round((totalCollected / total) * 100) : 0;

  const filteredResidents = useMemo(() => {
    if (filter === 'All') return residents;
    return residents.filter((r) => r.status === filter.toUpperCase());
  }, [filter, residents]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/finance' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maintenance Hub</Text>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="search" size={18} color={COLORS.dark} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        <View style={styles.summaryCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.summaryLabel}>TOTAL COLLECTED</Text>
            <Text style={styles.summaryValue}>₹{totalCollected.toLocaleString('en-IN')}</Text>
            <Text style={[styles.summaryLabel, { marginTop: 8 }]}>PENDING AMOUNT</Text>
            <Text style={[styles.summaryValue, { color: PRIMARY }]}>₹{totalPending.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.ringWrap}>
            <ProgressRing percent={percent} />
            <View style={styles.ringCenter}>
              <Text style={styles.ringPercent}>{percent}%</Text>
              <Text style={styles.ringGoal}>Goal</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'payments' && styles.tabBtnActive]}
            onPress={() => setTab('payments')}
          >
            <Text style={[styles.tabText, tab === 'payments' && styles.tabTextActive]}>Payment Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'expenses' && styles.tabBtnActive]}
            onPress={() => setTab('expenses')}
          >
            <Text style={[styles.tabText, tab === 'expenses' && styles.tabTextActive]}>Expense Logs</Text>
          </TouchableOpacity>
        </View>

        {tab === 'payments' ? (
          <>
            <View style={styles.listHead}>
              <Text style={styles.sectionTitle}>Residents ({residents.length})</Text>
              <TouchableOpacity
                onPress={() => setFilter(filter === 'All' ? 'Paid' : filter === 'Paid' ? 'Pending' : 'All')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={styles.filterText}>Filter</Text>
                <Ionicons name="filter" size={14} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            {filteredResidents.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={[styles.avatar, r.status === 'PAID' && styles.avatarPaid]}>
                  <Text style={styles.avatarLetter}>{r.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{r.flat} – {r.name}</Text>
                  <View style={[styles.statusPill, r.status === 'PAID' && styles.statusPillPaid]}>
                    <Text style={[styles.statusPillText, r.status === 'PAID' && styles.statusPillTextPaid]}>{r.status}</Text>
                  </View>
                </View>
                <Ionicons
                  name={r.status === 'PAID' ? 'checkmark-circle' : 'time-outline'}
                  size={22}
                  color={r.status === 'PAID' ? '#1d7a3a' : '#7a7a7a'}
                />
              </View>
            ))}
          </>
        ) : (
          <>
            {canManage ? (
              <View style={styles.payCard}>
                <View style={styles.payHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Collection Details</Text>
                    <Text style={styles.payHint}>
                      Where residents pay maintenance and fund contributions.
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => setShowPayment(true)}>
                    <Ionicons name={payment.upiId ? 'create-outline' : 'add'} size={14} color={COLORS.white} />
                    <Text style={styles.addBtnText}>{payment.upiId ? 'Edit' : 'Add UPI'}</Text>
                  </TouchableOpacity>
                </View>

                {payment.upiId ? (
                  <>
                    <Text style={styles.payUpi}>{payment.upiId}</Text>
                    {payment.payeeName ? <Text style={styles.payName}>{payment.payeeName}</Text> : null}
                  </>
                ) : (
                  <Text style={styles.payMissing}>
                    Not set yet — residents can’t contribute from the app until you add the
                    society’s UPI id.
                  </Text>
                )}

                {payNotice ? (
                  <TouchableOpacity onPress={() => setPayNotice(null)}>
                    <Text style={styles.payNotice}>{payNotice}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <View style={styles.listHead}>
              <Text style={styles.sectionTitle}>Recent Expenses</Text>
              {canManage ? (
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowExpense(true)}>
                  <Ionicons name="add" size={14} color={COLORS.white} />
                  <Text style={styles.addBtnText}>Add Expense</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {expenses.length === 0 ? (
              <Text style={styles.emptyMini}>No expenses logged yet.{canManage ? ' Tap “Add Expense” to record one.' : ''}</Text>
            ) : expenses.map((e) => (
              <View key={e.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Ionicons name="cash-outline" size={18} color={COLORS.dark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{e.label}</Text>
                  <Text style={styles.rowSub}>{e.date}</Text>
                </View>
                <Text style={styles.rowAmount}>₹{e.amount.toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showPayment} transparent animationType="fade" onRequestClose={() => setShowPayment(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Collection Details</Text>
            <Text style={styles.payHint}>
              Enter the society’s own UPI id. Residents see exactly this when they contribute,
              so double-check it.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={payment.upiId}
              onChangeText={(t) => setPayment((p) => ({ ...p, upiId: t.trim() }))}
              placeholder="societyname@okhdfcbank"
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              value={payment.payeeName}
              onChangeText={(t) => setPayment((p) => ({ ...p, payeeName: t }))}
              placeholder="Account name shown to residents"
              placeholderTextColor={COLORS.slate[400]}
            />
            <TextInput
              style={[styles.modalInput, { height: 76, textAlignVertical: 'top' }]}
              value={payment.note}
              onChangeText={(t) => setPayment((p) => ({ ...p, note: t }))}
              placeholder="Instruction, e.g. share the screenshot with the treasurer"
              placeholderTextColor={COLORS.slate[400]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => { setShowPayment(false); loadPayment(); }}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, savingPayment && { opacity: 0.6 }]}
                onPress={savePayment}
                disabled={savingPayment}
              >
                <Text style={styles.modalBtnPrimaryText}>{savingPayment ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showExpense} transparent animationType="fade" onRequestClose={() => setShowExpense(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <Text style={styles.modalSub}>Logged to the society's expense ledger. Residents can see the breakdown.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Title (e.g. Electricity – March)"
              placeholderTextColor={COLORS.slate[400]}
              value={newExpense.title}
              onChangeText={(t) => setNewExpense({ ...newExpense, title: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Amount in ₹"
              placeholderTextColor={COLORS.slate[400]}
              keyboardType="number-pad"
              value={newExpense.amount}
              onChangeText={(t) => setNewExpense({ ...newExpense, amount: t })}
            />
            <View style={styles.catRow}>
              {(['maintenance', 'utilities', 'events', 'security', 'admin', 'other'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, newExpense.category === c && styles.catChipActive]}
                  onPress={() => setNewExpense({ ...newExpense, category: c })}
                >
                  <Text style={[styles.catChipText, newExpense.category === c && styles.catChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Receipt/PDF link (optional)"
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="none"
              value={newExpense.receipt}
              onChangeText={(t) => setNewExpense({ ...newExpense, receipt: t })}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowExpense(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, savingExpense && { opacity: 0.6 }]} disabled={savingExpense} onPress={addExpense}>
                <Text style={styles.modalBtnPrimaryText}>{savingExpense ? 'Saving…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },

  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.white, borderRadius: 18, padding: 18, marginBottom: 18 },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 1.2 },
  summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.dark },
  ringWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPercent: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  ringGoal: { fontSize: 10, color: COLORS.slate[500], fontWeight: '700' },

  tabRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 14, padding: 4, marginBottom: 18 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: `${PRIMARY}1A` },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.slate[500] },
  tabTextActive: { color: PRIMARY },

  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  filterText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${PRIMARY}1A`, alignItems: 'center', justifyContent: 'center' },
  avatarPaid: { backgroundColor: '#e6f4eb' },
  avatarLetter: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  rowSub: { fontSize: 11, color: COLORS.slate[400], marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  statusPill: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f1ece9' },
  statusPillPaid: { backgroundColor: '#e6f4eb' },
  statusPillText: { fontSize: 9, fontWeight: '800', color: COLORS.slate[600], letterSpacing: 0.6 },
  statusPillTextPaid: { color: '#1d7a3a' },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: PRIMARY },
  addBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.white, letterSpacing: 0.4 },
  emptyMini: { fontSize: 12, color: COLORS.slate[400], fontWeight: '600', backgroundColor: COLORS.white, borderRadius: 14, padding: 16, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 22, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  modalSub: { fontSize: 12, color: COLORS.slate[500] },
  modalInput: { padding: 14, borderWidth: 1, borderColor: COLORS.slate[200], borderRadius: 12, fontSize: 15, color: COLORS.dark },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.slate[100] },
  catChipActive: { backgroundColor: PRIMARY },
  catChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slate[600] },
  catChipTextActive: { color: COLORS.white },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  modalBtnGhost: { backgroundColor: COLORS.slate[100] },
  modalBtnGhostText: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  modalBtnPrimary: { backgroundColor: PRIMARY },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  payCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 14, gap: 4 },
  payHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  payHint: { fontSize: 11.5, color: COLORS.slate[400], lineHeight: 16, marginTop: 2 },
  payUpi: { fontSize: 17, fontWeight: '800', color: COLORS.dark, marginTop: 8, letterSpacing: 0.3 },
  payName: { fontSize: 12.5, color: COLORS.slate[500], marginTop: 2 },
  payMissing: { fontSize: 12.5, color: '#9A3412', lineHeight: 18, marginTop: 8, fontWeight: '600' },
  payNotice: { fontSize: 12, color: '#1d7a3a', fontWeight: '600', marginTop: 10, lineHeight: 17 },
});
