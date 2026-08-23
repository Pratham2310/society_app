import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth, isPlatform, isCommittee } from "./lib/auth";
import { ApiError } from "./lib/api";
import { Layout } from "./components/Layout";

import { Login } from "./pages/Login";
import { PlatformOverview } from "./pages/PlatformOverview";
import { Societies, SocietyDetail } from "./pages/Societies";
import { Onboarding } from "./pages/Onboarding";
import { Salespeople } from "./pages/Salespeople";
import { SocietyOverview } from "./pages/SocietyOverview";
import { Residents } from "./pages/Residents";
import { Notices } from "./pages/Notices";
import { Complaints } from "./pages/Complaints";

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

/** Platform roles land on the platform overview, committee on theirs. */
function Home() {
  const { user } = useAuth();
  if (isPlatform(user)) return <PlatformOverview />;
  if (isCommittee(user)) return <Navigate to="/society" replace />;
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
              <Route path="salespeople" element={<Salespeople />} />

              {/* Society */}
              <Route path="society" element={<SocietyOverview />} />
              <Route path="residents" element={<Residents />} />
              <Route path="notices" element={<Notices />} />
              <Route path="complaints" element={<Complaints />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
