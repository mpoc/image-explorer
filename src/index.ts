import { serve } from "bun";
import { and, asc, eq, lte, not, sql } from "drizzle-orm";
import { z } from "zod";
import { EMBEDDING_API_BASE_URL, MODEL_NAME } from "./config";
import { db, embeddings } from "./db";
import { EmbeddingRecord } from "./types";

// Seeded random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49_297) % 233_280;
    return this.seed / 233_280;
  }

  nextInt(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// Generate a deterministic "random" embedding based on seed
const generateSeededEmbedding = (seed: number): number[] => {
  const rng = new SeededRandom(seed);
  const embedding = new Array(512);

  // Generate normalized random vector
  let sumSquares = 0;
  for (let i = 0; i < 512; i++) {
    embedding[i] = rng.next() * 2 - 1; // Range [-1, 1]
    sumSquares += embedding[i] * embedding[i];
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(sumSquares);
  for (let i = 0; i < 512; i++) {
    embedding[i] /= magnitude;
  }

  return embedding;
};

const fetchTextEmbedding = async (text: string) => {
  const response = await fetch(`${EMBEDDING_API_BASE_URL}/embed_text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Embedding API error: ${response.status} ${response.statusText}`,
      { cause: await response.text() }
    );
  }

  const data = await response.json();
  return EmbeddingRecord.parse(data).embedding;
};

const Limit = z.coerce.number().default(40);

const server = serve({
  port: 3000,
  routes: {
    "/api/random": {
      async GET(req) {
        const url = new URL(req.url);
        const seed = Number.parseInt(url.searchParams.get("seed") || "42", 10);
        const limit = Limit.parse(url.searchParams.get("limit"));

        try {
          // Generate a seeded embedding
          const seedEmbedding = generateSeededEmbedding(seed);

          // Find images similar to this random embedding
          const distanceExpression = sql<number>`vector_distance_cos(embedding, vector32(${JSON.stringify(seedEmbedding)}))`;

          const results = await db
            .select({
              id: embeddings.id,
              filename: embeddings.filename,
              distance: distanceExpression,
            })
            .from(embeddings)
            .where(eq(embeddings.model, MODEL_NAME))
            .orderBy(asc(distanceExpression))
            .limit(limit)
            .all();

          console.log(
            `Generated ${results.length} random images for seed ${seed}`
          );

          if (results.length === 0) {
            console.warn({
              message: "No images found for random seed",
              seed,
              limit,
              model: MODEL_NAME,
            });
          }

          return Response.json(results);
        } catch (error) {
          console.error("Error in /api/random:", error);
          return Response.json({ error: String(error) }, { status: 500 });
        }
      },
    },
    "/api/similar": {
      async GET(req) {
        const url = new URL(req.url);
        const id = Number.parseInt(url.searchParams.get("id") || "0", 10);
        const limit = Limit.parse(url.searchParams.get("limit"));

        if (!id) {
          return Response.json(
            { error: "Missing id parameter" },
            { status: 400 }
          );
        }

        try {
          // First, get the embedding for the source image
          const sourceResult = await db
            .select({
              embedding: embeddings.embedding,
              filename: embeddings.filename,
            })
            .from(embeddings)
            .where(and(eq(embeddings.id, id), eq(embeddings.model, MODEL_NAME)))
            .limit(1)
            .all();

          const [source] = sourceResult;
          if (!source) {
            return Response.json({ error: "Image not found" }, { status: 404 });
          }

          const sourceEmbedding = source.embedding;
          const sourceFilename = source.filename;

          const distanceExpression = sql<number>`vector_distance_cos(embedding, vector32(${JSON.stringify(sourceEmbedding)}))`;

          // Find similar images
          const results = await db
            .select({
              id: embeddings.id,
              filename: embeddings.filename,
              distance: distanceExpression,
            })
            .from(embeddings)
            .where(
              and(
                not(eq(embeddings.id, id)), // Exclude the source image itself
                eq(embeddings.model, MODEL_NAME),
                lte(distanceExpression, 0.2)
              )
            )
            .orderBy(asc(distanceExpression))
            .limit(limit)
            .all();

          console.log(`Found ${results.length} similar images for ID ${id}`);

          return Response.json({
            source: { id, filename: sourceFilename },
            results,
          });
        } catch (error) {
          return Response.json({ error: String(error) }, { status: 500 });
        }
      },
    },
    "/api/search": {
      async GET(req) {
        const url = new URL(req.url);
        const text = url.searchParams.get("text");
        const limit = Limit.parse(url.searchParams.get("limit"));

        if (!text) {
          return Response.json(
            { error: "Missing text parameter" },
            { status: 400 }
          );
        }

        try {
          // Get the embedding for the search text
          const textEmbedding = await fetchTextEmbedding(text);

          const distanceExpression = sql<number>`vector_distance_cos(embedding, vector32(${JSON.stringify(textEmbedding)}))`;

          // Find images similar to this text embedding
          const results = await db
            .select({
              id: embeddings.id,
              filename: embeddings.filename,
              distance: distanceExpression,
            })
            .from(embeddings)
            .where(eq(embeddings.model, MODEL_NAME))
            .orderBy(asc(distanceExpression))
            .limit(limit)
            .all();

          console.log(
            `Found ${results.length} images matching text: "${text}"`
          );

          return Response.json({
            query: text,
            results,
          });
        } catch (error) {
          console.error("Error in /api/search_by_text:", error);
          return Response.json({ error: String(error) }, { status: 500 });
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
