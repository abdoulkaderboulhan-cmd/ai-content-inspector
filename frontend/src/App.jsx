import { useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewAnalysis from "./pages/NewAnalysis.jsx";
import Result from "./pages/Result.jsx";
import History from "./pages/History.jsx";
import Profile from "./pages/Profile.jsx";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  function doLogout() {
    logout();
    close();
    navigate("/");
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" onClick={close}>
          AI Content <span>Inspector</span>
        </Link>
        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
          &#9776;
        </button>
        <nav className={"nav-links" + (open ? " open" : "")}>
          {user ? (
            <>
              <NavLink to="/dashboard" onClick={close}>Dashboard</NavLink>
              <NavLink to="/analyze" onClick={close}>New Analysis</NavLink>
              <NavLink to="/history" onClick={close}>History</NavLink>
              <NavLink to="/profile" onClick={close}>Profile</NavLink>
              <button className="btn btn-outline" onClick={doLogout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={close}>Login</NavLink>
              <Link to="/register" className="btn btn-primary" onClick={close}>Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading...</p>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/analyze" element={<Protected><NewAnalysis /></Protected>} />
          <Route path="/result/:id" element={<Protected><Result /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">AI Content Inspector - WEX 428 Machine Learning project</footer>
    </>
  );
}
