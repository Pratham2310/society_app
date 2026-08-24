import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, space, type } from "../../src/theme";
import { Button } from "../../src/components/ui";

// =======================================================
// AWAITING APPROVAL
//
// Registration succeeds but the account lands as pending, and the
// backend refuses a sign-in until the committee approves. Saying so
// here stops the resident trying to log in and reading "not verified"
// as a mistake they made.
// =======================================================

export default function SubmittedScreen() {

  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>

        <View style={s.middle}>
          <View style={s.mark} />
          <Text style={s.title}>Registration sent</Text>
          <Text style={s.body}>
            Your society's secretary now needs to approve you. They can see your
            name and flat, and it usually takes a day or two.
          </Text>
          <Text style={s.body}>
            You will not be able to sign in until they do. We will notify you the
            moment it happens.
          </Text>
        </View>

        <Button title="Back to sign in" variant="ghost" onPress={() => router.replace("/join/sign-in")} />

      </View>
    </SafeAreaView>
  );

}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { flex: 1, padding: space.xl, gap: space.lg },
  middle: { flex: 1, justifyContent: "center", gap: space.md },
  mark: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.okTint, borderWidth: 2, borderColor: colors.ok,
    marginBottom: space.sm,
  },
  title: { ...type.display, color: colors.ink },
  body: { ...type.body, color: colors.muted, lineHeight: 22 },
});
