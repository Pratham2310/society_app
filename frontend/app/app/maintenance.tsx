import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth, useRole } from '../context/AuthContext';
import { shareContributionReceipt } from '../lib/receipt';

type ExpenseItem = {
  id: string;
  title: string;
  category: string;
  amount: number;
  receipt: string | null;
  date: string;
};

type Receipt = { id: string; month: string; date: string };

// One month's maintenance payment. `id` is the contribution id — it's what
// the receipt PDF is generated from, so rows without it can't be downloaded.
type Bill = {
  id?: string;
  receiptNo?: string;
  month: string;
  amount: string;
  status: 'Paid' | 'Unpaid';
  date: string;
};

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export default function MaintenanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isSecretary, isManager } = useRole();
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [savingAmount, setSavingAmount] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState<number>(0);
  const [dueDay, setDueDay] = useState<number>(10);
  const [isOverdue, setIsOverdue] = useState(false);
  const [paidThisMonth, setPaidThisMonth] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
  const [currentDue, setCurrentDue] = useState(12000);
  const [totalMaintenance, setTotalMaintenance] = useState(250000);
  const [contributorAvatars, setContributorAvatars] = useState<string[]>([
    'https://i.pravatar.cc/60?img=12',
    'https://i.pravatar.cc/60?img=23',
    'https://i.pravatar.cc/60?img=47',
  ]);
  const [extraContributors, setExtraContributors] = useState<number>(4);
  const [bills, setBills] = useState<Bill[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [expenseBreakdown, setExpenseBreakdown] = useState([
    { label: 'Security & Staff', amount: '₹5,500' },
    { label: 'Housekeeping', amount: '₹2,200' },
    { label: 'Electricity', amount: '₹1,850' },
    { label: 'Water & Utilities', amount: '₹1,300' },
    { label: 'Sinking Fund', amount: '₹1,150' },
  ]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState<{ title: string; amount: string; category: string; receipt: string }>({
    title: '',
    amount: '',
    category: 'maintenance',
    receipt: '',
  });
  const [savingExpense, setSavingExpense] = useState(false);

  const loadExpenses = async () => {
    if (!token) return;
    try {
      const res = await fetch(API.EXPENSES, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) return;
      setExpenses(json.data.map((e: any) => ({
        id:       String(e._id),
        title:    String(e.title || 'Expense'),
        category: String(e.category || 'other'),
        amount:   Number(e.amount || 0),
        receipt:  e.receipt || null,
        date:     e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      })));
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadExpenses(); }, [token]);

  useEffect(() => {
    const loadMaintenance = async () => {
      if (!token) return;

      try {
        const res = await fetch(API.MAINTENANCE, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !json?.data) return;

        setCurrentDue(Number(json.data.currentDue || 0));
        if (json.data.monthlyAmount !== undefined) {
          setMonthlyAmount(Number(json.data.monthlyAmount || 0));
        }
        if (json.data.dueDay !== undefined) setDueDay(Number(json.data.dueDay || 10));
        setIsOverdue(Boolean(json.data.isOverdue));
        setPaidThisMonth(Boolean(json.data.paidThisMonth));
        if (json.data.totalMaintenance !== undefined) {
          setTotalMaintenance(Number(json.data.totalMaintenance || 0));
        }
        if (Array.isArray(json.data.contributors)) {
          setContributorAvatars(
            json.data.contributors.slice(0, 3).map((c: any) =>
              c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.id || c.name || 'r')}`
            )
          );
          setExtraContributors(Math.max(0, json.data.contributors.length - 3));
        }

        if (Array.isArray(json.data.bills)) {
          setBills(
            json.data.bills.map((bill: any) => ({
              id: bill.id ? String(bill.id) : undefined,
              receiptNo: bill.receiptNo || '',
              month: String(bill.month || 'Unknown'),
              amount: `₹${Number(bill.amount || 0).toLocaleString('en-IN')}`,
              status: bill.status === 'Paid' ? 'Paid' : 'Unpaid',
              date: String(bill.date || ''),
            }))
          );
        }

        if (Array.isArray(json.data.expenseBreakdown) && json.data.expenseBreakdown.length) {
          setExpenseBreakdown(
            json.data.expenseBreakdown.map((row: any) => ({
              label: String(row.label || 'General'),
              amount: `₹${Number(row.amount || 0).toLocaleString('en-IN')}`,
            }))
          );
        }
      } catch {
        // Keep default maintenance values when backend is unavailable.
      }
    };

    loadMaintenance();
  }, [token]);

  const paidBills = useMemo(() => bills.filter((b) => b.status === 'Paid'), [bills]);

  const downloadReceipt = async (bill: Bill) => {
    if (!bill.id || !token) return;
    setDownloading(bill.id);
    try {
      await shareContributionReceipt(bill.id, token);
    } finally {
      setDownloading(null);
    }
  };

  const filteredBills = useMemo(() => {
    if (activeFilter === 'All') return bills;
    return bills.filter((bill) => bill.status === activeFilter);
  }, [activeFilter, bills]);

  const paidCount = bills.filter((bill) => bill.status === 'Paid').length;
  const unpaidCount = bills.filter((bill) => bill.status === 'Unpaid').length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/finance' as any))} style={styles.backBtn}><Ionicons name="chevron-back" size={20} color={COLORS.dark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Maintenance</Text>
        {/* The hub is reached via "View Breakdown" below. */}
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
        <View style={styles.totalCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>TOTAL MAINTENANCE</Text>
            <Text style={styles.totalAmount}>₹{totalMaintenance.toLocaleString('en-IN')}</Text>
            <View style={styles.avatarStackRow}>
              <View style={styles.avatarStack}>
                {contributorAvatars.map((src, idx) => (
                  <Image key={idx} source={{ uri: src }} style={[styles.stackAvatar, { marginLeft: idx === 0 ? 0 : -10 }]} />
                ))}
                {extraContributors > 0 ? (
                  <View style={[styles.stackAvatar, styles.stackOverflow]}>
                    <Text style={styles.stackOverflowText}>+{extraContributors}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => router.push('/maintenance-hub')} style={styles.viewBreakdown}>
                <Text style={styles.viewBreakdownText}>View Breakdown</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {isOverdue && !(isSecretary || isManager) ? (
          <View style={styles.overdueBanner}>
            <Ionicons name="alert-circle" size={18} color={COLORS.white} />
            <Text style={styles.overdueText}>
              Your maintenance was due on the {ordinal(dueDay)}. Please pay now to avoid late fees.
            </Text>
          </View>
        ) : null}

        <View style={styles.currentBill}>
          <Text style={styles.currentLabel}>CURRENT MONTH</Text>
          <Text style={styles.currentAmount}>₹{(currentDue || monthlyAmount).toLocaleString('en-IN')}</Text>
          <Text style={styles.currentDue}>
            {monthlyAmount > 0 ? `Due by the ${ordinal(dueDay)} of every month` : 'Amount not yet set by secretary'}
          </Text>
          {paidThisMonth ? (
            <View style={styles.paidTag}>
              <Ionicons name="checkmark-circle" size={14} color="#1d7a3a" />
              <Text style={styles.paidTagText}>Paid this month</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.payNowBtn}><Text style={styles.payNowText}>Pay Maintenance Now</Text></TouchableOpacity>
          )}
          {isSecretary || isManager ? (
            <View style={styles.secRow}>
              <TouchableOpacity
                style={styles.editAmountBtn}
                onPress={() => { setAmountInput(String(monthlyAmount || '')); setDueDayInput(String(dueDay || '')); setShowAmountModal(true); }}
              >
                <Ionicons name="create-outline" size={14} color={COLORS.white} />
                <Text style={styles.editAmountText}>Set Amount & Due Date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editAmountBtn, sendingReminders && { opacity: 0.6 }]}
                disabled={sendingReminders}
                onPress={async () => {
                  setSendingReminders(true);
                  try {
                    const res = await fetch(API.MAINTENANCE_REMINDERS, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.message || 'Failed');
                    Alert.alert('Reminders sent', `Notified ${json.notified ?? 0} resident(s) with pending maintenance.`);
                  } catch (err: any) {
                    Alert.alert('Error', err.message || 'Could not send reminders');
                  } finally {
                    setSendingReminders(false);
                  }
                }}
              >
                <Ionicons name="notifications-outline" size={14} color={COLORS.white} />
                <Text style={styles.editAmountText}>{sendingReminders ? 'Sending…' : 'Send Reminders'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{paidCount}</Text>
            <Text style={styles.summaryLabel}>PAID MONTHS</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardWarn]}>
            <Text style={styles.summaryValue}>{unpaidCount}</Text>
            <Text style={styles.summaryLabel}>UNPAID MONTHS</Text>
          </View>
        </View>

        <View style={styles.expensesHeader}>
          <Text style={styles.sectionTitle}>Monthly Expense Breakdown</Text>
          {isSecretary || isManager ? (
            <TouchableOpacity style={styles.addExpenseBtn} onPress={() => setShowExpenseModal(true)}>
              <Ionicons name="add" size={14} color={COLORS.white} />
              <Text style={styles.addExpenseText}>Add Bill</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {expenses.length > 0 ? (
          <View style={styles.breakdownCard}>
            {expenses.map((e) => (
              <View key={e.id} style={styles.breakdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownLabel}>{e.title}</Text>
                  <Text style={styles.breakdownMeta}>{e.category.toUpperCase()}  •  {e.date}</Text>
                </View>
                <Text style={styles.breakdownAmount}>₹{e.amount.toLocaleString('en-IN')}</Text>
                {e.receipt ? (
                  <TouchableOpacity
                    style={styles.pdfBtn}
                    onPress={() => e.receipt && Linking.openURL(e.receipt).catch(() => Alert.alert('Cannot open', 'Invalid PDF link'))}
                  >
                    <Ionicons name="document-text" size={14} color={COLORS.primary} />
                    <Text style={styles.pdfBtnText}>PDF</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.breakdownCard}>
            {expenseBreakdown.map((item) => (
              <View key={item.label} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownAmount}>{item.amount}</Text>
              </View>
            ))}
            <Text style={styles.breakdownHint}>
              {isSecretary ? 'No itemized bills yet — tap "Add Bill" above to upload PDF receipts.' : 'No itemized bills yet. The secretary will upload monthly bills here.'}
            </Text>
          </View>
        )}

        <View style={styles.receiptsHeader}>
          <Text style={styles.sectionTitle}>Recent Receipts</Text>
        </View>
        {paidBills.length === 0 ? (
          <View style={styles.noReceipts}>
            <Ionicons name="receipt-outline" size={26} color={COLORS.slate[300]} />
            <Text style={styles.noReceiptsText}>No payments yet — receipts appear here once you pay.</Text>
          </View>
        ) : null}
        {paidBills.slice(0, 3).map((bill, i) => (
          <View key={bill.id || `r-${i}`} style={styles.receiptCard}>
            <View style={styles.receiptIcon}>
              <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.receiptMonth}>{bill.month}</Text>
              <Text style={styles.receiptDate}>
                PAID {bill.date.toUpperCase()}{bill.receiptNo ? ` · ${bill.receiptNo}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.downloadBtn, !bill.id && { opacity: 0.4 }]}
              disabled={!bill.id || downloading === bill.id}
              onPress={() => downloadReceipt(bill)}
            >
              {downloading === bill.id ? (
                <ActivityIndicator size="small" color={COLORS.dark} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={14} color={COLORS.dark} />
                  <Text style={styles.downloadText}>Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Payment History</Text>
        <View style={styles.filterRow}>
          {(['All', 'Paid', 'Unpaid'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {filteredBills.map((bill, i) => (
          <View key={i} style={styles.billCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.billMonth}>{bill.month}</Text>
              <Text style={styles.billDate}>{bill.date}</Text>
            </View>
            <Text style={styles.billAmount}>{bill.amount}</Text>
            <View style={[styles.statusBadge, bill.status === 'Unpaid' && { backgroundColor: `${COLORS.red}1A` }]}> 
              <Text style={[styles.statusText, bill.status === 'Unpaid' && { color: COLORS.red }]}>{bill.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showExpenseModal} transparent animationType="fade" onRequestClose={() => setShowExpenseModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Expense Bill</Text>
            <Text style={styles.modalSub}>Residents will see this entry with a "PDF" button to view the bill.</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Bill title (e.g. Electricity – March)"
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
              placeholder="PDF link (paste a Drive / Dropbox / cloud URL)"
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="none"
              value={newExpense.receipt}
              onChangeText={(t) => setNewExpense({ ...newExpense, receipt: t })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowExpenseModal(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, savingExpense && { opacity: 0.6 }]}
                disabled={savingExpense}
                onPress={async () => {
                  const amount = Number(newExpense.amount);
                  if (!newExpense.title.trim() || !Number.isFinite(amount) || amount <= 0) {
                    Alert.alert('Invalid', 'Title and a positive amount are required.');
                    return;
                  }
                  setSavingExpense(true);
                  try {
                    const res = await fetch(API.EXPENSES, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        title:    newExpense.title.trim(),
                        amount,
                        category: newExpense.category,
                        receipt:  newExpense.receipt.trim() || undefined,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.message || 'Failed to add expense');
                    setShowExpenseModal(false);
                    setNewExpense({ title: '', amount: '', category: 'maintenance', receipt: '' });
                    loadExpenses();
                  } catch (err: any) {
                    Alert.alert('Error', err.message || 'Could not add expense');
                  } finally {
                    setSavingExpense(false);
                  }
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>{savingExpense ? 'Saving…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAmountModal} transparent animationType="fade" onRequestClose={() => setShowAmountModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Monthly Maintenance</Text>
            <Text style={styles.modalSub}>Charged to every flat each month. Residents who haven’t paid by the due day get a reminder.</Text>
            <Text style={styles.fieldLabel}>Monthly amount (₹)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="e.g. 1500"
              placeholderTextColor={COLORS.slate[400]}
              value={amountInput}
              onChangeText={setAmountInput}
            />
            <Text style={styles.fieldLabel}>Due day of month (1–28)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="e.g. 10"
              placeholderTextColor={COLORS.slate[400]}
              value={dueDayInput}
              onChangeText={setDueDayInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowAmountModal(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, savingAmount && { opacity: 0.6 }]}
                disabled={savingAmount}
                onPress={async () => {
                  const amount = Number(amountInput);
                  if (!Number.isFinite(amount) || amount < 0) {
                    Alert.alert('Invalid', 'Enter a valid non-negative number.');
                    return;
                  }
                  const day = dueDayInput.trim() ? Number(dueDayInput) : undefined;
                  if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 28)) {
                    Alert.alert('Invalid', 'Due day must be a whole number between 1 and 28.');
                    return;
                  }
                  setSavingAmount(true);
                  try {
                    const res = await fetch(API.MAINTENANCE_AMOUNT, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ amount, ...(day !== undefined ? { dueDay: day } : {}) }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.message || 'Failed to update');
                    setMonthlyAmount(Number(json.data?.monthlyAmount || amount));
                    if (json.data?.dueDay) setDueDay(Number(json.data.dueDay));
                    setShowAmountModal(false);
                  } catch (err: any) {
                    Alert.alert('Error', err.message || 'Could not update amount');
                  } finally {
                    setSavingAmount(false);
                  }
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>{savingAmount ? 'Saving…' : 'Save'}</Text>
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
  hubBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.primary, borderRadius: 999 },
  hubBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.white, letterSpacing: 1 },
  totalCard: { backgroundColor: '#0E0E0E', borderRadius: 20, padding: 20, marginBottom: 18 },
  totalLabel: { color: '#bbb', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  totalAmount: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 6 },
  avatarStackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#0E0E0E', backgroundColor: '#333' },
  stackOverflow: { backgroundColor: '#922207', alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  stackOverflowText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  viewBreakdown: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#e6f4eb' },
  viewBreakdownText: { fontSize: 12, fontWeight: '800', color: '#0E0E0E' },

  receiptsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  historyLink: { fontSize: 11, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.8 },
  noReceipts: { alignItems: 'center', gap: 8, paddingVertical: 26, backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 10 },
  noReceiptsText: { fontSize: 12.5, color: COLORS.slate[400], fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  receiptCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10 },
  receiptIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${COLORS.primary}1A`, alignItems: 'center', justifyContent: 'center' },
  receiptMonth: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  receiptDate: { fontSize: 10, color: COLORS.slate[400], marginTop: 2, letterSpacing: 0.6, fontWeight: '700' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.slate[200] },
  downloadText: { fontSize: 11, fontWeight: '700', color: COLORS.dark },

  currentBill: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, marginBottom: 32 },
  currentLabel: { fontSize: 10, fontWeight: '700', color: `${COLORS.white}99`, letterSpacing: 2 },
  currentAmount: { fontSize: 36, fontWeight: '900', color: COLORS.white },
  currentDue: { fontSize: 14, color: `${COLORS.white}CC` },
  payNowBtn: { marginTop: 16, paddingHorizontal: 40, paddingVertical: 14, backgroundColor: COLORS.white, borderRadius: 999 },
  payNowText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  editAmountBtn: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: `${COLORS.white}80` },
  editAmountText: { color: COLORS.white, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  secRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.red, borderRadius: 14, padding: 14, marginBottom: 16 },
  overdueText: { flex: 1, color: COLORS.white, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  paidTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  paidTagText: { color: '#1d7a3a', fontSize: 13, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: COLORS.slate[500], marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 22, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  modalSub: { fontSize: 12, color: COLORS.slate[500] },
  modalInput: { padding: 14, borderWidth: 1, borderColor: COLORS.slate[200], borderRadius: 12, fontSize: 16, color: COLORS.dark, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  modalBtnGhost: { backgroundColor: COLORS.slate[100] },
  modalBtnGhostText: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  modalBtnPrimary: { backgroundColor: COLORS.primary },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center' },
  summaryCardWarn: { backgroundColor: `${COLORS.red}12` },
  summaryValue: { fontSize: 22, fontWeight: '800', color: COLORS.dark },
  summaryLabel: { marginTop: 4, fontSize: 10, letterSpacing: 1, fontWeight: '700', color: COLORS.slate[500] },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  breakdownCard: { backgroundColor: COLORS.white, borderRadius: 14, paddingHorizontal: 14, marginBottom: 24 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.slate[100], gap: 10 },
  breakdownLabel: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  breakdownMeta: { fontSize: 10, color: COLORS.slate[400], marginTop: 2, letterSpacing: 0.4, fontWeight: '700' },
  breakdownAmount: { fontSize: 13, fontWeight: '800', color: COLORS.dark },
  breakdownHint: { fontSize: 11, color: COLORS.slate[400], paddingVertical: 14, textAlign: 'center' },
  expensesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addExpenseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.primary },
  addExpenseText: { fontSize: 11, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: `${COLORS.primary}1A` },
  pdfBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.slate[100] },
  catChipActive: { backgroundColor: COLORS.primary },
  catChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slate[600] },
  catChipTextActive: { color: COLORS.white },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slate[500] },
  filterChipTextActive: { color: COLORS.white },
  billCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  billMonth: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  billDate: { fontSize: 12, color: COLORS.slate[400], marginTop: 2 },
  billAmount: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: COLORS.accentGreen },
  statusText: { fontSize: 10, fontWeight: '700', color: COLORS.dark, letterSpacing: 0.5 },
});
