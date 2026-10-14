import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { formatDate, percent } from "../format.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const HUMAN = "#059669";
const AI = "#d97706";

// Turn the server's "daily" list into labels + human/AI counts (works with several shapes).
function readDaily(daily) {
  const list = Array.isArray(daily) ? daily : [];
  return list.map((d) => {
    const label = String(d.date || d.day || "").slice(5);
    const human = Number(d.human ?? d.human_count ?? 0);
    const ai = Number(d.ai ?? d.ai_count ?? 0);
    const total = Number(d.count ?? d.total ?? human + ai);
    return { label, human, ai, total };
  });
}

// Turn the confidence buckets into labels + counts (array of objects, array of numbers, or an object).
function readBuckets(dist) {
  if (!dist) return [];
  if (Array.isArray(dist)) {
    return dist.map((b, i) =>
      typeof b === "number"
        ? { label: "Bucket " + (i + 1), count: b }
        : { label: String(b.range || b.label || b.bucket || "Bucket " + (i + 1)), count: Number(b.count ?? b.value ?? 0) }
    );
  }
  return Object.keys(dist).map((k) => ({ label: k, count: Number(dist[k]) }));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/stats").then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <p className="center muted">Loading...</p>;

  const total = Number(stats.total_analyses || 0);
  const humanCount = Number(stats.human_count || 0);
  const aiCount = Number(stats.ai_count || 0);
  const humanPct = Number(stats.human_percent || 0);
  const aiPct = Number(stats.ai_percent || 0);
  const daily = readDaily(stats.daily);
  const buckets = readBuckets(stats.confidence_distribution);
  const recent = Array.isArray(stats.recent) ? stats.recent : [];
  const system = stats.system || {};

  const pieData = {
    labels: ["Human", "AI"],
    datasets: [{ data: [humanCount, aiCount], backgroundColor: [HUMAN, AI], borderWidth: 0 }],
  };
  const pieOptions = { cutout: "60%", plugins: { legend: { position: "bottom" } } };

  const dailyData = {
    labels: daily.map((d) => d.label),
    datasets: [
      { label: "Human", data: daily.map((d) => d.human), backgroundColor: HUMAN },
      { label: "AI", data: daily.map((d) => d.ai), backgroundColor: AI },
    ],
  };
  const hasSplit = daily.some((d) => d.human > 0 || d.ai > 0);
  if (!hasSplit) {
    dailyData.datasets = [{ label: "Analyses", data: daily.map((d) => d.total), backgroundColor: "#4f46e5" }];
  }
  const dailyOptions = {
    plugins: { legend: { display: hasSplit, position: "bottom" } },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const bucketData = {
    labels: buckets.map((b) => b.label),
    datasets: [{ label: "Analyses", data: buckets.map((b) => b.count), backgroundColor: "#4f46e5" }],
  };
  const bucketOptions = {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <p className="muted" style={{ margin: 0 }}>Welcome back{user && user.full_name ? ", " + user.full_name : ""}.</p>
        </div>
        <Link to="/analyze" className="btn btn-primary">New analysis</Link>
      </div>

      <div className="grid grid-4">
        <div className="card stat"><div className="num">{total}</div><div className="label">Total analyses</div></div>
        <div className="card stat"><div className="num" style={{ color: HUMAN }}>{humanCount}</div><div className="label">Human ({humanPct}%)</div></div>
        <div className="card stat"><div className="num" style={{ color: AI }}>{aiCount}</div><div className="label">AI ({aiPct}%)</div></div>
        <div className="card stat"><div className="num">{stats.last_7_days ?? 0}</div><div className="label">Last 7 days</div></div>
      </div>

      {total === 0 ? (
        <div className="card center" style={{ marginTop: 16, padding: 40 }}>
          <h3>No data yet</h3>
          <p className="muted">Analyze your first text to see charts here.</p>
          <Link to="/analyze" className="btn btn-primary">Analyze a text</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Human vs AI</h3>
              <p className="muted">Most frequent result: <b>{stats.most_frequent_class || "-"}</b></p>
              <div style={{ maxWidth: 280, margin: "0 auto" }}><Doughnut data={pieData} options={pieOptions} /></div>
            </div>
            <div className="card">
              <h3>Analyses per day (last 14 days)</h3>
              <Bar data={dailyData} options={dailyOptions} />
            </div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Confidence of the predictions</h3>
              {buckets.length > 0 ? <Bar data={bucketData} options={bucketOptions} /> : <p className="muted">No data.</p>}
            </div>
            <div className="card">
              <h3>Recent analyses</h3>
              <table className="table">
                <tbody>
                  {recent.map((it) => (
                    <tr key={it.id}>
                      <td><span className={"badge " + (it.label === "AI" ? "ai" : "human")}>{it.label}</span></td>
                      <td>{percent(it.confidence)}</td>
                      <td className="muted">{formatDate(it.created_at)}</td>
                      <td><Link to={"/result/" + it.id}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link to="/history">See all history</Link>
            </div>
          </div>
        </>
      )}

      {(system.users !== undefined || system.analyses !== undefined) && (
        <p className="muted center" style={{ marginTop: 20, fontSize: "0.85rem" }}>
          System: {system.users ?? "-"} registered users, {system.analyses ?? "-"} analyses in total.
        </p>
      )}
    </div>
  );
}
