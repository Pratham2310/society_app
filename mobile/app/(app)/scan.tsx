import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { api, ApiError, newIdempotencyKey } from "../../src/lib/api";
import { colors, radius, space, type } from "../../src/theme";
import { Button, Card } from "../../src/components/ui";

// =======================================================
// GATE SCANNER
//
// The guard points the camera at a pass and the app records an entry
// or an exit. Two things matter more than looks here:
//
//   - The camera fires the same barcode many times a second. Without
//     a lock the guard would log one visitor twenty times.
//   - Gate posts carry an idempotency key, so a retry over a bad
//     connection cannot double-log. One key per scan, regenerated
//     only when the guard starts a new one.
// =======================================================

type Direction = "entry" | "exit";

interface Scanned {
  guestPassId?: string;
  societyId?: string;
  qrToken?: string;
}

interface Result {
  ok: boolean;
  title: string;
  detail: string;
}

export default function ScanScreen() {

  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [direction, setDirection] = useState<Direction>("entry");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // A ref, not state: the camera callback fires again before a state
  // update has rendered, which is exactly the double-scan being
  // guarded against.
  const locked = useRef(false);

  const onScanned = useCallback(async ({ data }: { data: string }) => {

    if (locked.current) return;
    locked.current = true;

    setBusy(true);

    try {

      let payload: Scanned;

      try {
        payload = JSON.parse(data) as Scanned;
      } catch {
        throw new ApiError("That is not a society pass.", 400);
      }

      if (!payload.guestPassId) {
        throw new ApiError("That pass is missing its code.", 400);
      }

      const log = await api.post<{ visitorName?: string; guestName?: string }>(
        `/gate-log/scan-${direction}`,
        { guestPassId: payload.guestPassId },
        { idempotencyKey: newIdempotencyKey() }
      );

      setResult({
        ok: true,
        title: direction === "entry" ? "Entry recorded" : "Exit recorded",
        detail: log?.visitorName ?? log?.guestName ?? "Let them through.",
      });

    } catch (err) {

      setResult({
        ok: false,
        title: "Not allowed",
        detail: err instanceof Error ? err.message : "Could not read that pass.",
      });

    } finally {
      setBusy(false);
    }

  }, [direction]);

  const scanAgain = () => {
    setResult(null);
    locked.current = false;
  };

  if (!permission) {
    return <Shell><Text style={s.body}>Checking the camera…</Text></Shell>;
  }

  if (!permission.granted) {
    return (
      <Shell>
        <Text style={s.title}>Camera needed</Text>
        <Text style={s.body}>
          The scanner reads a guest pass from the visitor's phone. Nothing is
          recorded or stored from the camera itself.
        </Text>
        <Button title="Allow camera" onPress={requestPermission} />
        <Button title="Go back" variant="ghost" onPress={() => router.back()} />
      </Shell>
    );
  }

  return (
    <View style={s.full}>

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={result || busy ? undefined : onScanned}
      />

      <SafeAreaView style={s.overlay}>

        <View style={s.top}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={s.close}>Close</Text>
          </Pressable>

          <View style={s.toggle}>
            {(["entry", "exit"] as const).map((d) => (
              <Pressable
                key={d}
                onPress={() => { setDirection(d); scanAgain(); }}
                style={[s.toggleItem, direction === d && s.toggleItemOn]}
              >
                <Text style={[s.toggleText, direction === d && s.toggleTextOn]}>
                  {d === "entry" ? "Entry" : "Exit"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.frameWrap}>
          <View style={s.frame} />
          <Text style={s.hint}>
            {busy ? "Checking…" : `Point at the pass to record an ${direction}`}
          </Text>
        </View>

        <View style={s.bottom}>
          {result && (
            <Card style={result.ok ? s.ok : s.bad}>
              <Text style={s.resultTitle}>{result.title}</Text>
              <Text style={s.body}>{result.detail}</Text>
              <Button title="Scan the next one" onPress={scanAgain} />
            </Card>
          )}
        </View>

      </SafeAreaView>

    </View>
  );

}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.shell}>{children}</View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({

  full: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1, backgroundColor: colors.ground },
  shell: { flex: 1, justifyContent: "center", padding: space.xl, gap: space.md },

  overlay: { flex: 1, justifyContent: "space-between" },

  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.lg,
  },
  close: { ...type.bodyStrong, color: colors.white },

  toggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleItem: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  toggleItemOn: { backgroundColor: colors.white },
  toggleText: { ...type.small, fontWeight: "700", color: colors.white },
  toggleTextOn: { color: colors.ink },

  frameWrap: { alignItems: "center", gap: space.lg },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.white,
    opacity: 0.9,
  },
  hint: {
    ...type.body,
    color: colors.white,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
  },

  bottom: { padding: space.lg, gap: space.md, minHeight: 40 },
  ok: { borderLeftWidth: 4, borderLeftColor: colors.ok, gap: space.sm },
  bad: { borderLeftWidth: 4, borderLeftColor: colors.danger, gap: space.sm },
  resultTitle: { ...type.heading, color: colors.ink },

  title: { ...type.display, color: colors.ink },
  body: { ...type.body, color: colors.inkSoft },

});
