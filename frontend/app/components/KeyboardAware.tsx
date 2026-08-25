import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, ViewStyle } from 'react-native';

/**
 * Wrap any screen's content so the keyboard never hides inputs / buttons.
 *
 * - iOS: KeyboardAvoidingView (padding) lifts content above the keyboard.
 * - Android: relies on `softwareKeyboardLayoutMode: "resize"` (app.json), so we
 *   leave KAV behavior undefined to avoid double-adjusting.
 *
 * Use `scroll` (default true) to make the content scrollable when the keyboard
 * shrinks the visible area.
 */
export function KeyboardAwareScreen({
  children,
  style,
  contentStyle,
  scroll = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  scroll?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.grow, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});
