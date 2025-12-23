import { useCallback, useRef } from "react";

export const useInfiniteScroll = (onLoadMore: () => void, enabled: boolean) => {
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!(node && enabled)) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            callbackRef.current();
          }
        },
        { rootMargin: "2000px" }
      );

      observerRef.current.observe(node);
    },
    [enabled]
  );

  return sentinelRef;
};
