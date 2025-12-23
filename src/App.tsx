import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { useShowBackToTop } from "./useShowBackToTop";
import { cn, shouldNavigateInPlace } from "./utils";
import "./index.css";
import {
  type ImageResult,
  type PathImage,
  useRandomImages,
  useSearchImages,
  useSimilarImages,
} from "./useImages";

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

const getProxyUrl = (url: string) =>
  `/api/proxy?url=${encodeURIComponent(url)}`;

export default function App() {
  const showBackToTop = useShowBackToTop(400);
  const [query, setQuery] = useQueryStates({
    seed: parseAsInteger.withDefault(42),
    id: parseAsString,
    text: parseAsString,
  });
  const [searchInput, setSearchInput] = useState("");

  const { seed, id, text } = query;

  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const idList = id
    ? id
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n))
    : [];

  const mode = text ? "search" : idList.length > 0 ? "similar" : "random";

  const randomQuery = useRandomImages(seed, mode === "random");
  const similarQuery = useSimilarImages(idList, mode === "similar");
  const searchQuery = useSearchImages(text ?? "", mode === "search");

  const activeQuery =
    mode === "search"
      ? searchQuery
      : mode === "similar"
        ? similarQuery
        : randomQuery;

  const images = activeQuery.data?.pages.flatMap((p) => p.results) ?? [];
  const pathImages = similarQuery.data?.pages[0]?.source ?? [];
  const loading = activeQuery.isLoading;
  const loadingMore = activeQuery.isFetchingNextPage;
  const hasMore = activeQuery.hasNextPage;
  const error =
    activeQuery.error instanceof Error ? activeQuery.error.message : null;

  const sentinelRef = useInfiniteScroll(
    () => activeQuery.fetchNextPage(),
    hasMore && !loading && !loadingMore
  );

  useEffect(() => {
    setSelectedIndex(Math.max(0, idList.length - 1));
  }, [idList.length]);

  useEffect(() => {
    setSearchInput(text || "");
  }, [text]);

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

  const handleImageClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!shouldNavigateInPlace(e)) {
      return;
    }

    e.preventDefault();

    const url = new URL(e.currentTarget.href);
    setQuery(
      { id: url.searchParams.get("id"), seed: null, text: null },
      { history: "push" }
    );
    window.scrollTo(0, 0);
  };

  const updatePath = (newIdList: number[] | null) => {
    setQuery(
      {
        id: newIdList?.join(",") ?? null,
        seed: newIdList ? null : 42,
        text: null,
      },
      { history: "push" }
    );
  };

  const handlePathEndHere = (index: number) =>
    updatePath(idList.slice(0, index + 1));
  const handlePathStartHere = (index: number) =>
    updatePath(idList.slice(index));
  const handlePathSolo = (index: number) => updatePath([idList[index]]);
  const handlePathRemove = (index: number) => {
    const newPath = idList.filter((_, i) => i !== index);
    updatePath(newPath.length ? newPath : null);
  };
  const handleClearPath = () => updatePath(null);

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectImage = (index: number) => {
    setSelectedIndex(index);
  };

  const selectedImageId = idList[selectedIndex];
  const selectedImage =
    pathImages.find((img) => img.id === selectedImageId) ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 p-3 text-zinc-100 md:p-5">
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
            onEndHere={handlePathEndHere}
            onRemove={handlePathRemove}
            onSelect={handleSelectImage}
            onSolo={handlePathSolo}
            onStartHere={handlePathStartHere}
            selectedIndex={selectedIndex}
          />
        )}

        {selectedImage && <SelectedImage image={selectedImage} />}

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
              columnsCountBreakPoints={{ 350: 2, 768: 3, 1200: 4, 1600: 5 }}
              gutterBreakPoints={{ 0: "4px" }}
            >
              <Masonry>
                {images.map((image) => (
                  <Image
                    idList={idList}
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

      {/* Back to Top Button */}
      <button
        aria-label="Back to top"
        className={cn(
          "fixed right-6 bottom-6 z-50 flex size-12 cursor-pointer items-center justify-center border border-zinc-700 bg-zinc-800 text-sm transition-all hover:bg-zinc-700",
          showBackToTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
        onClick={handleBackToTop}
        type="button"
      >
        ↑
      </button>
    </div>
  );
}

const PathVisualization = ({
  images,
  idList,
  selectedIndex,
  onEndHere,
  onStartHere,
  onSolo,
  onRemove,
  onSelect,
}: {
  images: PathImage[];
  idList: number[];
  selectedIndex: number;
  onEndHere: (index: number) => void;
  onStartHere: (index: number) => void;
  onSolo: (index: number) => void;
  onRemove: (index: number) => void;
  onSelect: (index: number) => void;
}) => (
  <div className="mb-6 border border-zinc-800 bg-zinc-900 p-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-medium text-sm text-zinc-400 uppercase tracking-wide">
        History ({images.length})
      </h3>
    </div>
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {idList.map((imageId, index) => {
        const image = images.find((img) => img.id === imageId);
        const isLast = index === idList.length - 1;
        const isFirst = index === 0;
        const isSelected = index === selectedIndex;
        return (
          <div
            className="flex shrink-0 items-center gap-2"
            key={`${imageId}-${index}`}
          >
            <div className="group relative shrink-0">
              <div
                className={cn(
                  "relative cursor-pointer border-2 bg-zinc-950 transition-all",
                  isSelected
                    ? "border-blue-500"
                    : "border-zinc-700 hover:border-zinc-500"
                )}
                onClick={() => onSelect(index)}
              >
                {/* Top-left: Solo (just this image) */}
                <button
                  className="absolute top-0 left-0 z-10 flex size-6 items-center justify-center bg-green-600/80 text-sm opacity-0 transition-opacity hover:bg-green-500 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSolo(index);
                  }}
                  title="Just this image"
                  type="button"
                >
                  ◎
                </button>
                {/* Top-right: Remove */}
                <button
                  className="absolute top-0 right-0 z-10 flex size-6 items-center justify-center bg-red-900/80 text-sm opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  title="Remove from path"
                  type="button"
                >
                  ×
                </button>
                {/* Bottom-left: Truncate start (keep this and after) */}
                {!isFirst && (
                  <button
                    className="absolute bottom-0 left-0 z-10 flex size-6 items-center justify-center bg-zinc-700/80 text-sm opacity-0 transition-opacity hover:bg-zinc-600 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartHere(index);
                    }}
                    title="Keep this and after"
                    type="button"
                  >
                    ⇤
                  </button>
                )}
                {/* Bottom-right: Truncate end (keep this and before) */}
                {!isLast && (
                  <button
                    className="absolute right-0 bottom-0 z-10 flex size-6 items-center justify-center bg-zinc-700/80 text-sm opacity-0 transition-opacity hover:bg-zinc-600 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEndHere(index);
                    }}
                    title="Keep this and before"
                    type="button"
                  >
                    ⇥
                  </button>
                )}
                {/* Index badge - shown when not hovering */}
                <div
                  className={cn(
                    "absolute bottom-0 left-0 z-0 flex size-6 items-center justify-center font-medium text-sm transition-opacity group-hover:opacity-0",
                    isSelected ? "bg-blue-500" : "bg-zinc-700"
                  )}
                >
                  {index + 1}
                </div>
                {image ? (
                  <img
                    className="size-28 object-cover"
                    src={getProxyUrl(getThumbnailUrl(image.filename))}
                  />
                ) : (
                  <div className="flex size-28 items-center justify-center text-xs text-zinc-500">
                    {imageId}
                  </div>
                )}
              </div>
            </div>
            {index < idList.length - 1 && (
              <div className="shrink-0 text-zinc-600">→</div>
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
      Selected
    </h3>
    <div className="mx-auto w-fit border border-zinc-800 bg-zinc-950">
      <img
        className="block h-auto max-h-[650px] w-full object-contain"
        src={getProxyUrl(image.filename)}
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
  idList,
  onImageClick,
  isInPath,
}: {
  image: ImageResult;
  idList: number[];
  onImageClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
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
      href={`?id=${[...idList, image.id].join(",")}`}
      onClick={(e) => onImageClick(e)}
    />
    {isInPath && (
      <div className="absolute top-2 right-2 z-10 bg-blue-500 px-2 py-0.5 font-medium text-xs">
        In Path
      </div>
    )}
    <img
      className="block h-auto w-full min-w-full"
      loading="lazy"
      src={getProxyUrl(getThumbnailUrl(image.filename))}
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
