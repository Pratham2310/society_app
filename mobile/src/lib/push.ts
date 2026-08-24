import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { api } from "./api";

// =======================================================
// PUSH REGISTRATION
//
// The backend keeps a device list per user and prunes tokens that
// Expo reports as DeviceNotRegistered, so the only job here is to
// hand it a current token after sign-in and take it back on sign-out.
//
// Nothing here throws outward. A resident who declined notifications
// still has a working app, and a failed registration must not block
// them from reaching their home screen.
// =======================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54 split the old shouldShowAlert into two: a heads-up banner
    // while the app is open, and an entry in the notification centre.
    // A gate approval is worth both.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const ANDROID_CHANNEL = "default";

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: "Society alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Why push is not available, when it is not. The profile screen shows
 * this, so a resident is not told to check settings they never
 * touched.
 */
export type PushBlocker = "simulator" | "expo-go" | "denied" | "failed";

export interface PushResult {
  token: string | null;
  blocked?: PushBlocker;
}

// Expo Go dropped remote push in SDK 53. It still runs the app fine,
// but a token can only come from a development or production build.
const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";

export async function registerForPush(): Promise<PushResult> {

  try {

    // A simulator cannot receive a push, and asking for permission
    // there just produces a confusing failure.
    if (!Device.isDevice) return { token: null, blocked: "simulator" };

    if (IN_EXPO_GO) return { token: null, blocked: "expo-go" };

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }

    if (status !== "granted") return { token: null, blocked: "denied" };

    // On a development or production build the project id is required;
    // without it getExpoPushTokenAsync throws rather than returning null.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await api.post("/notifications/devices", {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      deviceId: Device.modelId ?? undefined,
    });

    return { token };

  } catch {
    return { token: null, blocked: "failed" };
  }

}

/** What to tell the resident when there is no token. */
export const PUSH_BLOCKER_TEXT: Record<PushBlocker, string> = {
  simulator: "A simulator cannot receive alerts. Use a real phone.",
  "expo-go": "Expo Go cannot receive alerts. A development build can.",
  denied: "Turned off in your phone settings.",
  failed: "Could not reach the notification service.",
};

export async function unregisterPush(token: string | null) {
  if (!token) return;
  try {
    await api.del(`/notifications/devices`, { token });
  } catch {
    // Signing out matters more than tidying the token list; the
    // backend prunes dead tokens on its own.
  }
}
