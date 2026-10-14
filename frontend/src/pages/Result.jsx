import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { api } from "../api.js";
import { formatDate, percent } from "../format.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItem(null);
    setError("");
    api("/api/analyses/" + id).then(setItem).catch((err) => setError(err.message));
  }, [id]);

  async function remove() {
    if (!window.confirm("Delete this analysis? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api("/api/analyses/" + id, { method: "DELETE" });
      navigate("/history");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="alert alert-error">{error}</div>
        <p style={{ marginTop: 16 }}><Link to="/history">Back to history</Link></p>
      </div>
    );
  }
  if (!item) return <p className="center muted">Loading...</p>;

  const isAI = item.label === "AI";
  const aiProb = Number(item.ai_probability);
  const humanProb = 1 - aiProb;
  const color = isAI ? "#d97706" : "#059669";

  const chartData = {
    labels: ["Human", "AI"],
    datasets: [{ data: [humanProb * 100, aiProb * 100], backgroundColor: ["#059669", "#d97706"], borderWidth: 0 }],
  };
  const chartOptions = {
    cutout: "65%",
    plugins: {
      legend: { position: "bottom" },
      tooltip: { callbacks: { label: (c) => c.label + ": " + c.parsed.toFixed(1) + "%" } },
    },
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Analysis result</h2>
        <div className="row">
          <Link to="/analyze" className="btn btn-primary">New analysis</Link>
          <Link to="/history" className="btn btn-outline">History</Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <p className="muted" style={{ marginBottom: 4 }}>Prediction</p>
          <h1 style={{ color: color, fontSize: "2.4rem", marginBottom: 6 }}>
            {isAI ? "AI-generated" : "Human-written"}
          </h1>
          <p className="muted">Confidence: <b style={{ color: "#1f2937" }}>{percent(item.confidence)}</b></p>
          <div className="bar" style={{ marginBottom: 18 }}>
            <div style={{ width: percent(item.confidence), background: color }} />
          </div>

          {item.word_count < 50 && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              This text has only {item.word_count} words. Short texts give less reliable predictions.
            </div>
          )}

          <table className="table">
            <tbody>
              <tr><th>Date and time</th><td>{formatDate(item.created_at)}</td></tr>
              <tr><th>Word count</th><td>{item.word_count}</td></tr>
              <tr><th>Source</th><td>{item.source_filename ? item.source_filename : "Pasted text"}</td></tr>
              <tr><th>Probability AI</th><td>{percent(aiProb)}</td></tr>
              <tr><th>Probability Human</th><td>{percent(humanProb)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <p className="muted">Human vs AI probability</p>
          <div style={{ maxWidth: 280, margin: "0 auto" }}>
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Analyzed text</h3>
        <div className="text-box">{item.text}</div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-danger" onClick={remove} disabled={busy}>Delete this analysis</button>
        </div>
      </div>
    </div>
  );
}
