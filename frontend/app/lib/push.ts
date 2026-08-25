import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API } from '../constants/api';

/**
 * Push notifications (Expo).
 *
 * Registration happens after login: we ask permission, get the device's Expo
 * push token, and store it against the user so the backend can notify them.
 * Every in-app notification the server creates is pushed automatically.
 */

// Show an alert + sound even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Base64url → Uint8Array, the key format PushManager.subscribe() demands. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** True when an existing subscription was issued for this same VAPID key. */
function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current as ArrayBuffer);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

/** Running as an installed app (iOS Home Screen / desktop PWA) rather than a tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export type WebPushState =
  | 'unsupported'    // browser has no Push API at all
  | 'needs-install'  // iOS: only an installed Home Screen app may subscribe
  | 'denied'         // the user said no; only they can undo it, in site settings
  | 'ready'          // supported and permitted — safe to subscribe silently
  | 'prompt';        // supported, but permission must come from a real tap

/**
 * What the UI should offer this browser. Web push is far less uniform than
 * native, so the notifications screen renders from this rather than guessing.
 */
export function webPushState(): WebPushState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // iOS exposes the Push API only to an installed app, so a plain Safari tab
    // reports "unsupported" — tell the user to install rather than give up.
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (!window.isSecureContext) return 'unsupported';
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'ready';
  return 'prompt';
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  );
}

/**
 * Browser push (Web Push / VAPID) — used by the web build on Vercel.
 *
 * Expo's push service only reaches native iOS/Android, so browsers go through
 * a service worker and the standard PushManager instead.
 *
 * `interactive` matters: Safari (and iOS in particular) rejects
 * Notification.requestPermission() unless it is running inside a real user
 * gesture. Calling this from an effect on login therefore silently failed for
 * every Safari user — which is why no subscription was ever stored. The
 * automatic path now only re-subscribes browsers that ALREADY granted
 * permission; asking is done from a button via enableWebPush().
 */
async function registerWebPush(token: string, interactive = false): Promise<string | null> {
  const state = webPushState();
  if (state === 'unsupported' || state === 'denied' || state === 'needs-install') return null;
  if (state === 'prompt' && !interactive) return null;

  try {
    // Ask BEFORE any await. Safari only honours requestPermission() while the
    // user gesture is still active, and awaiting the service-worker
    // registration first is enough to lose it.
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return null;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Prefer the build-time key; fall back to asking the backend, so a Vercel
    // deploy that predates EXPO_PUBLIC_VAPID_PUBLIC_KEY still works.
    let vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      const res = await fetch(API.WEB_PUSH_KEY);
      vapidKey = (await res.json())?.key;
    }
    if (!vapidKey) {
      console.log('[push] no VAPID public key available — browser push disabled');
      return null;
    }

    const appServerKey = urlBase64ToUint8Array(vapidKey);

    // Reuse the existing subscription unless it was issued for a different
    // VAPID key. Resubscribing on every page load would mint a new endpoint
    // each time and leave the old ones orphaned on the user record.
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameKey(subscription, appServerKey)) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as BufferSource,
      });
    }

    await fetch(API.WEB_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    // Remembered so logout can unsubscribe this exact browser.
    await AsyncStorage.setItem('webPushEndpoint', subscription.endpoint);
    return subscription.endpoint;
  } catch (err: any) {
    console.log('[push] web registration skipped:', err?.message);
    return null;
  }
}

/**
 * Turn on browser notifications. MUST be called straight from a tap handler —
 * see the gesture note on registerWebPush. Returns the endpoint, or null if
 * the user declined or the browser can't do it.
 */
export async function enableWebPush(token: string): Promise<string | null> {
  return registerWebPush(token, true);
}

/** Ask permission, fetch the Expo token, and save it on the user. */
export async function registerForPush(token: string): Promise<string | null> {
  // The browser build takes the Web Push path — Expo's service can't reach it.
  // Non-interactive: this runs from an effect, so it only re-subscribes a
  // browser that has already granted permission. The ask lives on a button.
  if (Platform.OS === 'web') return registerWebPush(token, false);

  // Native push only works on physical devices (not simulators).
  if (!Device.isDevice) return null;

  try {
    // Android needs a channel or notifications arrive silently.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Grihive',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#A72608',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const { data: expoToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!expoToken) return null;

    await fetch(API.PUSH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: expoToken }),
    });

    // Remembered so logout can unregister this exact device.
    await AsyncStorage.setItem('expoPushToken', expoToken);
    return expoToken;
  } catch (err: any) {
    console.log('[push] registration skipped:', err?.message);
    return null;
  }
}

/** Stop pushing to this device (called on logout). */
export async function unregisterPush(token: string, expoToken: string | null) {
  if (Platform.OS === 'web') return unregisterWebPush(token);
  if (!expoToken) return;
  try {
    await fetch(API.PUSH_TOKEN, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: expoToken }),
    });
  } catch { /* best effort */ }
}

/** Stop pushing to this browser (called on logout). */
async function unregisterWebPush(token: string) {
  try {
    const endpoint = await AsyncStorage.getItem('webPushEndpoint');
    if (!endpoint) return;

    await fetch(API.WEB_PUSH, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    });

    // Also drop the browser-side subscription so the next login re-subscribes
    // cleanly rather than reusing keys the server no longer knows about.
    const registration = await navigator.serviceWorker?.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    await sub?.unsubscribe();
    await AsyncStorage.removeItem('webPushEndpoint');
  } catch { /* best effort */ }
}

/** Map a notification's `link.screen` to an app route. */
export function routeForNotification(data: any): string | null {
  const screen = data?.link?.screen || data?.screen;
  if (!screen) return null;

  // Tapping an election push opens that election's ballot directly.
  if (screen === 'elections') {
    const id = data?.link?.id;
    return id ? `/election-details?id=${id}` : '/elections';
  }

  const map: Record<string, string> = {
    notices: '/notices',
    complaints: '/complaints',
    maintenance: '/maintenance',
    events: '/(tabs)/events',
    members: '/(tabs)/members',
    profile: '/(tabs)/profile',
    security: '/security',
    amenities: '/amenities',
    parking: '/parking',
    finance: '/(tabs)/finance',
  };
  return map[String(screen)] || null;
}
