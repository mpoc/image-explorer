import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import App from "./App";

const queryClient = new QueryClient();

const start = () => {
  // biome-ignore lint/style/noNonNullAssertion: <DOM>
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <App />
      </NuqsAdapter>
    </QueryClientProvider>
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
