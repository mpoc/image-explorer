import { useSyncExternalStore } from "react";

export const useShowBackToTop = (threshold = 400) =>
  useSyncExternalStore(
    (callback) => {
      window.addEventListener("scroll", callback);
      return () => window.removeEventListener("scroll", callback);
    },
    () => window.scrollY > threshold,
    () => false
  );
