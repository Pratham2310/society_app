import type { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from "react-native";

import { colors, radius, shadow, space, type } from "../theme";
import { ApiError } from "../lib/api";

// =======================================================
// PRIMITIVES
//
// The handful of pieces every screen needs, so screens describe what
// they show rather than how it is painted.
// =======================================================

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={s.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && s.muted]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Button({
  title, onPress, variant = "primary", disabled, loading, style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {

  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        variant === "primary" && s.btnPrimary,
        variant === "ghost" && s.btnGhost,
        variant === "danger" && s.btnDanger,
        pressed && !inactive && s.btnPressed,
        inactive && s.btnDisabled,
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? colors.white : colors.accent}
          style={{ marginRight: space.sm }}
        />
      )}
      <Text
        style={[
          s.btnText,
          variant === "primary" ? s.btnTextPrimary : s.btnTextDark,
          variant === "danger" && { color: colors.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );

}

export function Field({
  label, hint, ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.muted}
        style={s.input}
        {...props}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Pill({
  children, tone = "muted",
}: { children: ReactNode; tone?: "ok" | "warn" | "danger" | "info" | "muted" }) {

  const map = {
    ok: [colors.okTint, colors.ok],
    warn: [colors.warnTint, colors.warn],
    danger: [colors.dangerTint, colors.danger],
    info: [colors.infoTint, colors.info],
    muted: [colors.sunk, colors.muted],
  } as const;

  const [bg, fg] = map[tone];

  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{children}</Text>
    </View>
  );

}

export function ErrorNote({ error }: { error: unknown }) {

  if (!error) return null;

  const message =
    error instanceof ApiError ? error.message
      : error instanceof Error ? error.message
        : "Something went wrong";

  // 403 during registration usually means "awaiting approval", which
  // is not an error the resident can act on by retrying.
  const hint =
    error instanceof ApiError && error.status === 403
      ? "Your secretary still needs to approve your account."
      : null;

  return (
    <View style={s.errorNote}>
      <Text style={s.errorText}>{message}</Text>
      {hint ? <Text style={s.errorHint}>{hint}</Text> : null}
    </View>
  );

}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={[s.body, s.muted]}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={s.empty}>
      <Text style={[s.body, s.muted, { textAlign: "center" }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: colors.ground },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },

  title: { ...type.title, color: colors.ink },
  heading: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.inkSoft },
  muted: { color: colors.muted },
  label: { ...type.label, color: colors.muted },
  hint: { ...type.small, color: colors.muted },

  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: colors.surface, borderColor: colors.lineStrong },
  btnDanger: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...type.bodyStrong, letterSpacing: 0.3 },
  btnTextPrimary: { color: colors.white },
  btnTextDark: { color: colors.ink },

  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },

  errorNote: {
    backgroundColor: colors.dangerTint,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  errorText: { ...type.body, color: colors.danger },
  errorHint: { ...type.small, color: colors.danger, opacity: 0.85 },

  loading: { padding: space.xl, alignItems: "center", gap: space.sm },
  empty: { padding: space.xl, alignItems: "center" },

});
