import { createRoot } from "react-dom/client";
import './lib/i18n';
import App from "./App";
import "./index.css";
import { initTheme } from "./lib/theme";

initTheme();
createRoot(document.getElementById("root")!).render(<App />);
