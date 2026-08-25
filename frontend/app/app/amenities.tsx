import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../components/ConfirmDialog';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { PERM, useAuth, useRole } from '../context/AuthContext';

type Amenity = {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  openTime: string;
  closeTime: string;
  chargePerHour?: number;
  slotDurationMinutes?: number;
  requiresApproval?: boolean;
  isBookable: boolean;
  busyNow?: boolean;
  busyUntil?: string | null;
  todayCount?: number;
  nextSlot?: string | null;
};

type Booking = {
  _id: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed';
  bookedBy: string;
  flatNumber?: string;
  isMine?: boolean;
};

type PendingRequest = {
  _id: string;
  amenityName: string;
  amenityIcon: string;
  date: string;
  startTime: string;
  endTime: string;
  bookedBy: string;
  flatNumber?: string;
  purpose?: string;
};

// Next 7 days as { key: 'YYYY-MM-DD', label, sub }.
function nextDays(n: number) {
  const out: { key: string; label: string; sub: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      key,
      label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      sub: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    });
  }
  return out;
}

const STATUS_COLOR: Record<string, string> = { confirmed: '#922207', pending: '#c98a00' };

export default function AmenitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { can } = useRole();

  // The backend gates amenities and their bookings on amenities.manage,
  // which is not the same set as the old isManager grouping —
  // it let a treasurer see controls that would 403, and hid
  // them from a committee member who does hold the permission.
  const isManager = can(PERM.AMENITIES_MANAGE);

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);

  const [selected, setSelected] = useState<Amenity | null>(null);
  const [days] = useState(nextDays(7));
  const [activeDate, setActiveDate] = useState(days[0].key);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [booking, setBooking] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [cancelling, setCancelling] = useState<string | null>(null);
  // Alert.alert is a no-op on the web build. Booking reported EVERY outcome
  // through it — success and failure alike — so the button looked dead and
  // residents concluded amenities could not be booked at all.
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  // Chips read as "1:00 PM", never "01:00" — typing the latter was the whole
  // problem: residents meant the afternoon and the 24h parse read 1 AM.
  const fmt12 = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const suffix = h < 12 ? 'AM' : 'PM';
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  // Selectable start times: every slot inside opening hours that isn't already
  // booked, and — for today — hasn't already passed.
  const startOptions = useMemo(() => {
    if (!selected) return [];
    const step = Math.max(15, selected.slotDurationMinutes || 60);
    const openMin = toMin(selected.openTime || '06:00');
    const closeMin = toMin(selected.closeTime || '22:00');

    const now = new Date();
    const isToday = activeDate === new Date().toISOString().slice(0, 10);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const out: { value: string; label: string; disabled: boolean }[] = [];
    // Stop a step short of closing — a start needs room for an end after it.
    for (let m = openMin; m <= closeMin - step; m += step) {
      const booked = bookings.some((b) => m >= toMin(b.startTime) && m < toMin(b.endTime));
      out.push({ value: toHHMM(m), label: fmt12(toHHMM(m)), disabled: booked || (isToday && m <= nowMin) });
    }
    return out;
  }, [selected, bookings, activeDate]);

  // Selectable end times: after the chosen start, and stopping at whichever
  // comes first — closing time or the next existing booking. That makes an
  // overlapping selection impossible rather than merely rejected afterwards.
  const endOptions = useMemo(() => {
    if (!selected || !startTime) return [];
    const step = Math.max(15, selected.slotDurationMinutes || 60);
    const startMin = toMin(startTime);
    const closeMin = toMin(selected.closeTime || '22:00');

    const nextBooking = bookings
      .map((b) => toMin(b.startTime))
      .filter((s) => s >= startMin)
      .sort((a, b) => a - b)[0];
    const maxEnd = Math.min(closeMin, nextBooking ?? closeMin);

    const out: { value: string; label: string; disabled: boolean }[] = [];
    for (let m = startMin + step; m <= maxEnd; m += step) {
      out.push({ value: toHHMM(m), label: fmt12(toHHMM(m)), disabled: false });
    }
    return out;
  }, [selected, startTime, bookings]);

  // Picking a new start can strand an end that is no longer reachable.
  const pickStart = (value: string) => {
    setStartTime(value);
    setNotice(null);
    if (endTime && toMin(endTime) <= toMin(value)) setEndTime('');
  };

  // Warn the resident the instant their entered window overlaps a booked slot.
  const conflict = useMemo(() => {
    if (!HHMM_RE.test(startTime) || !HHMM_RE.test(endTime)) return null;
    const s = toMin(startTime), e = toMin(endTime);
    if (e <= s) return null;
    return bookings.find((b) => s < toMin(b.endTime) && e > toMin(b.startTime)) || null;
  }, [startTime, endTime, bookings]);

  const loadRequests = useCallback(async () => {
    if (!token || !isManager) return;
    try {
      const res = await fetch(API.PENDING_AMENITY_BOOKINGS, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setRequests(res.ok && Array.isArray(json.data) ? json.data : []);
    } catch {
      setRequests([]);
    }
  }, [token, isManager]);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(API.AMENITIES, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setAmenities(json.data);
      } catch { /* empty */ } finally { setLoading(false); }
    })();
    loadRequests();
  }, [token, loadRequests]);

  const decideRequest = async (id: string, status: 'confirmed' | 'rejected') => {
    if (!token) return;
    setDeciding(id + status);
    try {
      const res = await fetch(API.AMENITY_BOOKING_DECIDE(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Failed');
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (err: any) {
      setNotice({ kind: 'err', text: String(err?.message || 'Could not update request') });
    } finally {
      setDeciding(null);
    }
  };

  const loadBookings = useCallback(async (amenityId: string, date: string) => {
    if (!token) return;
    setBookingsLoading(true);
    try {
      const res = await fetch(API.AMENITY_BOOKINGS(amenityId, date), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setBookings(res.ok && Array.isArray(json.data) ? json.data : []);
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [token]);

  const confirmCancel = (bookingId: string, mine: boolean) =>
    confirm({
      title: 'Delete booking',
      message: mine ? 'Cancel your booking for this slot?' : 'Delete this resident’s booking?',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => cancelBooking(bookingId),
    });

  const cancelBooking = async (bookingId: string) => {
    if (!token) return;
    setCancelling(bookingId);
    try {
      const res = await fetch(API.AMENITY_BOOKING_CANCEL(bookingId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Could not cancel');
      if (selected) loadBookings(selected._id, activeDate);
      setNotice({ kind: 'ok', text: 'Booking cancelled.' });
    } catch (e: any) {
      setNotice({ kind: 'err', text: String(e?.message || 'Could not cancel the booking') });
    } finally {
      setCancelling(null);
    }
  };

  const openAmenity = (a: Amenity) => {
    setSelected(a);
    setActiveDate(days[0].key);
    setStartTime(''); setEndTime(''); setPurpose('');
    loadBookings(a._id, days[0].key);
  };

  const changeDate = (date: string) => {
    setActiveDate(date);
    if (selected) loadBookings(selected._id, date);
  };

  const submitBooking = async () => {
    if (!selected) return;
    setNotice(null);
    if (!HHMM_RE.test(startTime) || !HHMM_RE.test(endTime)) {
      setNotice({ kind: 'err', text: 'Pick a start and an end time.' });
      return;
    }
    if (toMin(endTime) <= toMin(startTime)) {
      setNotice({ kind: 'err', text: 'The end time has to be after the start time.' });
      return;
    }
    setBooking(true);
    try {
      const res = await fetch(API.AMENITY_BOOK(selected._id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: activeDate, startTime, endTime, purpose: purpose.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `Booking failed (${res.status})`);
      setNotice({
        kind: 'ok',
        text: json.data?.status === 'pending'
          ? 'Request sent — the secretary will approve it shortly.'
          : `Booked: ${selected.name}, ${fmt12(startTime)}–${fmt12(endTime)}.`,
      });
      setStartTime(''); setEndTime(''); setPurpose('');
      loadBookings(selected._id, activeDate);
    } catch (err: any) {
      // The backend explains exactly why (overlap, outside opening hours, in
      // the past) — show that rather than a generic failure.
      setNotice({
        kind: 'err',
        text: /failed to fetch|network/i.test(String(err?.message))
          ? 'Couldn’t reach the server. Check your connection and try again.'
          : String(err?.message || 'Could not book that slot.'),
      });
    } finally {
      setBooking(false);
    }
  };


  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Amenities</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12 }}>
        {/* Pending booking requests — managers only */}
        {isManager && requests.length > 0 ? (
          <View style={styles.requestsBlock}>
            <Text style={styles.requestsTitle}>Booking Requests ({requests.length})</Text>
            {requests.map((r) => (
              <View key={r._id} style={styles.requestCard}>
                <View style={styles.requestTop}>
                  <View style={styles.reqIcon}>
                    <Ionicons name={(r.amenityIcon as any) || 'business'} size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reqAmenity}>{r.amenityName}</Text>
                    <Text style={styles.reqMeta}>
                      {new Date(r.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} · {fmt12(r.startTime)}–{fmt12(r.endTime)}
                    </Text>
                    <Text style={styles.reqBy}>{r.bookedBy}{r.flatNumber ? ` · ${r.flatNumber}` : ''}{r.purpose ? ` · ${r.purpose}` : ''}</Text>
                  </View>
                </View>
                <View style={styles.reqActions}>
                  <TouchableOpacity
                    style={[styles.reqBtn, styles.reqReject, deciding === r._id + 'rejected' && { opacity: 0.5 }]}
                    onPress={() => decideRequest(r._id, 'rejected')}
                    disabled={!!deciding}
                  >
                    <Text style={styles.reqRejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reqBtn, styles.reqApprove, deciding === r._id + 'confirmed' && { opacity: 0.5 }]}
                    onPress={() => decideRequest(r._id, 'confirmed')}
                    disabled={!!deciding}
                  >
                    <Text style={styles.reqApproveText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : amenities.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={32} color={COLORS.slate[400]} />
            <Text style={styles.emptyText}>No amenities added yet. Your society admin sets these up.</Text>
          </View>
        ) : (
          amenities.map((a) => (
            <TouchableOpacity
              key={a._id}
              style={styles.card}
              activeOpacity={a.isBookable ? 0.85 : 1}
              onPress={() => a.isBookable && openAmenity(a)}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={(a.icon as any) || 'business'} size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{a.name}</Text>
                <Text style={styles.cardMeta}>{a.openTime}–{a.closeTime}{a.chargePerHour ? `  •  ₹${a.chargePerHour}/hr` : '  •  Free'}</Text>
                {a.isBookable ? (
                  <View style={styles.statusLine}>
                    <View style={[styles.statusDot, { backgroundColor: a.busyNow ? '#922207' : '#1d7a3a' }]} />
                    <Text style={[styles.statusLabel, { color: a.busyNow ? '#922207' : '#1d7a3a' }]}>
                      {a.busyNow ? `BUSY · till ${a.busyUntil}` : 'FREE NOW'}
                    </Text>
                    <Text style={styles.statusSub}>
                      {a.todayCount ? `${a.todayCount} booked today` : 'no bookings today'}
                      {!a.busyNow && a.nextSlot ? ` · next ${a.nextSlot}` : ''}
                    </Text>
                  </View>
                ) : a.description ? (
                  <Text style={styles.cardDesc} numberOfLines={1}>{a.description}</Text>
                ) : null}
              </View>
              {a.isBookable ? (
                <View style={styles.bookPill}><Text style={styles.bookPillText}>BOOK</Text></View>
              ) : (
                <View style={[styles.bookPill, styles.infoPill]}><Text style={styles.infoPillText}>INFO</Text></View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Booking modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{selected?.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={COLORS.slate[500]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>Open {selected?.openTime}–{selected?.closeTime}{selected?.requiresApproval ? '  •  needs approval' : ''}</Text>

            {/* Date chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {days.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.dateChip, activeDate === d.key && styles.dateChipActive]}
                  onPress={() => changeDate(d.key)}
                >
                  <Text style={[styles.dateChipLabel, activeDate === d.key && styles.dateChipTextActive]}>{d.label}</Text>
                  <Text style={[styles.dateChipSub, activeDate === d.key && styles.dateChipTextActive]}>{d.sub}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Existing bookings for that day — everyone sees booked windows */}
            <Text style={styles.blockLabel}>BOOKED SLOTS</Text>
            {bookingsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : bookings.length === 0 ? (
              <View style={styles.freeBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#1d7a3a" />
                <Text style={styles.freeBannerText}>All slots free on this day</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {bookings.map((b) => (
                  <View key={b._id} style={styles.slotRow}>
                    <Ionicons name="time" size={16} color={STATUS_COLOR[b.status] || COLORS.slate[400]} />
                    <Text style={styles.slotTime}>{fmt12(b.startTime)} – {fmt12(b.endTime)}</Text>
                    <Text style={styles.slotBy}>{b.isMine ? 'You' : b.bookedBy}{b.flatNumber ? ` (${b.flatNumber})` : ''}</Text>
                    <View style={[styles.slotStatus, { backgroundColor: `${STATUS_COLOR[b.status]}1A` }]}>
                      <Text style={[styles.slotStatusText, { color: STATUS_COLOR[b.status] }]}>{b.status.toUpperCase()}</Text>
                    </View>
                    {(b.isMine || isManager) ? (
                      cancelling === b._id ? (
                        <ActivityIndicator size="small" color={COLORS.red} />
                      ) : (
                        <TouchableOpacity onPress={() => confirmCancel(b._id, !!b.isMine)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                        </TouchableOpacity>
                      )
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Booking form */}
            <Text style={[styles.blockLabel, { marginTop: 16 }]}>BOOK A SLOT</Text>
            <Text style={styles.fieldLabel}>Start</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChipRow}>
              {startOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  disabled={opt.disabled}
                  onPress={() => pickStart(opt.value)}
                  style={[
                    styles.timeChip,
                    startTime === opt.value && styles.timeChipActive,
                    opt.disabled && styles.timeChipDisabled,
                  ]}
                >
                  <Text style={[
                    styles.timeChipText,
                    startTime === opt.value && styles.timeChipTextActive,
                    opt.disabled && styles.timeChipTextDisabled,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {startOptions.length === 0 ? <Text style={styles.timeEmpty}>No slots left today.</Text> : null}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>End</Text>
            {startTime ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChipRow}>
                {endOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => { setEndTime(opt.value); setNotice(null); }}
                    style={[styles.timeChip, endTime === opt.value && styles.timeChipActive]}
                  >
                    <Text style={[styles.timeChipText, endTime === opt.value && styles.timeChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.timeEmpty}>Pick a start time first.</Text>
            )}
            <TextInput value={purpose} onChangeText={setPurpose} placeholder="Purpose (optional) e.g. Birthday party" placeholderTextColor={COLORS.slate[400]} style={styles.purposeInput} />

            {conflict ? (
              <View style={styles.conflictBanner}>
                <Ionicons name="warning" size={16} color="#922207" />
                <Text style={styles.conflictText}>
                  Already booked {fmt12(conflict.startTime)}–{fmt12(conflict.endTime)} ({conflict.status}). Please choose another time.
                </Text>
              </View>
            ) : null}

            {notice ? (
              <TouchableOpacity
                style={[styles.noticeBanner, notice.kind === 'ok' ? styles.noticeOk : styles.noticeErr]}
                onPress={() => setNotice(null)}
                activeOpacity={0.9}
              >
                <Ionicons
                  name={notice.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={notice.kind === 'ok' ? '#1d7a3a' : '#922207'}
                />
                <Text style={[styles.noticeText, notice.kind === 'ok' && { color: '#1d7a3a' }]}>{notice.text}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={[styles.bookBtn, (booking || !!conflict) && { opacity: 0.5 }]} onPress={submitBooking} disabled={booking || !!conflict}>
              {booking ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.bookBtnText}>{conflict ? 'Slot Unavailable' : 'Confirm Booking'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 13, color: COLORS.slate[400], textAlign: 'center' },
  requestsBlock: { backgroundColor: `${COLORS.primary}0D`, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: `${COLORS.primary}26` },
  requestsTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  requestCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 12, gap: 10 },
  requestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  reqAmenity: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  reqMeta: { fontSize: 12, color: COLORS.slate[600], marginTop: 1, fontWeight: '600' },
  reqBy: { fontSize: 11, color: COLORS.slate[500], marginTop: 1 },
  reqActions: { flexDirection: 'row', gap: 8 },
  reqBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  reqReject: { backgroundColor: COLORS.slate[100] },
  reqRejectText: { fontSize: 13, fontWeight: '700', color: COLORS.slate[600] },
  reqApprove: { backgroundColor: COLORS.primary },
  reqApproveText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: `${COLORS.primary}14`, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  cardMeta: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  cardDesc: { fontSize: 11, color: COLORS.slate[400], marginTop: 2 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  statusSub: { fontSize: 10, color: COLORS.slate[400] },
  bookPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.primary },
  bookPillText: { fontSize: 10, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  infoPill: { backgroundColor: COLORS.slate[100] },
  infoPillText: { fontSize: 10, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 1 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.slate[300], marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  sheetSub: { fontSize: 12, color: COLORS.slate[500], marginTop: 2 },
  dateChip: { width: 60, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 1, borderColor: COLORS.slate[200] },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateChipLabel: { fontSize: 12, fontWeight: '800', color: COLORS.dark },
  dateChipSub: { fontSize: 10, color: COLORS.slate[500], marginTop: 2 },
  dateChipTextActive: { color: COLORS.white },
  blockLabel: { fontSize: 10, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 1 },
  freeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#e6f4eb', marginTop: 8 },
  freeBannerText: { fontSize: 13, fontWeight: '600', color: '#1d7a3a' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white, borderRadius: 12, padding: 12 },
  slotTime: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  slotBy: { flex: 1, fontSize: 12, color: COLORS.slate[500] },
  slotStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  slotStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.slate[500], marginBottom: 4 },
  timeChipRow: { gap: 8, paddingVertical: 6, paddingRight: 8 },
  timeChip: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.slate[200] },
  timeChipActive: { backgroundColor: '#922207', borderColor: '#922207' },
  timeChipDisabled: { backgroundColor: COLORS.slate[100], borderColor: COLORS.slate[200] },
  timeChipText: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  timeChipTextActive: { color: COLORS.white },
  timeChipTextDisabled: { color: COLORS.slate[400], textDecorationLine: 'line-through' },
  timeEmpty: { fontSize: 13, color: COLORS.slate[500], paddingVertical: 10 },
  purposeInput: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.slate[200], marginTop: 10 },
  conflictBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#fdecec', borderWidth: 1, borderColor: '#92220733' },
  conflictText: { flex: 1, fontSize: 12.5, color: '#922207', fontWeight: '700', lineHeight: 17 },
  bookBtn: { marginTop: 14, paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center' },
  bookBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 10, borderWidth: 1,
  },
  noticeOk: { backgroundColor: '#eaf6ee', borderColor: '#c5e4d0' },
  noticeErr: { backgroundColor: '#fdeceb', borderColor: '#f5c6c2' },
  noticeText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#922207', lineHeight: 17 },
});
