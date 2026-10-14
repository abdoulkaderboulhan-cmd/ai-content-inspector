import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const MIN_CHARS = 20;
const MAX_CHARS = 20000;

export default function NewAnalysis() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function pickFile(e) {
    setError("");
    const f = e.target.files[0];
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith(".txt")) {
      setFile(null);
      e.target.value = "";
      return setError("Only .txt files are supported.");
    }
    if (f.size > 2 * 1024 * 1024) {
      setFile(null);
      e.target.value = "";
      return setError("The file is too large (maximum 2 MB).");
    }
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    let request;
    if (mode === "paste") {
      if (text.trim().length < MIN_CHARS) return setError("Please enter at least " + MIN_CHARS + " characters.");
      if (text.length > MAX_CHARS) return setError("The text is too long (maximum " + MAX_CHARS + " characters).");
      request = api("/api/analyses", { method: "POST", body: { text: text } });
    } else {
      if (!file) return setError("Choose a .txt file first.");
      const form = new FormData();
      form.append("file", file);
      request = api("/api/analyses/upload", { method: "POST", body: form });
    }
    setBusy(true);
    try {
      const saved = await request;
      navigate("/result/" + saved.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h2>New analysis</h2>
      <p className="muted">Paste a text or upload a .txt file. The model tells you if it was most likely written by a human or by AI.</p>

      <div className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <button type="button" className={"btn " + (mode === "paste" ? "btn-primary" : "btn-outline")} onClick={() => { setMode("paste"); setError(""); }}>
            Paste text
          </button>
          <button type="button" className={"btn " + (mode === "upload" ? "btn-primary" : "btn-outline")} onClick={() => { setMode("upload"); setError(""); }}>
            Upload .txt file
          </button>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          {error && <div className="alert alert-error">{error}</div>}

          {mode === "paste" ? (
            <div className="field">
              <label htmlFor="text">Your text</label>
              <textarea id="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste at least a paragraph here..." />
              <div className="hint">
                {words} words, {text.length} characters.
                {words > 0 && words < 50 ? " Short texts (under 50 words) give less reliable results." : ""}
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="file">Text file (.txt, max 2 MB)</label>
              <input id="file" type="file" accept=".txt,text/plain" onChange={pickFile} />
              {file && <div className="hint">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
            </div>
          )}

          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Analyzing..." : "Analyze"}</button>
        </form>
      </div>
    </div>
  );
}
