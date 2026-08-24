import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, ApiError } from "../../src/lib/api";
import { colors, radius, space, type } from "../../src/theme";
import { Button, ErrorNote, Label } from "../../src/components/ui";

// =======================================================
// ENTER SOCIETY CODE
//
// Six digits, one box each. The code is the only thing standing
// between a stranger and a society's flat list, so it is verified
// before anything else is shown.
//
// Verification fires on its own once six digits are in — nobody wants
// to type a code and then press a button to find out it was wrong.
// =======================================================

interface Verified {
  societyId: string;
  name: string;
  city: string | null;
}

const LENGTH = 6;

export default function JoinScreen() {

  const router = useRouter();

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<Verified | null>(null);
  const [error, setError] = useState<unknown>(null);

  const inputs = useRef<Array<TextInput | null>>([]);

  const code = digits.join("");

  useEffect(() => {

    if (code.length !== LENGTH) {
      setFound(null);
      setError(null);
      return;
    }

    let cancelled = false;

    setChecking(true);
    setError(null);

    api
      .post<Verified>("/societies/verify-code", { societyCode: code }, { anonymous: true })
      .then((society) => {
        if (!cancelled) setFound(society);
      })
      .catch((err) => {
        if (!cancelled) {
          setFound(null);
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => { cancelled = true; };

  }, [code]);

  const onChange = (index: number, value: string) => {

    // A paste lands entirely in one box; spread it across the rest
    // rather than making someone retype it.
    const cleaned = value.replace(/[^0-9]/g, "");

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < LENGTH - index; i += 1) {
        next[index + i] = cleaned[i] ?? "";
      }
      setDigits(next);
      inputs.current[Math.min(index + cleaned.length, LENGTH - 1)]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

  };

  const onKeyPress = (index: number, key: string) => {
    // Backspace on an empty box steps back, which is what everyone
    // expects and almost nothing implements.
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >

          <Text style={s.header}>Enter Society Code</Text>

          <View style={s.middle}>

            <Label>Join your community</Label>

            <View style={s.boxes}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(el) => { inputs.current[index] = el; }}
                  value={digit}
                  onChangeText={(v) => onChange(index, v)}
                  onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={LENGTH}
                  selectTextOnFocus
                  autoFocus={index === 0}
                  accessibilityLabel={`Digit ${index + 1} of ${LENGTH}`}
                  style={[
                    s.box,
                    digit ? s.boxFilled : null,
                    notFound ? s.boxError : null,
                  ]}
                />
              ))}
            </View>

            {checking && <Text style={s.status}>Validating…</Text>}

            {found && (
              <View style={s.found}>
                <Text style={s.foundText}>
                  Found: {found.name}{found.city ? `, ${found.city}` : ""}
                </Text>
              </View>
            )}

            {error != null && !checking && (
              <View style={{ width: "100%" }}>
                <ErrorNote error={error} />
              </View>
            )}

          </View>

          <View style={s.footer}>

            <Button
              title="Proceed to register"
              disabled={!found}
              onPress={() => {
                if (!found) return;
                router.push({
                  pathname: "/join/welcome",
                  params: {
                    societyId: found.societyId,
                    societyName: found.name,
                    city: found.city ?? "",
                  },
                });
              }}
            />

            <Text style={s.caption}>
              Enter the unique 6-digit key provided by your secretary
            </Text>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

}

const s = StyleSheet.create({

  safe: { flex: 1, backgroundColor: colors.ground },
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },

  header: {
    ...type.label,
    color: colors.accent,
    textAlign: "center",
    paddingVertical: space.lg,
  },

  middle: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.lg },

  boxes: { flexDirection: "row", gap: space.sm },

  box: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  boxFilled: { borderColor: colors.accent, color: colors.accent },
  boxError: { borderColor: colors.danger },

  status: { ...type.small, color: colors.muted },

  found: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  foundText: { ...type.body, color: colors.ink },

  footer: { gap: space.md },

  caption: {
    ...type.small,
    color: colors.muted,
    textAlign: "center",
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.6,
  },

});
