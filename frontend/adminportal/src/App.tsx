import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth, isPlatform } from "./lib/auth";
import { ApiError } from "./lib/api";
import { Layout } from "./components/Layout";

import { Login } from "./pages/Login";
import { PlatformOverview } from "./pages/PlatformOverview";
import { Societies, SocietyDetail } from "./pages/Societies";
import { Onboarding } from "./pages/Onboarding";
import { Drafts } from "./pages/Drafts";
import { Services } from "./pages/Services";
import { Salespeople } from "./pages/Salespeople";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 401, 403 or 404 just delays the message. Only
      // transient failures are worth a second attempt.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Only platform roles get in. A committee member signing in here is
 * sent back to the login screen, which tells them to use the app —
 * approving a resident, publishing a notice and answering a complaint
 * all happen there now.
 */
function Home() {
  const { user } = useAuth();
  if (isPlatform(user)) return <PlatformOverview />;
  return <Navigate to="/login" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            <Route path="/login" element={<Login />} />

            <Route element={<Layout />}>
              <Route index element={<Home />} />

              {/* Platform */}
              <Route path="societies" element={<Societies />} />
              <Route path="societies/:societyId" element={<SocietyDetail />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="drafts" element={<Drafts />} />
              <Route path="services" element={<Services />} />
              <Route path="salespeople" element={<Salespeople />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
