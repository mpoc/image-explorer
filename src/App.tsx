import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { cn } from "./utils";
import "./index.css";

type ImageResult = {
  id: number;
  filename: string;
  distance: number;
};

type SimilarResponse = {
  source: { id: number; filename: string }[];
  results: ImageResult[];
  hasMore: boolean;
};

type SearchResponse = {
  query: string;
  results: ImageResult[];
  hasMore: boolean;
};

type RandomResponse = {
  results: ImageResult[];
  hasMore: boolean;
};

type PathImage = {
  id: number;
  filename: string;
};

const LIMIT = 40;

const getImagePageUrl = (imageUrl: string) => {
  const parsedUrl = new URL(imageUrl);
  const parts = parsedUrl.pathname.split("/");
  if (parts.length >= 4 && parts[1] === "image") {
    parsedUrl.pathname = `/images/${parts[2]}`;
    return parsedUrl.toString();
  }
  return imageUrl;
};

const imageUrlRegex = /image$/;
const getThumbnailUrl = (imageUrl: string) =>
  imageUrl.replace(imageUrlRegex, "thumbnail");

export default function App() {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [pathImages, setPathImages] = useState<PathImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useQueryStates({
    seed: parseAsInteger.withDefault(42),
    id: parseAsString,
    text: parseAsString,
  });
  const [searchInput, setSearchInput] = useState("");

  const { seed, id, text } = query;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const idList = id
    ? id
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n))
    : [];

  useEffect(() => {
    setSearchInput(text || "");
  }, [text]);

  // Reset and load initial images when query params change
  useEffect(() => {
    loadImages(0, true);
  }, [id, seed, text]);

  const loadImages = useCallback(
    async (offset: number, reset: boolean) => {
      if (reset) {
        setLoading(true);
        setError(null);
        setImages([]);
        setHasMore(false);
      } else {
        setLoadingMore(true);
      }

      try {
        let url: string;

        if (text) {
          // Text search mode
          url = `/api/search?text=${encodeURIComponent(text)}&limit=${LIMIT}&offset=${offset}`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to load images");
          }
          const data: SearchResponse = await response.json();
          setImages((prev) =>
            reset ? data.results : [...prev, ...data.results]
          );
          setHasMore(data.hasMore);
          if (reset) {
            setPathImages([]);
          }
        } else if (idList.length > 0) {
          // Similar images mode
          url = `/api/similar?id=${idList.join(",")}&limit=${LIMIT}&offset=${offset}`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to load images");
          }
          const data: SimilarResponse = await response.json();
          setImages((prev) =>
            reset ? data.results : [...prev, ...data.results]
          );
          setHasMore(data.hasMore);
          if (reset) {
            setPathImages(
              Array.isArray(data.source) ? data.source : [data.source]
            );
          }
        } else {
          // Random seed mode
          url = `/api/random?seed=${seed}&limit=${LIMIT}&offset=${offset}`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to load images");
          }
          const data: RandomResponse = await response.json();
          setImages((prev) =>
            reset ? data.results : [...prev, ...data.results]
          );
          setHasMore(data.hasMore);
          if (reset) {
            setPathImages([]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [text, idList.join(","), seed]
  );

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          loadImages(images.length, false);
        }
      },
      {
        rootMargin: "200px",
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadingMore, images.length, loadImages]);

  const handleNewSeed = () => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    setQuery({ seed: newSeed, id: null, text: null }, { history: "push" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) {
      return;
    }

    setQuery(
      { text: searchInput.trim(), id: null, seed: null },
      { history: "push" }
    );
    window.scrollTo(0, 0);
  };

  const handleImageClick = (imageId: number, e: React.MouseEvent) => {
    if (!shouldNavigateInPlace(e)) {
      return;
    }

    e.preventDefault();

    const newPath = [...idList, imageId];
    setQuery(
      { id: newPath.join(","), seed: null, text: null },
      { history: "push" }
    );
    window.scrollTo(0, 0);
  };

  const handlePathTruncate = (index: number) => {
    const newPath = idList.slice(0, index + 1);
    setQuery(
      { id: newPath.join(","), seed: null, text: null },
      { history: "push" }
    );
  };

  const handlePathRemove = (index: number) => {
    const newPath = idList.filter((_, i) => i !== index);
    if (newPath.length === 0) {
      setQuery({ id: null, seed: 42, text: null }, { history: "push" });
    } else {
      setQuery(
        { id: newPath.join(","), seed: null, text: null },
        { history: "push" }
      );
    }
  };

  const handleClearPath = () => {
    setQuery({ id: null, seed: 42, text: null }, { history: "push" });
  };

  const currentImage = pathImages.length > 0 ? pathImages.at(-1) : null;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-full">
        <header className="mb-8 border-zinc-800 border-b pb-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-medium text-2xl tracking-tight">
              Image Explorer
            </h1>
            <div className="flex gap-2">
              {idList.length > 0 && (
                <button
                  className="cursor-pointer border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm transition-colors hover:bg-zinc-700"
                  onClick={handleClearPath}
                  type="button"
                >
                  Clear Path
                </button>
              )}
              <button
                className="cursor-pointer border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm transition-colors hover:bg-zinc-700"
                onClick={handleNewSeed}
                type="button"
              >
                New Seed
              </button>
            </div>
          </div>

          <form className="flex gap-2" onSubmit={handleSearch}>
            <input
              className="flex-1 border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600 focus:bg-zinc-800"
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search images by text..."
              type="text"
              value={searchInput}
            />
            <button
              className="cursor-pointer border border-zinc-700 bg-zinc-800 px-6 py-2 text-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!searchInput.trim()}
              type="submit"
            >
              Search
            </button>
          </form>
        </header>

        <div className="mb-6 border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-medium text-lg">
            {text !== null
              ? `Search: "${text}"`
              : idList.length > 0
                ? `Path: ${idList.length} image${idList.length > 1 ? "s" : ""}`
                : `Seed: ${seed}`}
          </h2>
          {idList.length === 0 && text === null && (
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {window.location.origin}?seed={seed}
            </p>
          )}
          {idList.length > 0 && (
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {window.location.origin}?id={idList.join(",")}
            </p>
          )}
        </div>

        {pathImages.length > 1 && (
          <PathVisualization
            idList={idList}
            images={pathImages}
            onRemove={handlePathRemove}
            onTruncate={handlePathTruncate}
          />
        )}

        {currentImage && <SelectedImage image={currentImage} />}

        {loading && (
          <div className="py-24 text-center text-zinc-500">
            Loading images...
          </div>
        )}

        {error && (
          <div className="border border-red-900 bg-red-950/50 py-24 text-center text-red-400">
            Error: {error}
          </div>
        )}

        {!(loading || error) && (
          <>
            {images.length === 0 && (
              <div className="py-12 text-center text-zinc-500">
                No images found
              </div>
            )}
            <ResponsiveMasonry
              columnsCountBreakPoints={{ 350: 1, 768: 3, 1200: 4, 1600: 5 }}
            >
              <Masonry gutter="6px">
                {images.map((image) => (
                  <Image
                    image={image}
                    isInPath={idList.includes(image.id)}
                    key={image.id}
                    onImageClick={handleImageClick}
                  />
                ))}
              </Masonry>
            </ResponsiveMasonry>

            {/* Sentinel element for infinite scroll */}
            <div className="h-4" ref={sentinelRef} />

            {loadingMore && (
              <div className="py-8 text-center text-zinc-500">
                Loading more...
              </div>
            )}

            {!hasMore && images.length > 0 && (
              <div className="py-8 text-center text-sm text-zinc-600">
                No more images
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const PathVisualization = ({
  images,
  idList,
  onTruncate,
  onRemove,
}: {
  images: PathImage[];
  idList: number[];
  onTruncate: (index: number) => void;
  onRemove: (index: number) => void;
}) => (
  <div className="mb-6 border border-zinc-800 bg-zinc-900 p-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-medium text-sm text-zinc-400 uppercase tracking-wide">
        History ({images.length})
      </h3>
      <p className="text-xs text-zinc-500">Click to truncate • × to remove</p>
    </div>
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {idList.map((imageId, index) => {
        const image = images.find((img) => img.id === imageId);
        const isLast = index === idList.length - 1;
        return (
          <div
            className="flex shrink-0 items-center gap-2"
            key={`${imageId}-${index}`}
          >
            <div className="group relative shrink-0">
              <div
                className={cn(
                  "relative cursor-pointer border-2 bg-zinc-950 transition-all hover:border-zinc-400",
                  isLast ? "border-blue-500" : "border-zinc-700"
                )}
                onClick={() => onTruncate(index)}
              >
                <div
                  className={cn(
                    "-top-2 -left-2 absolute z-10 flex size-5 items-center justify-center font-medium text-xs",
                    isLast ? "bg-blue-500" : "bg-zinc-700"
                  )}
                >
                  {index + 1}
                </div>
                <button
                  className="-top-2 -right-2 absolute z-10 flex size-5 items-center justify-center bg-red-900 font-medium text-xs opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  type="button"
                >
                  ×
                </button>
                {image ? (
                  <img
                    className="size-16 object-cover"
                    src={`/api/proxy?url=${encodeURIComponent(getThumbnailUrl(image.filename))}`}
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center text-xs text-zinc-500">
                    {imageId}
                  </div>
                )}
              </div>
            </div>
            {index < idList.length - 1 && (
              <div className="flex-shrink-0 text-zinc-600">→</div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const SelectedImage = ({ image }: { image: PathImage }) => (
  <div className="mb-6 border-2 border-blue-500 bg-zinc-900 p-4">
    <h3 className="mb-3 font-medium text-sm text-zinc-400 uppercase tracking-wide">
      Current
    </h3>
    <div className="mx-auto w-fit border border-zinc-800 bg-zinc-950">
      <img
        className="block h-auto max-h-[700px] w-full object-contain"
        src={`/api/proxy?url=${encodeURIComponent(image.filename)}`}
      />
      <div className="border-zinc-800 border-t p-3">
        <div className="text-sm text-zinc-400">
          ID:{" "}
          <a
            className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition-colors hover:text-zinc-100 hover:decoration-zinc-500"
            href={getImagePageUrl(image.filename)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {image.id}
          </a>
        </div>
      </div>
    </div>
  </div>
);

const Image = ({
  image,
  onImageClick,
  isInPath,
}: {
  image: ImageResult;
  onImageClick: (id: number, e: React.MouseEvent) => void;
  isInPath: boolean;
}) => (
  <div
    className={cn(
      "relative block w-full border transition-all hover:border-zinc-600",
      isInPath
        ? "border-blue-500 bg-blue-950/20"
        : "border-zinc-800 bg-zinc-900"
    )}
    key={image.id}
  >
    <a
      className="absolute inset-0 z-0"
      href={`?id=${image.id}`}
      onClick={(e) => onImageClick(image.id, e)}
    />
    {isInPath && (
      <div className="absolute top-2 right-2 z-10 bg-blue-500 px-2 py-0.5 font-medium text-xs">
        In Path
      </div>
    )}
    <img
      className="block h-auto w-full min-w-full"
      loading="lazy"
      src={`/api/proxy?url=${encodeURIComponent(getThumbnailUrl(image.filename))}`}
    />
    <div className="flex items-center justify-between border-zinc-800 border-t p-2">
      <div className="text-xs text-zinc-500">
        ID:{" "}
        <a
          className="relative z-10 text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition-colors hover:text-zinc-200 hover:decoration-zinc-600"
          href={getImagePageUrl(image.filename)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {image.id}
        </a>
      </div>
      <div className="text-xs text-zinc-400">
        {(1 - image.distance).toFixed(4)}
      </div>
    </div>
  </div>
);
