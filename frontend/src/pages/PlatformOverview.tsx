import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Stat, Empty, formatDate } from "../components/ui";

interface SalesDashboard {
  totalSocieties: number;
  totalVerifiedMembers: number;
  recentSocieties: Array<{
    _id: string;
    name: string;
    city?: string;
    societyCode?: string;
    createdAt?: string;
  }>;
}

export function PlatformOverview() {

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => api.get<SalesDashboard>("/sales/dashboard"),
  });

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Societies you have onboarded and the residents verified in them."
        actions={
          <Link className="btn btn-primary" to="/onboarding">Onboard a society</Link>
        }
      />

      <ErrorBanner error={error} />

      {isLoading ? (
        <Loading />
      ) : (
        <div className="stack" style={{ gap: "1.5rem" }}>

          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
            }}
          >
            <Stat label="Societies" value={data?.totalSocieties ?? 0} />
            <Stat label="Verified residents" value={data?.totalVerifiedMembers ?? 0} tone="ok" />
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Recently onboarded</h2>
              <Link to="/societies" style={{ fontSize: ".9rem" }}>View all</Link>
            </div>

            {data?.recentSocieties?.length ? (
              <div className="tablewrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Society</th>
                      <th>City</th>
                      <th>Join code</th>
                      <th>Onboarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSocieties.map((s) => (
                      <tr key={s._id}>
                        <td style={{ fontWeight: 600 }}>
                          <Link to={`/societies/${s._id}`}>{s.name}</Link>
                        </td>
                        <td>{s.city ?? "—"}</td>
                        <td className="mono tnum">{s.societyCode ?? "—"}</td>
                        <td>{formatDate(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>
                No societies yet. Onboarding one issues a six-digit join code
                its residents use to register.
              </Empty>
            )}
          </section>

        </div>
      )}
    </>
  );

}
