import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { ApiError } from "../src/lib/api";
import { colors } from "../src/theme";
import { Screen, Loading } from "../src/components/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A phone loses signal constantly, so transient failures are
      // worth retrying — but a 401 or 403 never is.
      retry: (count, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return count < 3;
      },
    },
  },
});

/** Sends people to the right half of the app once the session is known. */
function Gate() {

  const { user, restoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {

    if (restoring) return;

    const inApp = segments[0] === "(app)";

    if (!user && inApp) {
      router.replace("/join");
    } else if (user && !inApp) {
      router.replace("/(app)");
    }

  }, [user, restoring, segments, router]);

  if (restoring) {
    return (
      <Screen style={{ justifyContent: "center" }}>
        <Loading />
      </Screen>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ground },
      }}
    />
  );

}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
