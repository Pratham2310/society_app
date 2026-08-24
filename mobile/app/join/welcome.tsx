import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, space, type } from "../../src/theme";
import { Button } from "../../src/components/ui";

// =======================================================
// WELCOME
//
// Confirms the resident found the right society before they spend
// four steps filling in a form for the wrong one.
// =======================================================

export default function WelcomeScreen() {

  const router = useRouter();
  const { societyId, societyName, city } = useLocalSearchParams<{
    societyId: string; societyName: string; city: string;
  }>();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>

        {/* A photo of the building goes here once the design assets
            land; a plain block is better than a broken image. */}
        <View style={s.hero} />

        <View style={s.middle}>
          <Text style={s.title}>Welcome to {societyName}!</Text>
          {city ? <Text style={s.city}>{city}</Text> : null}
        </View>

        <View style={s.actions}>
          <Button
            title="Register"
            onPress={() =>
              router.push({ pathname: "/join/register", params: { societyId, societyName } })
            }
          />
          <Button
            title="Already a resident? Step in"
            variant="ghost"
            onPress={() => router.push("/join/sign-in")}
          />
        </View>

      </View>
    </SafeAreaView>
  );

}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { flex: 1, padding: space.xl, gap: space.xl },
  hero: {
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.sunk,
    borderWidth: 1,
    borderColor: colors.line,
  },
  middle: { flex: 1, gap: space.xs },
  title: { ...type.display, color: colors.ink },
  city: { ...type.body, color: colors.muted },
  actions: { gap: space.md },
});
