import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../src/lib/auth";
import { colors, space, type } from "../../src/theme";
import { Button, ErrorNote, Field } from "../../src/components/ui";

// =======================================================
// SIGN IN
//
// Email or phone, both accepted by the backend. A resident whose
// secretary has not approved them yet gets a 403 with a message
// saying so — that is not a failed sign-in, and the copy should not
// suggest they got their password wrong.
// =======================================================

export default function SignInScreen() {

  const router = useRouter();
  const { signInWithPassword } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(identifier.trim(), password);
      router.replace("/(app)");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          <View style={{ gap: space.xs }}>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.sub}>Sign in with the details you registered with.</Text>
          </View>

          <ErrorNote error={error} />

          <Field
            label="Email or phone"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />

          <Button
            title="Sign in"
            loading={busy}
            disabled={!identifier.trim() || password.length < 6}
            onPress={submit}
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.xl, gap: space.lg },
  title: { ...type.display, color: colors.ink },
  sub: { ...type.body, color: colors.muted },
});
