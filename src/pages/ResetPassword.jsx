import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { Link } from "react-router-dom";
import logo from "../assets/logo.svg";

export default function ResetPassword() {
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [error,   setError]   = useState("");

  async function handleReset() {
    setError("");
    setMessage("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Email s odkazem na reset hesla byl odeslán!");
    } catch (err) {
      setError("Nepodařilo se odeslat email. Zkontroluj adresu.");
    }
  }

  return (
    <div className="page-center">
      <div style={{ textAlign: "center", marginBottom: "80px" }}>
        <img src={logo} alt="SellFunl" style={{ height: "100px", marginBottom: "12px" }} />
        <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text)" }}>SellFunl</div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", letterSpacing: "2px" }}>SALES FUNNEL TOOL</div>
      </div>

      <h2 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Reset hesla</h2>

      {message && <p className="success">{message}</p>}
      {error   && <p className="error">{error}</p>}
      <input
        type="email"
        placeholder="Tvůj email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <button onClick={handleReset}>Odeslat reset</button>
      <p><Link to="/login">Zpět na přihlášení</Link></p>
    </div>
  );
}