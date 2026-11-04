import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { isProductFlagEnabled } from "../lib/featureFlags";
import { StoreProvider, useStore } from "./data/RunStore";
import { readRunReturn } from "./nav";
import "./run.css";

function RunShell({ user }: { user: User | null }) {
  const store = useStore();
  const back = readRunReturn();
  return (
    <main className="run-shell">
      <a className="run-back" data-testid="run-back" href={back}>Back</a>
      <h1>Certo Run</h1>
      <p data-testid="run-session">{user ? user.uid : "signed-out"}</p>
      <p data-testid="run-world">{store.world}</p>
      <p data-testid="run-empty">Nothing here yet. Your agent fills this from your sources.</p>
    </main>
  );
}

function RunApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!isProductFlagEnabled("commandRun")) {
      window.location.replace(readRunReturn());
      return;
    }
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!isProductFlagEnabled("commandRun") || user === undefined) return null;

  return (
    <StoreProvider>
      <RunShell user={user} />
    </StoreProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RunApp />
    </StrictMode>,
  );
}
