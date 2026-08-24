import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../src/lib/api";
import { colors, radius, space, type } from "../../src/theme";
import { Button, ErrorNote, Field, Label, Loading } from "../../src/components/ui";

// =======================================================
// REGISTRATION — FOUR STEPS
//
// Nothing is sent until the last one. register-full takes the whole
// payload at once and needs the phone to already be OTP-verified, so
// step 1 sends and verifies the OTP inline.
//
// Step 2 is wing → floor → flat. The structure endpoint is public
// precisely because the resident has no account yet, and it returns
// occupancy so a taken flat can be shown as taken rather than failing
// at submit.
// =======================================================

interface Structure {
  society: { _id: string; name: string; city: string | null };
  wings: Array<{
    _id: string;
    name: string;
    floors: Array<{
      floor: number;
      availableCount: number;
      flats: Array<{ _id: string; flatNumber: string; isOccupied: boolean }>;
    }>;
  }>;
}

interface Vehicle { type: "car" | "bike"; number: string; parkingSlot: string }

const STEPS = ["Identity", "Home", "Vehicles", "Confirm"];

export default function RegisterScreen() {

  const router = useRouter();
  const { societyId, societyName } = useLocalSearchParams<{
    societyId: string; societyName: string;
  }>();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // step 1
  const [identity, setIdentity] = useState({ name: "", email: "", password: "", phone: "" });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // step 2
  const [wingId, setWingId] = useState("");
  const [floor, setFloor] = useState<number | null>(null);
  const [flatNumber, setFlatNumber] = useState("");
  const [occupancyType, setOccupancy] = useState<"owner" | "tenant">("owner");
  const [livingType, setLiving] = useState<"family" | "bachelor">("family");
  const [familySize, setFamilySize] = useState(1);

  // step 3
  const [noVehicle, setNoVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { type: "car", number: "", parkingSlot: "" },
  ]);

  // step 4
  const [agreedToTerms, setAgreed] = useState(false);
  const [consentAlerts, setConsent] = useState(true);

  const structure = useQuery({
    queryKey: ["structure", societyId],
    enabled: step === 1 && Boolean(societyId),
    queryFn: () => api.get<Structure>(`/societies/${societyId}/structure`),
  });

  const wings = structure.data?.wings ?? [];
  const wing = wings.find((w) => w._id === wingId);
  const floors = wing?.floors ?? [];
  const flatsOnFloor = floors.find((f) => f.floor === floor)?.flats ?? [];

  const digits = (v: string) => v.replace(/[^0-9]/g, "");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const sendOtp = () => run(async () => {
    const result = await api.post<{ devOtp?: string }>(
      "/auth/send-otp", { phone: identity.phone }, { anonymous: true }
    );
    setOtpSent(true);
    // Outside production the backend returns the code so the flow can
    // be walked without an SMS provider.
    setDevOtp(result?.devOtp ?? null);
  });

  const verifyOtp = () => run(async () => {
    await api.post("/auth/verify-otp", { phone: identity.phone, otp }, { anonymous: true });
    setOtpVerified(true);
  });

  const submit = () => run(async () => {
    await api.post("/users/register-full", {
      name: identity.name,
      email: identity.email,
      password: identity.password,
      phone: identity.phone,
      societyId,
      wingId,
      flatNumber,
      occupancyType,
      livingType,
      familySize,
      vehicles: noVehicle ? [] : vehicles.filter((v) => v.number.trim()),
      agreedToTerms,
      consentAlerts,
    }, { anonymous: true });
    router.replace("/join/submitted");
  });

  const canContinue = useMemo(() => {
    if (step === 0) {
      return Boolean(
        identity.name.trim() &&
        /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(identity.email) &&
        identity.password.length >= 6 &&
        otpVerified
      );
    }
    if (step === 1) return Boolean(wingId && floor !== null && flatNumber);
    if (step === 2) return noVehicle || vehicles.some((v) => v.number.trim());
    return agreedToTerms;
  }, [step, identity, otpVerified, wingId, floor, flatNumber, noVehicle, vehicles, agreedToTerms]);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        <View style={s.head}>
          <Text style={s.step}>Step {step + 1} of 4</Text>
          <View style={s.dots}>
            {STEPS.map((label, i) => (
              <View key={label} style={[s.dot, i === step && s.dotActive, i < step && s.dotDone]} />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          <ErrorNote error={error} />

          {step === 0 && (
            <>
              <Text style={s.title}>Personal identity</Text>
              <Text style={s.sub}>Tell us who you are</Text>

              <Field label="Full name" value={identity.name} placeholder="e.g. John Doe"
                onChangeText={(v) => setIdentity({ ...identity, name: v })} />

              <Field label="Email address" value={identity.email} placeholder="name@email.com"
                autoCapitalize="none" keyboardType="email-address"
                hint="Must be a real domain — .local and .test are rejected."
                onChangeText={(v) => setIdentity({ ...identity, email: v })} />

              <Field label="Password" value={identity.password} secureTextEntry
                placeholder="Create a password"
                onChangeText={(v) => setIdentity({ ...identity, password: v })} />

              <Field label="Mobile number" value={identity.phone} keyboardType="number-pad"
                maxLength={10} placeholder="98765 43210" editable={!otpVerified}
                onChangeText={(v) => setIdentity({ ...identity, phone: digits(v) })} />

              {!otpVerified && (
                <Button
                  title={otpSent ? "Resend OTP" : "Send OTP"}
                  variant="ghost"
                  loading={busy}
                  disabled={identity.phone.length !== 10}
                  onPress={sendOtp}
                />
              )}

              {devOtp && (
                <Text style={s.devNote}>Development build — your code is {devOtp}</Text>
              )}

              {otpSent && !otpVerified && (
                <>
                  <Field label="Enter OTP" value={otp} keyboardType="number-pad" maxLength={6}
                    onChangeText={(v) => setOtp(digits(v))} />
                  <Button title="Verify" loading={busy} disabled={otp.length !== 6} onPress={verifyOtp} />
                </>
              )}

              {otpVerified && <Text style={s.verified}>Number verified</Text>}
            </>
          )}

          {step === 1 && (
            <>
              <Text style={s.title}>Where do you live?</Text>
              <Text style={s.sub}>
                Please provide your building and flat details to connect with {societyName}.
              </Text>

              {structure.isLoading ? <Loading label="Loading the building" /> : (
                <>
                  <Label>Select wing</Label>
                  <View style={s.chips}>
                    {wings.map((w) => (
                      <Chip key={w._id} label={w.name} selected={wingId === w._id}
                        onPress={() => { setWingId(w._id); setFloor(null); setFlatNumber(""); }} />
                    ))}
                  </View>

                  {wing && (
                    <>
                      <Label>Floor</Label>
                      <View style={s.chips}>
                        {floors.map((f) => (
                          <Chip
                            key={f.floor}
                            label={`${f.floor}`}
                            selected={floor === f.floor}
                            // A floor with nothing left is worth greying
                            // out whole rather than making someone open it.
                            disabled={f.availableCount === 0}
                            onPress={() => { setFloor(f.floor); setFlatNumber(""); }}
                          />
                        ))}
                      </View>
                    </>
                  )}

                  {floor !== null && (
                    <>
                      <Label>Flat number</Label>
                      <View style={s.chips}>
                        {flatsOnFloor.map((f) => (
                          <Chip
                            key={f._id}
                            label={f.flatNumber}
                            selected={flatNumber === f.flatNumber}
                            disabled={f.isOccupied}
                            onPress={() => setFlatNumber(f.flatNumber)}
                          />
                        ))}
                      </View>
                      <Text style={s.hint}>Greyed-out flats are already taken.</Text>
                    </>
                  )}

                  <Label>I am a…</Label>
                  <View style={s.chips}>
                    <Chip label="Owner" selected={occupancyType === "owner"} onPress={() => setOccupancy("owner")} />
                    <Chip label="Tenant" selected={occupancyType === "tenant"} onPress={() => setOccupancy("tenant")} />
                  </View>

                  <Label>Living status</Label>
                  <View style={s.chips}>
                    <Chip label="Bachelor" selected={livingType === "bachelor"} onPress={() => setLiving("bachelor")} />
                    <Chip label="Family" selected={livingType === "family"} onPress={() => setLiving("family")} />
                  </View>

                  {livingType === "family" && (
                    <View style={s.counter}>
                      <Text style={s.counterLabel}>Family size</Text>
                      <View style={s.counterControls}>
                        <Pressable style={s.counterBtn} onPress={() => setFamilySize((n) => Math.max(1, n - 1))}>
                          <Text style={s.counterBtnText}>−</Text>
                        </Pressable>
                        <Text style={s.counterValue}>{String(familySize).padStart(2, "0")}</Text>
                        <Pressable style={[s.counterBtn, s.counterAdd]} onPress={() => setFamilySize((n) => n + 1)}>
                          <Text style={[s.counterBtnText, { color: colors.white }]}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.title}>Vehicle &amp; parking</Text>
              <Text style={s.sub}>Register your vehicles to ensure seamless entry into the society.</Text>

              <Pressable style={s.check} onPress={() => setNoVehicle((v) => !v)}>
                <View style={[s.checkbox, noVehicle && s.checkboxOn]} />
                <Text style={s.checkLabel}>I do not own a vehicle</Text>
              </Pressable>

              {!noVehicle && vehicles.map((v, i) => (
                <View key={i} style={s.vehicleCard}>
                  <View style={s.vehicleHead}>
                    <Text style={s.vehicleTitle}>Vehicle {i + 1}</Text>
                    {vehicles.length > 1 && (
                      <Pressable onPress={() => setVehicles(vehicles.filter((_, j) => j !== i))}>
                        <Text style={s.remove}>Remove</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={s.chips}>
                    <Chip label="Car" selected={v.type === "car"}
                      onPress={() => setVehicles(vehicles.map((x, j) => j === i ? { ...x, type: "car" } : x))} />
                    <Chip label="Bike" selected={v.type === "bike"}
                      onPress={() => setVehicles(vehicles.map((x, j) => j === i ? { ...x, type: "bike" } : x))} />
                  </View>

                  <Field label="Vehicle number" value={v.number} placeholder="e.g. MH15 AB 1234"
                    autoCapitalize="characters"
                    onChangeText={(t) => setVehicles(vehicles.map((x, j) => j === i ? { ...x, number: t } : x))} />

                  <Field label="Allocated parking slot" value={v.parkingSlot} placeholder="e.g. B-204"
                    onChangeText={(t) => setVehicles(vehicles.map((x, j) => j === i ? { ...x, parkingSlot: t } : x))} />
                </View>
              ))}

              {!noVehicle && (
                <Button title="Add another vehicle" variant="ghost"
                  onPress={() => setVehicles([...vehicles, { type: "car", number: "", parkingSlot: "" }])} />
              )}

              <Text style={s.hint}>
                This helps the guard recognise your entry and prevents unauthorised
                parking in your designated slot.
              </Text>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.title}>Finalise registration</Text>
              <Text style={s.sub}>
                Please review our terms and provide final consent to join your
                residential community.
              </Text>

              <Label>Legal agreements</Label>

              <View style={s.terms}>
                <Text style={s.termsTitle}>Privacy policy &amp; terms of use</Text>
                <Text style={s.termsBody}>
                  By completing your registration, you agree to comply with the
                  society's residential management guidelines and digital platform
                  usage policies. Your unit number, contact details and vehicle
                  registrations are shared with the committee and security staff so
                  they can verify entry.
                </Text>
              </View>

              <Pressable style={s.check} onPress={() => setAgreed((v) => !v)}>
                <View style={[s.checkbox, agreedToTerms && s.checkboxOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.checkLabel}>I agree to the society's code of conduct</Text>
                  <Text style={s.required}>Required for residential access</Text>
                </View>
              </Pressable>

              <Pressable style={s.check} onPress={() => setConsent((v) => !v)}>
                <View style={[s.checkbox, consentAlerts && s.checkboxOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.checkLabel}>I consent to receive emergency alerts</Text>
                  <Text style={s.required}>
                    Visitor approvals and security notices reach your phone this way
                  </Text>
                </View>
              </Pressable>
            </>
          )}

        </ScrollView>

        <View style={s.footer}>
          {step > 0 && (
            <Button title="Back" variant="ghost" style={{ flex: 1 }} onPress={() => setStep(step - 1)} />
          )}
          <Button
            title={step === 3 ? "Complete registration" : "Continue"}
            style={{ flex: 2 }}
            loading={busy}
            disabled={!canContinue}
            onPress={() => (step === 3 ? submit() : setStep(step + 1))}
          />
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );

}

function Chip({
  label, selected, disabled, onPress,
}: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      style={[s.chip, selected && s.chipOn, disabled && s.chipOff]}
    >
      <Text style={[s.chipText, selected && s.chipTextOn, disabled && s.chipTextOff]}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({

  safe: { flex: 1, backgroundColor: colors.surfaceAlt },

  head: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
  step: { ...type.label, color: colors.accent },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 22, height: 5, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.accent, width: 30 },
  dotDone: { backgroundColor: colors.accentTint },

  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },

  title: { ...type.display, color: colors.ink },
  sub: { ...type.body, color: colors.muted, marginTop: -space.sm },
  hint: { ...type.small, color: colors.muted },
  devNote: { ...type.small, color: colors.info },
  verified: { ...type.bodyStrong, color: colors.ok },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    minWidth: 58,
    alignItems: "center",
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipOff: { opacity: 0.4, backgroundColor: colors.sunk },
  chipText: { ...type.bodyStrong, color: colors.ink },
  chipTextOn: { color: colors.white },
  chipTextOff: { color: colors.muted },

  counter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.sunk,
    borderRadius: radius.md,
    padding: space.md,
  },
  counterLabel: { ...type.bodyStrong, color: colors.ink },
  counterControls: { flexDirection: "row", alignItems: "center", gap: space.md },
  counterBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineStrong,
  },
  counterAdd: { backgroundColor: colors.accent, borderColor: colors.accent },
  counterBtnText: { fontSize: 20, fontWeight: "700", color: colors.ink },
  counterValue: { ...type.heading, color: colors.ink, minWidth: 28, textAlign: "center" },

  check: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.white,
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { ...type.body, color: colors.ink, flexShrink: 1 },
  required: { ...type.small, color: colors.accent },

  vehicleCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  vehicleHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  vehicleTitle: { ...type.label, color: colors.accent },
  remove: { ...type.small, color: colors.danger },

  terms: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: space.sm,
  },
  termsTitle: { ...type.bodyStrong, color: colors.ink },
  termsBody: { ...type.small, color: colors.inkSoft, lineHeight: 19 },

  footer: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },

});
