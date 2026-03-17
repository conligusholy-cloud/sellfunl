import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo.svg";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const navigate = useNavigate();

  async function handleLogin() {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Špatný email nebo heslo.");
    }
  }

  return (
    <div className="page-center">
      <div style={{ textAlign: "center", marginBottom: "80px" }}>
        <img src={logo} alt="SellFunl" style={{ height: "100px", marginBottom: "12px" }} />
        <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text)" }}>SellFunl</div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", letterSpacing: "2px" }}>SALES FUNNEL TOOL</div>
      </div>

      <h2 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Přihlášení</h2>

      {error && <p className="error">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Heslo"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Přihlásit se</button>
      <p><Link to="/reset-password">Zapomněl jsem heslo</Link></p>
      <p>Nemáš účet? <Link to="/register">Registrace</Link></p>
    </div>
  );
}