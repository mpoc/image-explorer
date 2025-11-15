import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import App from "./App";

const start = () => {
  // biome-ignore lint/style/noNonNullAssertion: <DOM>
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <NuqsAdapter>
      <App />
    </NuqsAdapter>
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
