// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ToastContainer } from "react-toastify";

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <>
    <App />
    <ToastContainer
      style={{
        padding: "10px",
        justifyItems: "center",
        alignItems: "center",
      }}
    />
  </>,
  // {/* </StrictMode>, */}
);
