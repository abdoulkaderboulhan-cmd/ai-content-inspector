import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, BASE } from "../api.js";
import { useAuth } from "../auth.jsx";
import { formatDate } from "../format.js";
import { COUNTRIES } from "../countries.js";

const API = BASE;

function Msg({ msg }) {
  if (!msg) return null;
  return <div className={"alert " + (msg.type === "ok" ? "alert-ok" : "alert-error")}>{msg.text}</div>;
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [info, setInfo] = useState({ phone: "", country: "", university: "", bio: "" });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [name, setName] = useState(user ? user.full_name : "");
  const [loaded, setLoaded] = useState(false);

  const [photoMsg, setPhotoMsg] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);
  const [infoBusy, setInfoBusy] = useState(false);

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [delPassword, setDelPassword] = useState("");
  const [delMsg, setDelMsg] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => {
    api("/api/profile")
      .then((p) => {
        setInfo({ phone: p.phone, country: p.country, university: p.university, bio: p.bio });
        setAvatarUrl(p.avatar_url);
      })
      .catch((err) => setInfoMsg({ type: "error", text: err.message }))
      .finally(() => setLoaded(true));
  }, []);

  function setField(key, value) {
    setInfo({ ...info, [key]: value });
  }

  async function pickPhoto(e) {
    const f = e.target.files[0];
    e.target.value = "";
    setPhotoMsg(null);
    if (!f) return;
    if (!/\.(png|jpe?g|webp)$/i.test(f.name)) return setPhotoMsg({ type: "error", text: "Please choose a PNG, JPG or WEBP picture." });
    if (f.size > 2 * 1024 * 1024) return setPhotoMsg({ type: "error", text: "The picture is too large (maximum 2 MB)." });
    const form = new FormData();
    form.append("file", f);
    setPhotoBusy(true);
    try {
      const p = await api("/api/profile/avatar", { method: "POST", body: form });
      setAvatarUrl(p.avatar_url);
      setPhotoMsg({ type: "ok", text: "Profile picture updated." });
    } catch (err) {
      setPhotoMsg({ type: "error", text: err.message });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoMsg(null);
    setPhotoBusy(true);
    try {
      const p = await api("/api/profile/avatar", { method: "DELETE" });
      setAvatarUrl(p.avatar_url);
      setPhotoMsg({ type: "ok", text: "Profile picture removed." });
    } catch (err) {
      setPhotoMsg({ type: "error", text: err.message });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveInfo(e) {
    e.preventDefault();
    setInfoMsg(null);
    if (name.trim().length < 2) return setInfoMsg({ type: "error", text: "Enter your full name." });
    setInfoBusy(true);
    try {
      if (name.trim() !== user.full_name) {
        const updated = await api("/api/auth/me", { method: "PUT", body: { full_name: name.trim() } });
        setUser(updated);
      }
      await api("/api/profile", { method: "PUT", body: info });
      setInfoMsg({ type: "ok", text: "Your profile was saved." });
    } catch (err) {
      setInfoMsg({ type: "error", text: err.message });
    } finally {
      setInfoBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (!current) return setPwMsg({ type: "error", text: "Enter your current password." });
    if (password.length < 8) return setPwMsg({ type: "error", text: "The new password must have at least 8 characters." });
    if (password !== confirm) return setPwMsg({ type: "error", text: "The two passwords do not match." });
    setPwBusy(true);
    try {
      await api("/api/auth/me", { method: "PUT", body: { current_password: current, new_password: password } });
      setCurrent("");
      setPassword("");
      setConfirm("");
      setPwMsg({ type: "ok", text: "Your password was changed." });
    } catch (err) {
      setPwMsg({ type: "error", text: err.message });
    } finally {
      setPwBusy(false);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDelMsg(null);
    if (!delPassword) return setDelMsg({ type: "error", text: "Enter your current password to confirm." });
    if (!window.confirm("Delete your account and ALL your analyses? This cannot be undone.")) return;
    setDelBusy(true);
    try {
      await api("/api/account/delete", { method: "POST", body: { current_password: delPassword } });
      logout();
      navigate("/");
    } catch (err) {
      setDelMsg({ type: "error", text: err.message });
      setDelBusy(false);
    }
  }

  if (!user) return null;

  const initials = (user.full_name || user.email || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <h2>My profile</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 18, alignItems: "center" }}>
          {avatarUrl ? (
            <img src={API + avatarUrl} alt="Profile" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: 700 }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{user.full_name}</div>
            <div className="muted">{user.email}</div>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: 10 }}>Member since {formatDate(user.created_at)}</div>
            <div className="row">
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={pickPhoto} style={{ display: "none" }} />
              <button type="button" className="btn btn-outline" disabled={photoBusy} onClick={() => fileRef.current.click()}>
                {photoBusy ? "Please wait..." : avatarUrl ? "Change picture" : "Upload picture"}
              </button>
              {avatarUrl && <button type="button" className="btn btn-danger" disabled={photoBusy} onClick={removePhoto}>Remove</button>}
            </div>
          </div>
        </div>
        {photoMsg && <div style={{ marginTop: 12 }}><Msg msg={photoMsg} /></div>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Personal information</h3>
        <form className="form" onSubmit={saveInfo} noValidate>
          <Msg msg={infoMsg} />
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={info.phone} maxLength={40} onChange={(e) => setField("phone", e.target.value)} autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <select id="country" value={info.country} onChange={(e) => setField("country", e.target.value)} autoComplete="country-name">
              <option value="">Select your country</option>
              {info.country && !COUNTRIES.includes(info.country) && <option value={info.country}>{info.country}</option>}
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="university">University</label>
            <input id="university" value={info.university} maxLength={120} onChange={(e) => setField("university", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="bio">Short bio</label>
            <textarea id="bio" style={{ minHeight: 100 }} value={info.bio} maxLength={500} onChange={(e) => setField("bio", e.target.value)} />
            <div className="hint">{info.bio.length} / 500</div>
          </div>
          <button className="btn btn-primary" disabled={infoBusy || !loaded}>{infoBusy ? "Saving..." : "Save profile"}</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Change password</h3>
        <form className="form" onSubmit={savePassword} noValidate>
          <Msg msg={pwMsg} />
          <div className="field">
            <label htmlFor="cur">Current password</label>
            <input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="pw">New password</label>
            <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <div className="hint">At least 8 characters.</div>
          </div>
          <div className="field">
            <label htmlFor="pw2">Confirm new password</label>
            <input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="btn btn-primary" disabled={pwBusy}>{pwBusy ? "Saving..." : "Change password"}</button>
        </form>
      </div>

      <div className="card" style={{ borderColor: "#fecaca" }}>
        <h3 style={{ color: "#dc2626" }}>Delete account</h3>
        <p className="muted">This permanently deletes your account and all your analyses. Enter your current password to confirm.</p>
        <form className="form" onSubmit={deleteAccount} noValidate>
          <Msg msg={delMsg} />
          <div className="field">
            <label htmlFor="delpw">Current password</label>
            <input id="delpw" type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn btn-danger" disabled={delBusy}>{delBusy ? "Deleting..." : "Delete my account"}</button>
        </form>
      </div>
    </div>
  );
}
