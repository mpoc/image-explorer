import { useInfiniteQuery } from "@tanstack/react-query";
import { CsvIds } from "../shared/utils";

export type SimilarResponse = {
  source: { id: number; filename: string }[];
  results: ImageResult[];
  hasMore: boolean;
};

export type SearchResponse = {
  query: string;
  results: ImageResult[];
  hasMore: boolean;
};

export type RandomResponse = {
  results: ImageResult[];
  hasMore: boolean;
};

export type ImageResult = {
  id: number;
  filename: string;
  distance?: number;
};

export type PathImage = {
  id: number;
  filename: string;
};

const LIMIT = 40;

export const useRandomImages = (seed: number, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ["images", "random", seed],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(
        `/api/random?seed=${seed}&limit=${LIMIT}&offset=${pageParam}`
      );
      if (!res.ok) {
        throw new Error("Failed to load images");
      }
      return res.json() as Promise<RandomResponse>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.flatMap((p) => p.results).length : undefined,
    enabled,
  });

export const useSimilarImages = (ids: number[], enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ["images", "similar", ids],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(
        `/api/similar?id=${CsvIds.encode(ids)}&limit=${LIMIT}&offset=${pageParam}`
      );
      if (!res.ok) {
        throw new Error("Failed to load images");
      }
      return res.json() as Promise<SimilarResponse>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.flatMap((p) => p.results).length : undefined,
    enabled,
  });

export const useSearchImages = (text: string, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ["images", "search", text],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(
        `/api/search?text=${encodeURIComponent(text)}&limit=${LIMIT}&offset=${pageParam}`
      );
      if (!res.ok) {
        throw new Error("Failed to load images");
      }
      return res.json() as Promise<SearchResponse>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.flatMap((p) => p.results).length : undefined,
    enabled,
  });
