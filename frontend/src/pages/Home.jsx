import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Home() {
  const { user } = useAuth();
  return (
    <>
      <section className="hero">
        <h1>Was this text written by a human or by AI?</h1>
        <p>
          Paste a text or upload a file. Our machine learning model tells you who most likely
          wrote it, with a confidence score, and keeps a history of all your analyses.
        </p>
        <div className="actions">
          {user ? (
            <>
              <Link to="/analyze" className="btn btn-primary btn-lg">Analyze a text</Link>
              <Link to="/dashboard" className="btn btn-outline btn-lg">Open dashboard</Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-lg">Get started</Link>
              <Link to="/login" className="btn btn-outline btn-lg">Login</Link>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-3">
        <div className="card feature">
          <h3>Instant prediction</h3>
          <p>Human or AI in a second, together with the confidence of the model.</p>
        </div>
        <div className="card feature">
          <h3>Your analysis history</h3>
          <p>Search, filter and delete your previous analyses at any time.</p>
        </div>
        <div className="card feature">
          <h3>Dashboard and charts</h3>
          <p>See how many texts you checked and how they split between human and AI.</p>
        </div>
      </section>
    </>
  );
}
