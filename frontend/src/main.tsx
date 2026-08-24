import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Glossary from "./Glossary";
import "./theme.css";

function Root() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/glossary") return <Glossary />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
