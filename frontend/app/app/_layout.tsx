import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { RegistrationProvider } from '../context/RegistrationContext';
import { registerForPush, routeForNotification } from '../lib/push';

// On the web build every focused input gets the browser's default focus ring,
// which shows up as a hard black square around our rounded fields. Drop it once
// for the whole app (fields still show their own focus styling).
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('cn-reset')) {
  const style = document.createElement('style');
  style.id = 'cn-reset';
  style.textContent = `
    input, textarea, select, [contenteditable] { outline: none !important; }
    input:focus, textarea:focus, select:focus { outline: none !important; box-shadow: none !important; }
  `;
  document.head.appendChild(style);
}

// PWA head tags for the web build. These would normally live in app/+html.tsx,
// but that file only applies to static rendering and app.json uses
// web.output: "single" — so we add them to the live document instead.
// Without the manifest the browser won't offer "Install", and iOS Safari
// refuses web push outright (it only grants it to a home-screen install).
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('cn-pwa')) {
  const marker = document.createElement('meta');
  marker.id = 'cn-pwa';
  marker.name = 'cn-pwa';
  marker.content = '1';
  document.head.appendChild(marker);

  const tags: Record<string, string>[] = [
    { tag: 'link', rel: 'manifest', href: '/manifest.json' },
    { tag: 'link', rel: 'apple-touch-icon', href: '/icon-192.png' },
    { tag: 'meta', name: 'theme-color', content: '#A72608' },
    { tag: 'meta', name: 'apple-mobile-web-app-capable', content: 'yes' },
    { tag: 'meta', name: 'apple-mobile-web-app-title', content: 'Grihive' },
  ];

  for (const { tag, ...attrs } of tags) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
}

/** Registers this device for push once logged in, and routes notification taps. */
function PushGate() {
  const { token } = useAuth();
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  // Register (once per token) after login.
  useEffect(() => {
    if (!token || registeredFor.current === token) return;
    registeredFor.current = token;
    registerForPush(token);
  }, [token]);

  // Tapping a notification opens the relevant screen. On web the service
  // worker's notificationclick handler does this instead (public/sw.js).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForNotification(response?.notification?.request?.content?.data);
      if (route) router.push(route as any);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

function AuthGate() {
  const { token, user, loading } = useAuth();
  const router  = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const firstSegment = (segments[0] as string | undefined) ?? 'index';
    const authOnlyRoutes = ['login', 'identity', 'society-key', 'welcome', 'onboarding', 'vehicle', 'finalize', 'app-tour', 'index', 'forgot-password'];
    const inAuthFlow = authOnlyRoutes.includes(firstSegment);
    const onPending = firstSegment === 'pending';

    // Security guards get their own gate dashboard, not the resident tabs.
    const isGuard = user?.societyRole === 'security';

    if (token && user?.status === 'pending' && !onPending) {
      router.replace('/pending');
    } else if (token && user?.status === 'approved' && inAuthFlow) {
      router.replace(isGuard ? '/guard' : '/(tabs)/dashboard');
    } else if (!token && !inAuthFlow) {
      router.replace('/index' as any);
    }
  }, [token, user, loading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RegistrationProvider>
          <AuthGate />
          <PushGate />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="society-key" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="identity" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="vehicle" />
            <Stack.Screen name="finalize" />
            <Stack.Screen name="login" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="app-tour" />
            <Stack.Screen name="pending" />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="member-profile" />
            <Stack.Screen name="event-create" />
            <Stack.Screen name="event-details" />
            <Stack.Screen name="social-event-details" />
            <Stack.Screen name="notices" />
            <Stack.Screen name="services" />
            <Stack.Screen name="complaints" />
            <Stack.Screen name="helpline" />
            <Stack.Screen name="parking" />
            <Stack.Screen name="maintenance" />
            <Stack.Screen name="maintenance-hub" />
            <Stack.Screen name="security" />
            <Stack.Screen name="guard" />
            <Stack.Screen name="amenities" />
            <Stack.Screen name="community-funds" />
            <Stack.Screen name="fund-details" />
            <Stack.Screen name="contribute" />
            <Stack.Screen name="contributors-wall" />
            <Stack.Screen name="manage-roles" />
            <Stack.Screen name="elections" />
            <Stack.Screen name="election-create" />
            <Stack.Screen name="election-details" />
            <Stack.Screen name="nearby-services" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="my-vehicles" />
            <Stack.Screen name="notifications" />
          </Stack>
        </RegistrationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
