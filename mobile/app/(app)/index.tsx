import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../src/lib/api";
import { useAuth, isGuard, type User } from "../../src/lib/auth";
import { colors, space, type } from "../../src/theme";
import { Card, Empty, ErrorNote, Loading, Pill } from "../../src/components/ui";

// =======================================================
// HOME
//
// What needs attention, in the order it needs it: the urgent notice,
// then what is coming up, then what was announced, then anything of
// the resident's own that is still open.
// =======================================================

interface Dashboard {
  user: { name: string; flat?: string; wing?: string };
  urgentNotice?: { _id: string; title: string; description: string; createdAt?: string } | null;
  announcements?: Array<{ _id: string; title: string; category?: string; createdAt?: string }>;
  upcomingEvent?: {
    _id: string; title: string; eventDate?: string | null; time?: string; location?: string;
  } | null;
  myComplaints?: Array<{ _id: string; title: string; status?: string }>;
  myBills?: Array<{ _id: string; month?: string; amount?: number; status?: string }>;
}

const ago = (iso?: string) => {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 2880) return "Yesterday";
  return `${Math.floor(mins / 1440)}d ago`;
};

const money = (n?: number) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

export default function HomeScreen() {

  const { user } = useAuth();
  const guard = isGuard(user);

  const dash = useQuery({
    queryKey: ["dashboard"],
    // A guard has no flat, no bills and no complaints — the dashboard
    // would answer, but with nothing that applies to them.
    enabled: !guard,
    queryFn: () => api.get<Dashboard>("/residents/dashboard"),
  });

  if (guard) return <GuardHome user={user} />;

  const d = dash.data;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={dash.isFetching} onRefresh={() => dash.refetch()} />
        }
      >

        <View>
          <Text style={s.hi}>Hi, {user?.name?.split(" ")[0] ?? "there"}</Text>
          <Text style={s.where}>
            {[d?.user?.wing && `Wing ${d.user.wing}`, d?.user?.flat]
              .filter(Boolean).join("  •  ") || "Loading your home"}
          </Text>
        </View>

        <ErrorNote error={dash.error} />

        {dash.isLoading ? <Loading /> : (
          <>

            {d?.urgentNotice && (
              <Card style={s.urgent}>
                <View style={s.rowBetween}>
                  <Pill tone="danger">urgent</Pill>
                  <Text style={s.time}>{ago(d.urgentNotice.createdAt)}</Text>
                </View>
                <Text style={s.cardTitle}>{d.urgentNotice.title}</Text>
                <Text style={s.cardBody}>{d.urgentNotice.description}</Text>
              </Card>
            )}

            {d?.upcomingEvent && (
              <Card>
                <Text style={s.sectionLabel}>Coming up</Text>
                <Text style={s.cardTitle}>{d.upcomingEvent.title}</Text>
                <Text style={s.cardBody}>
                  {[d.upcomingEvent.eventDate, d.upcomingEvent.time, d.upcomingEvent.location]
                    .filter(Boolean).join("  •  ")}
                </Text>
              </Card>
            )}

            {Boolean(d?.myBills?.length) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Your maintenance</Text>
                {d!.myBills!.map((b) => (
                  <Card key={b._id}>
                    <View style={s.rowBetween}>
                      <View>
                        <Text style={s.cardTitle}>{money(b.amount)}</Text>
                        <Text style={s.cardBody}>{b.month ?? "This cycle"}</Text>
                      </View>
                      <Pill tone={b.status === "paid" ? "ok" : "warn"}>
                        {b.status ?? "pending"}
                      </Pill>
                    </View>
                  </Card>
                ))}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionLabel}>Announcements</Text>
              {d?.announcements?.length ? d.announcements.map((a) => (
                <Card key={a._id}>
                  <View style={s.rowBetween}>
                    <Pill tone="muted">{a.category ?? "general"}</Pill>
                    <Text style={s.time}>{ago(a.createdAt)}</Text>
                  </View>
                  <Text style={s.cardTitle}>{a.title}</Text>
                </Card>
              )) : <Empty>Nothing announced recently.</Empty>}
            </View>

            {Boolean(d?.myComplaints?.length) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Your complaints</Text>
                {d!.myComplaints!.map((c) => (
                  <Card key={c._id}>
                    <View style={s.rowBetween}>
                      <Text style={[s.cardTitle, { flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                      <Pill tone={c.status === "resolved" ? "ok" : "warn"}>
                        {c.status ?? "open"}
                      </Pill>
                    </View>
                  </Card>
                ))}
              </View>
            )}

          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );

}

// =======================================================
// GUARD HOME
//
// A guard opens the app standing at a gate with someone waiting. The
// two things they do — scan a pass, ask a resident about a walk-up —
// are the whole screen.
// =======================================================

function GuardHome({ user }: { user: User | null }) {

  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.content}>

        <View>
          <Text style={s.hi}>Gate</Text>
          <Text style={s.where}>{user?.name ?? ""}  •  on duty</Text>
        </View>

        <Card>
          <Text style={s.sectionLabel}>Expected visitor</Text>
          <Text style={s.cardTitle}>Scan a guest pass</Text>
          <Text style={s.cardBody}>
            Point the camera at the resident's pass to record entry or exit.
          </Text>
          <Text style={s.link} onPress={() => router.push("/(app)/scan")}>Open scanner</Text>
        </Card>

        <Card>
          <Text style={s.sectionLabel}>Walk-up</Text>
          <Text style={s.cardTitle}>Ask a resident</Text>
          <Text style={s.cardBody}>
            No pass? Send the flat an approval request and wait for their answer.
          </Text>
          <Text style={s.link} onPress={() => router.push("/(app)/visitors")}>
            Open requests
          </Text>
        </Card>

      </View>
    </SafeAreaView>
  );

}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.lg, gap: space.lg },
  hi: { ...type.display, color: colors.ink },
  where: { ...type.body, color: colors.muted, marginTop: 2 },
  section: { gap: space.sm },
  urgent: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { ...type.label, color: colors.muted },
  cardTitle: { ...type.heading, color: colors.ink, marginTop: space.xs },
  cardBody: { ...type.body, color: colors.inkSoft, marginTop: space.xs },
  time: { ...type.small, color: colors.muted },
  link: { ...type.bodyStrong, color: colors.accent, marginTop: space.md },
});
