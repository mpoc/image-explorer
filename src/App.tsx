import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import "./index.css";

type ImageResult = {
  id: number;
  filename: string;
  distance: number;
};

type SimilarResponse = {
  source: { id: number; filename: string };
  results: ImageResult[];
};

type SearchResponse = {
  query: string;
  results: ImageResult[];
};

type SelectedImageProps = {
  id: number;
  filename: string;
};

const transformImageUrl = (url: string) => {
  const parsedUrl = new URL(url);
  const parts = parsedUrl.pathname.split("/");
  if (parts.length >= 4 && parts[1] === "image") {
    parsedUrl.pathname = `/images/${parts[2]}`;
    return parsedUrl.toString();
  }
  return url;
};

export default function App() {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<SelectedImageProps | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useQueryStates({
    seed: parseAsInteger.withDefault(42),
    id: parseAsInteger,
    text: parseAsString,
  });
  const [searchInput, setSearchInput] = useState("");

  const { seed, id, text } = query;

  useEffect(() => {
    setSearchInput(text || "");
  }, [text]);

  useEffect(() => {
    loadImages();
  }, [id, seed, text]);

  const loadImages = async () => {
    setLoading(true);
    setError(null);
    setImages([]);
    setSelectedImage(null);

    try {
      const LIMIT = 200;
      let url: string;

      if (text) {
        // Text search mode
        url = `/api/search?text=${encodeURIComponent(text)}&limit=${LIMIT}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to load images");
        }
        const data: SearchResponse = await response.json();
        setImages(data.results);
        setSelectedImage(null);
      } else if (id) {
        // Similar images mode
        url = `/api/similar?id=${id}&limit=${LIMIT}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to load images");
        }
        const data: SimilarResponse = await response.json();
        setImages(data.results);
        setSelectedImage(data.source);
      } else {
        // Random seed mode
        url = `/api/random?seed=${seed}&limit=${LIMIT}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to load images");
        }
        const data: ImageResult[] = await response.json();
        setImages(data);
        setSelectedImage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-full">
        <header className="mb-8 border-zinc-800 border-b pb-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-medium text-2xl tracking-tight">
              Image Explorer
            </h1>
            <div className="flex gap-2">
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
              : id !== null
                ? `Similar to ID: ${id}`
                : `Seed: ${seed}`}
          </h2>
          {id === null && text === null && (
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {window.location.origin}?seed={seed}
            </p>
          )}
        </div>

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
              columnsCountBreakPoints={{ 350: 1, 768: 3, 1200: 4, 1600: 5 }}
            >
              <Masonry gutter="6px">
                {images.map((image) => (
                  <Image image={image} key={image.id} />
                ))}
              </Masonry>
            </ResponsiveMasonry>
          </>
        )}
      </div>
    </div>
  );
}

const Image = ({ image }: { image: ImageResult }) => (
  <a
    className="block cursor-pointer border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-600"
    href={`?id=${image.id}`}
    key={image.id}
    onClick={() => window.scrollTo(0, 0)}
  >
    <img
      className="block h-auto w-full"
      loading="lazy"
      src={`/api/proxy?url=${encodeURIComponent(image.filename.replace(/image$/, "thumbnail"))}`}
    />
    <div className="flex items-center justify-between border-zinc-800 border-t p-2">
      <div className="text-xs text-zinc-500">
        ID:{" "}
        <a
          className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition-colors hover:text-zinc-200 hover:decoration-zinc-600"
          href={transformImageUrl(image.filename)}
          onClick={(e) => e.stopPropagation()}
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
  </a>
);

const SelectedImage = ({ image }: { image: SelectedImageProps }) => (
  <div className="mb-6 border-2 border-zinc-700 bg-zinc-900 p-4">
    <h3 className="mb-3 font-medium text-sm text-zinc-400 uppercase tracking-wide">
      Selected
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
            href={transformImageUrl(image.filename)}
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
