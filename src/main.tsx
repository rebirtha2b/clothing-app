import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "./index.css";

import App from "./App";
import ConfigError from "./components/ConfigError";
import { CONFIG_ERROR } from "./lib/constants";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {CONFIG_ERROR ? <ConfigError message={CONFIG_ERROR} /> : <App />}
  </StrictMode>,
);
