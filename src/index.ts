import { serve } from "bun";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { MODEL_NAME } from "./config";
import { db, embeddings } from "./db";

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
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
