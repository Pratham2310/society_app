import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/Colors';

/**
 * In-app confirmation dialog.
 *
 * `Alert.alert` with buttons is a no-op on the web build, so any action
 * gated behind it silently does nothing. This renders a real modal that
 * behaves identically on web and native.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   onPress={() => confirm({
 *     title: 'Delete complaint?',
 *     message: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     destructive: true,
 *     onConfirm: async () => { await doDelete(); },
 *   })}
 *   ...
 *   {dialog}
 */
export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void | Promise<void>;
};

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((o: ConfirmOptions) => setOpts(o), []);
  const close = useCallback(() => { if (!busy) setOpts(null); }, [busy]);

  const run = useCallback(async () => {
    if (!opts) return;
    setBusy(true);
    try {
      await opts.onConfirm();
      setOpts(null);
    } finally {
      setBusy(false);
    }
  }, [opts]);

  const destructive = Boolean(opts?.destructive);
  const accent = destructive ? COLORS.red : COLORS.primary;

  const dialog = (
    <Modal visible={!!opts} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}15` }]}>
            <Ionicons name={opts?.icon || (destructive ? 'trash' : 'help-circle')} size={26} color={accent} />
          </View>
          <Text style={styles.title}>{opts?.title}</Text>
          {opts?.message ? <Text style={styles.message}>{opts.message}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} disabled={busy} onPress={close}>
              <Text style={styles.ghostText}>{opts?.cancelLabel || 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: accent }, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={run}
            >
              {busy
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.confirmText}>{opts?.confirmLabel || 'Confirm'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { confirm, dialog };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 20, padding: 22, alignItems: 'center' },
  iconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.dark, textAlign: 'center' },
  message: { fontSize: 13.5, color: COLORS.slate[500], textAlign: 'center', marginTop: 6, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ghost: { backgroundColor: COLORS.slate[100] },
  ghostText: { fontSize: 15, fontWeight: '800', color: COLORS.slate[600] },
  confirmText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});
