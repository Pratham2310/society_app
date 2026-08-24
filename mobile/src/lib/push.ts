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
    shouldShowAlert: true,
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

/** Returns the Expo token if one was obtained and registered. */
export async function registerForPush(): Promise<string | null> {

  try {

    // A simulator cannot receive a push, and asking for permission
    // there just produces a confusing failure.
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }

    if (status !== "granted") return null;

    // On a bare or EAS build the project id is required; without it
    // getExpoPushTokenAsync throws rather than returning null.
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

    return token;

  } catch {
    return null;
  }

}

export async function unregisterPush(token: string | null) {
  if (!token) return;
  try {
    await api.del(`/notifications/devices`, { token });
  } catch {
    // Signing out matters more than tidying the token list; the
    // backend prunes dead tokens on its own.
  }
}
