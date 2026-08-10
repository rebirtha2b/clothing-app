import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "./index.css";

import App from "./App";
import ConfigError from "./components/ConfigError";
import { AuthProvider } from "./hooks/useAuth";
import { CONFIG_ERROR } from "./lib/constants";

// The config check stays outermost: AuthProvider builds a Supabase client from
// these same values, so a misconfigured app must not get that far.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {CONFIG_ERROR ? (
      <ConfigError message={CONFIG_ERROR} />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
);
