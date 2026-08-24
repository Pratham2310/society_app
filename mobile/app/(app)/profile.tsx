import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth, isCommittee, isGuard } from "../../src/lib/auth";
import {
  registerForPush, unregisterPush, PUSH_BLOCKER_TEXT, type PushBlocker,
} from "../../src/lib/push";
import { colors, space, type } from "../../src/theme";
import { Button, Card, Pill } from "../../src/components/ui";

// =======================================================
// PROFILE
//
// Who you are, which flat the society has you in, and the two things
// worth changing from a phone: notifications and signing out.
// =======================================================

const LABELS: Record<string, string> = {
  chairman: "Chairman",
  secretary: "Secretary",
  treasurer: "Treasurer",
  committee_member: "Committee member",
  member: "Resident",
  security: "Security",
};

export default function ProfileScreen() {

  const { user, signOut } = useAuth();
  const qc = useQueryClient();

  const [pushToken, setPushToken] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<PushBlocker | null>(null);
  const [enabling, setEnabling] = useState(true);

  useEffect(() => {
    // Registering on mount rather than behind a button: the resident
    // already agreed to alerts during registration, and a visitor
    // waiting at the gate is the whole point of the notification.
    let alive = true;
    registerForPush().then((result) => {
      if (!alive) return;
      setPushToken(result.token);
      setBlocked(result.blocked ?? null);
      setEnabling(false);
    });
    return () => { alive = false; };
  }, []);

  const leave = () => {
    Alert.alert("Sign out?", "You will need your password to get back in.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await unregisterPush(pushToken);
          qc.clear();
          await signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content}>

        <Text style={s.title}>Profile</Text>

        <Card>
          <View style={s.head}>
            <View style={s.avatar}>
              <Text style={s.initial}>{user?.name?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{user?.name}</Text>
              <Text style={s.meta}>{user?.email}</Text>
            </View>
          </View>

          <View style={s.tags}>
            <Pill tone={isCommittee(user) ? "info" : "muted"}>
              {LABELS[user?.societyRole ?? ""] ?? user?.societyRole}
            </Pill>
            {user?.status && (
              <Pill tone={user.status === "approved" ? "ok" : "warn"}>{user.status}</Pill>
            )}
          </View>
        </Card>

        <Card>
          <Text style={s.sectionLabel}>Notifications</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Alerts on this device</Text>
              <Text style={s.meta}>
                {enabling ? "Checking…"
                  : pushToken ? "Visitor approvals and notices reach this phone."
                    : blocked ? PUSH_BLOCKER_TEXT[blocked]
                      : "Alerts are off."}
              </Text>
            </View>
            <Switch
              value={Boolean(pushToken)}
              disabled={enabling}
              trackColor={{ true: colors.accent, false: colors.line }}
              onValueChange={async (on) => {
                setEnabling(true);
                if (on) {
                  const result = await registerForPush();
                  setPushToken(result.token);
                  setBlocked(result.blocked ?? null);
                } else {
                  await unregisterPush(pushToken);
                  setPushToken(null);
                  setBlocked(null);
                }
                setEnabling(false);
              }}
            />
          </View>
        </Card>

        {isGuard(user) && (
          <Card>
            <Text style={s.sectionLabel}>On duty</Text>
            <Text style={s.meta}>
              You are signed in as security. Signing out ends your access to the
              scanner until you sign back in.
            </Text>
          </Card>
        )}

        <Button title="Sign out" variant="danger" onPress={leave} />

      </ScrollView>
    </SafeAreaView>
  );

}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.lg, gap: space.lg },
  title: { ...type.display, color: colors.ink },
  head: { flexDirection: "row", gap: space.md, alignItems: "center" },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.accentTint,
    alignItems: "center", justifyContent: "center",
  },
  initial: { ...type.title, color: colors.accent },
  name: { ...type.heading, color: colors.ink },
  meta: { ...type.small, color: colors.muted, marginTop: 2 },
  tags: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  sectionLabel: { ...type.label, color: colors.muted, marginBottom: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowTitle: { ...type.bodyStrong, color: colors.ink },
});
