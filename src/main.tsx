import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installApiBridge, registerServiceWorker } from "./api";
import "./styles.css";

installApiBridge();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
