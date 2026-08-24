import { useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, newIdempotencyKey } from "../../src/lib/api";
import { useAuth, isGuard } from "../../src/lib/auth";
import { colors, radius, space, type } from "../../src/theme";
import { Button, Card, Empty, ErrorNote, Field, Loading, Pill } from "../../src/components/ui";

// =======================================================
// VISITORS
//
// For a resident: someone is standing at the gate right now and the
// guard is waiting on an answer, so approvals come first and the
// resident's own guest passes come second.
//
// For a guard: the requests they raised, and the ability to take one
// back when the visitor gives up and leaves.
// =======================================================

interface Approval {
  _id: string;
  visitorName: string;
  visitorPhone: string;
  visitorPhoto?: string | null;
  vehicleNumber?: string | null;
  purpose: string;
  numberOfVisitors?: number;
  expiresAt?: string;
  createdAt?: string;
}

interface GuestPass {
  _id: string;
  guestName: string;
  guestPhone: string;
  purpose: string;
  passType: string;
  status: string;
  arrivalDate?: string;
  expiryDate?: string | null;
  qrCode?: string | null;
  numberOfGuests?: number;
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

const minsLeft = (iso?: string) => {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return mins > 0 ? `${mins} min left` : "Expired";
};

export default function VisitorsScreen() {

  const { user } = useAuth();
  const qc = useQueryClient();
  const guard = isGuard(user);

  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showForm, setShowForm] = useState(false);

  const approvals = useQuery({
    queryKey: ["approvals", guard ? "guard" : "resident"],
    queryFn: () =>
      api.get<Approval[]>(guard ? "/visitor-approvals/pending" : "/visitor-approvals/resident/pending"),
    // Somebody is waiting at a gate — a stale list is worse than a
    // few extra requests.
    refetchInterval: 20_000,
  });

  const passes = useQuery({
    queryKey: ["guest-passes", user?.id],
    enabled: !guard && Boolean(user?.id),
    queryFn: () => api.get<GuestPass[]>(`/guest-passes/resident/${user!.id}`),
  });

