import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";

// Tento hook sleduje, zda je uživatel přihlášený
// Použij ho v libovolné komponentě: const { user, loading } = useAuthState();
export function useAuthState() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); // cleanup při unmount
  }, []);

  return { user, loading };
}