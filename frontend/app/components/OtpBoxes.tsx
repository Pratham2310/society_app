import React, { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

type Props = {
  value: string[];               // always length 6, one character per box
  onChange: (next: string[]) => void;
  editable?: boolean;
};

/**
 * Six single-digit boxes for an OTP.
 *
 * Two behaviours matter more than they look:
 *  - a PASTED or auto-filled code arrives as one long string in whichever box
 *    has focus, and must be spread across the boxes. The WhatsApp message
 *    carries a "copy code" button, so pasting is the common path, and dropping
 *    it makes the screen look frozen.
 *  - backspace on an empty box clears the previous one, so the code can be
 *    deleted without tapping each box.
 */
export default function OtpBoxes({ value, onChange, editable = true }: Props) {
  const refs = useRef<(TextInput | null)[]>([]);

  const handleChange = (raw: string, index: number) => {
    const digits = raw.replace(/\D/g, '');

    if (digits.length > 1) {
      const next = [...value];
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        next[index + i] = digits[i];
      }
      onChange(next);
      refs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }

    const next = [...value];
    next[index] = digits;
    onChange(next);
    if (digits && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e?.nativeEvent?.key !== 'Backspace') return;
    if (value[index]) return;   // digit present — let the normal delete happen
    if (index === 0) return;
    const next = [...value];
    next[index - 1] = '';
    onChange(next);
    refs.current[index - 1]?.focus();
  };

  return (
    <View style={styles.row}>
      {value.map((digit, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          style={[styles.box, !editable && styles.boxDisabled]}
          // 6, not 1, so a pasted code reaches handleChange intact.
          maxLength={6}
          value={digit}
          editable={editable}
          onChangeText={(v) => handleChange(v, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: {
    width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: '700',
    borderRadius: 12, borderWidth: 1, borderColor: '#ece7e5',
    backgroundColor: '#fff', color: '#090C02',
  },
  boxDisabled: { backgroundColor: '#f4f0ee', color: '#8a7f7a' },
});