  const settle = useMutation({
    // The route names the approval and the body repeats it — the
    // backend validates the body, so both have to agree.
    mutationFn: ({ id, action, rejectionReason }: {
      id: string; action: "approve" | "reject" | "cancel"; rejectionReason?: string;
    }) =>
      api.patch(`/visitor-approvals/${id}/${action}`, {
        approvalId: id,
        ...(rejectionReason ? { rejectionReason } : {}),
      }),
    onSuccess: () => {
      setRejecting(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={approvals.isFetching}
            onRefresh={() => { approvals.refetch(); passes.refetch(); }}
          />
        }
      >

        <Text style={s.title}>{guard ? "Requests" : "Visitors"}</Text>

        <ErrorNote error={approvals.error ?? settle.error} />

        <View style={s.section}>
          <Text style={s.sectionLabel}>
            {guard ? "Waiting on a resident" : "At the gate now"}
          </Text>

          {approvals.isLoading ? <Loading /> : approvals.data?.length ? (
            approvals.data.map((a) => (
              <Card key={a._id}>

                <View style={s.head}>
                  {a.visitorPhoto ? (
                    <Image source={{ uri: a.visitorPhoto }} style={s.photo} />
                  ) : (
                    <View style={[s.photo, s.photoBlank]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{a.visitorName}</Text>
                    <Text style={s.meta}>{a.visitorPhone}</Text>
                  </View>
                  {a.expiresAt && <Pill tone="warn">{minsLeft(a.expiresAt)}</Pill>}
                </View>

                <View style={s.tags}>
                  <Pill tone="muted">{a.purpose}</Pill>
                  {Boolean(a.numberOfVisitors && a.numberOfVisitors > 1) && (
                    <Pill tone="muted">{a.numberOfVisitors} people</Pill>
                  )}
                  {a.vehicleNumber ? <Pill tone="muted">{a.vehicleNumber}</Pill> : null}
                </View>

                {guard ? (
                  <Button
                    title="Cancel request"
                    variant="ghost"
                    loading={settle.isPending}
                    onPress={() => settle.mutate({ id: a._id, action: "cancel" })}
                  />
                ) : rejecting === a._id ? (
                  <View style={s.section}>
                    <Field
                      label="Why are you turning them away?"
                      value={reason}
                      onChangeText={setReason}
                      placeholder="e.g. Not expecting anyone"
                      multiline
                    />
                    <View style={s.actions}>
                      <Button title="Back" variant="ghost" style={{ flex: 1 }}
                        onPress={() => { setRejecting(null); setReason(""); }} />
                      <Button
                        title="Confirm"
                        variant="danger"
                        style={{ flex: 1 }}
                        loading={settle.isPending}
                        disabled={reason.trim().length < 3}
                        onPress={() => settle.mutate({
                          id: a._id, action: "reject", rejectionReason: reason.trim(),
                        })}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={s.actions}>
                    <Button title="Deny" variant="ghost" style={{ flex: 1 }}
                      onPress={() => setRejecting(a._id)} />
                    <Button
                      title="Let them in"
                      style={{ flex: 1 }}
                      loading={settle.isPending}
                      onPress={() => settle.mutate({ id: a._id, action: "approve" })}
                    />
                  </View>
                )}

              </Card>
            ))
          ) : (
            <Empty>{guard ? "No requests waiting." : "Nobody is waiting at the gate."}</Empty>
          )}
        </View>

        {!guard && (
          <View style={s.section}>

            <View style={s.rowBetween}>
              <Text style={s.sectionLabel}>Your guest passes</Text>
              <Text style={s.link} onPress={() => setShowForm((v) => !v)}>
                {showForm ? "Close" : "New pass"}
              </Text>
            </View>

            {showForm && <NewPassForm onDone={() => { setShowForm(false); passes.refetch(); }} />}

            <ErrorNote error={passes.error} />

            {passes.isLoading ? <Loading /> : passes.data?.length ? (
              passes.data.map((p) => <PassCard key={p._id} pass={p} />)
            ) : (
              <Empty>No passes yet. Create one before your guest arrives.</Empty>
            )}

          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );

}

function PassCard({ pass }: { pass: GuestPass }) {

  const [open, setOpen] = useState(false);

  const tone =
    pass.status === "active" ? "ok"
      : pass.status === "cancelled" ? "danger"
        : "muted";

  return (
    <Card>
      <View style={s.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{pass.guestName}</Text>
          <Text style={s.meta}>
            {day(pass.arrivalDate)}
            {pass.expiryDate ? ` – ${day(pass.expiryDate)}` : ""}
            {"  •  "}{pass.purpose}
          </Text>
        </View>
        <Pill tone={tone as "ok" | "danger" | "muted"}>{pass.status}</Pill>
      </View>

      {pass.qrCode && pass.status === "active" && (
        <>
          <Text style={s.link} onPress={() => setOpen((v) => !v)}>
            {open ? "Hide code" : "Show code for the guard"}
          </Text>
          {open && (
            <View style={s.qrWrap}>
              <Image source={{ uri: pass.qrCode }} style={s.qr} resizeMode="contain" />
              <Text style={s.meta}>Show this at the gate</Text>
            </View>
          )}
        </>
      )}
    </Card>
  );

}

// =======================================================
// NEW GUEST PASS
//
// arrivalDate and passType are required by the backend. Defaulting to
// "today, one visit" covers the case that actually happens — someone
// is coming over this evening.
// =======================================================

const PURPOSES = ["family", "friend", "delivery", "maintenance", "business", "other"] as const;

function NewPassForm({ onDone }: { onDone: () => void }) {

  const [guestName, setName] = useState("");
  const [guestPhone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<string>("friend");
  const [vehicleNumber, setVehicle] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post("/guest-passes", {
        guestName: guestName.trim(),
        guestPhone,
        purpose,
        vehicleNumber: vehicleNumber.trim() || null,
        numberOfGuests: 1,
        arrivalDate: new Date().toISOString(),
        passType: "one_time",
      }, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => {
      Alert.alert("Pass created", "Share the code with your guest.");
      onDone();
    },
  });

  // The backend accepts letters and spaces only, so blocking the rest
  // here avoids a round trip to be told so.
  const letters = (v: string) => v.replace(/[^A-Za-z ]/g, "");

  return (
    <Card style={{ gap: space.md }}>

      <ErrorNote error={create.error} />

      <Field label="Guest name" value={guestName} placeholder="e.g. Anita Rao"
        onChangeText={(v) => setName(letters(v))} />

      <Field label="Mobile number" value={guestPhone} keyboardType="number-pad" maxLength={10}
        placeholder="10 digits"
        onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ""))} />

      <View style={{ gap: space.xs }}>
        <Text style={s.sectionLabel}>Purpose</Text>
        <View style={s.tags}>
          {PURPOSES.map((p) => (
            <Text
              key={p}
              onPress={() => setPurpose(p)}
              style={[s.choice, purpose === p && s.choiceOn]}
            >
              {p}
            </Text>
          ))}
        </View>
      </View>

      <Field label="Vehicle number (optional)" value={vehicleNumber}
        autoCapitalize="characters" placeholder="MH15 AB 1234"
        onChangeText={setVehicle} />

      <Button
        title="Create pass"
        loading={create.isPending}
        disabled={guestName.trim().length < 2 || guestPhone.length !== 10}
        onPress={() => create.mutate()}
      />

    </Card>
  );

}

const s = StyleSheet.create({

  safe: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },

  title: { ...type.display, color: colors.ink },
  section: { gap: space.sm },
  sectionLabel: { ...type.label, color: colors.muted },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { ...type.bodyStrong, color: colors.accent },

  head: { flexDirection: "row", gap: space.md, alignItems: "center" },
  photo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sunk },
  photoBlank: { borderWidth: 1, borderColor: colors.line },
  name: { ...type.heading, color: colors.ink },
  meta: { ...type.small, color: colors.muted, marginTop: 2 },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.md },

  choice: {
    ...type.small,
    fontWeight: "600",
    color: colors.inkSoft,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent, color: colors.white },

  qrWrap: { alignItems: "center", gap: space.sm, marginTop: space.md },
  qr: { width: 200, height: 200, backgroundColor: colors.white, borderRadius: radius.md },

});
