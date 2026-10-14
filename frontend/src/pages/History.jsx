import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatDate, percent } from "../format.js";

const PAGE_SIZE = 10;

export default function History() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  // wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("page_size", PAGE_SIZE);
    if (query) params.set("search", query);
    if (label) params.set("label", label);
    setLoading(true);
    setError("");
    api("/api/analyses?" + params.toString())
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, label, page, reload]);

  async function remove(id) {
    if (!window.confirm("Delete this analysis? This cannot be undone.")) return;
    try {
      await api("/api/analyses/" + id, { method: "DELETE" });
      const left = (data ? data.items.length : 1) - 1;
      if (left === 0 && page > 1) setPage(page - 1);
      else setReload(reload + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const items = data && data.items ? data.items : [];
  const total = data && data.total !== undefined ? data.total : items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Analysis history</h2>
        <Link to="/analyze" className="btn btn-primary">New analysis</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="input" placeholder="Search in your texts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" style={{ maxWidth: 190, flex: "none" }} value={label} onChange={(e) => { setLabel(e.target.value); setPage(1); }}>
            <option value="">All results</option>
            <option value="Human">Human only</option>
            <option value="AI">AI only</option>
          </select>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        {loading && !data ? (
          <p className="center muted">Loading...</p>
        ) : items.length === 0 ? (
          <p className="center muted" style={{ padding: 24 }}>
            {query || label ? "No analyses match your search." : "You have no analyses yet. Click New analysis to start."}
          </p>
        ) : (
          <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Text</th>
                  <th>Result</th>
                  <th>Confidence</th>
                  <th>Words</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(it.created_at)}</td>
                    <td style={{ maxWidth: 340 }}>
                      {it.source_filename && <div className="muted" style={{ fontSize: "0.8rem" }}>{it.source_filename}</div>}
                      {it.text_preview}
                    </td>
                    <td><span className={"badge " + (it.label === "AI" ? "ai" : "human")}>{it.label}</span></td>
                    <td>{percent(it.confidence)}</td>
                    <td>{it.word_count}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <Link to={"/result/" + it.id} className="btn btn-outline" style={{ padding: "6px 12px" }}>View</Link>
                        <button className="btn btn-danger" style={{ padding: "6px 12px" }} onClick={() => remove(it.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="row spread" style={{ marginTop: 16 }}>
            <span className="muted">{total} analyses - page {page} of {pages}</span>
            <div className="row">
              <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn btn-outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
