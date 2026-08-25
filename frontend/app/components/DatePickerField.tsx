import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/Colors';

/**
 * A tap-to-open calendar date picker that behaves identically on web and
 * native (no native date-picker dependency).
 *
 * `value` / `onChange` use "YYYY-MM-DD" strings — empty string means "not set".
 */
type Props = {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  /** Earliest selectable date (default: today). */
  minDate?: Date;
  /** Show the "+1 week / +1 month / +3 months" shortcuts. */
  quickOptions?: boolean;
  /** Allow clearing back to empty. */
  clearable?: boolean;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const parseKey = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

export default function DatePickerField({
  value, onChange, placeholder = 'Select a date',
  minDate, quickOptions = true, clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseKey(value);
  const min = startOfDay(minDate || new Date());
  const [cursor, setCursor] = useState<Date>(() => selected || new Date());

  // Build the month grid: leading blanks + each day of the month.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) out.push(new Date(year, month, day));
    return out;
  }, [cursor]);

  const label = selected
    ? selected.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const pick = (d: Date) => { onChange(toKey(d)); setOpen(false); };

  const quick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onChange(toKey(d));
    setOpen(false);
  };

  const openPicker = () => { setCursor(selected || new Date()); setOpen(true); };

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
        <Text style={[styles.fieldText, !label && styles.fieldPlaceholder]} numberOfLines={1}>
          {label || placeholder}
        </Text>
        {label && clearable ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.slate[400]} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={18} color={COLORS.slate[400]} />
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            {/* Month navigation */}
            <View style={styles.headRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              >
                <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              >
                <Ionicons name="chevron-forward" size={20} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {/* Weekday header */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`b-${i}`} style={styles.cell} />;
                const key = toKey(d);
                const disabled = startOfDay(d) < min;
                const isSelected = value === key;
                const isToday = key === toKey(new Date());
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                    disabled={disabled}
                    onPress={() => pick(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.cellText,
                      disabled && styles.cellTextDisabled,
                      isToday && !isSelected && styles.cellTextToday,
                      isSelected && styles.cellTextSelected,
                    ]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {quickOptions ? (
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickChip} onPress={() => quick(7)}><Text style={styles.quickText}>+1 week</Text></TouchableOpacity>
                <TouchableOpacity style={styles.quickChip} onPress={() => quick(30)}><Text style={styles.quickText}>+1 month</Text></TouchableOpacity>
                <TouchableOpacity style={styles.quickChip} onPress={() => quick(90)}><Text style={styles.quickText}>+3 months</Text></TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.actions}>
              {clearable ? (
                <TouchableOpacity style={[styles.actionBtn, styles.ghost]} onPress={() => { onChange(''); setOpen(false); }}>
                  <Text style={styles.ghostText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.actionBtn, styles.primary]} onPress={() => setOpen(false)}>
                <Text style={styles.primaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: COLORS.slate[200],
  },
  fieldText: { flex: 1, fontSize: 14, color: COLORS.dark, fontWeight: '600' },
  fieldPlaceholder: { color: COLORS.slate[400], fontWeight: '400' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 20, padding: 18 },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '800', color: COLORS.dark },

  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '800', color: COLORS.slate[400] },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: COLORS.primary, borderRadius: 999 },
  cellText: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  cellTextDisabled: { color: COLORS.slate[300] },
  cellTextToday: { color: COLORS.primary, fontWeight: '900' },
  cellTextSelected: { color: COLORS.white, fontWeight: '900' },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'center' },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: `${COLORS.primary}12` },
  quickText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  ghost: { backgroundColor: COLORS.slate[100] },
  ghostText: { fontSize: 14, fontWeight: '800', color: COLORS.slate[600] },
  primary: { backgroundColor: COLORS.primary },
  primaryText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
});
