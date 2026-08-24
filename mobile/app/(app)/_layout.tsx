import { Redirect, Tabs } from "expo-router";

import { useAuth, isGuard } from "../../src/lib/auth";
import { colors, type } from "../../src/theme";

// =======================================================
// SIGNED-IN SHELL
//
// One app, two faces. A guard works the gate; everyone else lives
// here. Two apps would mean two EAS pipelines and two store releases
// for what is a different tab set.
// =======================================================

export default function AppLayout() {

  const { user } = useAuth();

  if (!user) return <Redirect href="/join" />;

  const guard = isGuard(user);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...type.small, fontWeight: "600" },
      }}
    >

      {/* A guard's home is the scanner. */}
      <Tabs.Screen
        name="index"
        options={{ title: guard ? "Gate" : "Home" }}
      />

      <Tabs.Screen
        name="notices"
        options={{ title: "Notices", href: guard ? null : undefined }}
      />

      <Tabs.Screen
        name="visitors"
        options={{ title: guard ? "Requests" : "Visitors" }}
      />

      <Tabs.Screen
        name="profile"
        options={{ title: "Profile" }}
      />

      {/* Reached from the guard home, never from the tab bar. */}
      <Tabs.Screen name="scan" options={{ href: null }} />

    </Tabs>
  );

}
