import { asc, eq, sql } from "drizzle-orm";
import { MODEL_NAME } from "./config";
import { db, embeddings } from "./db";
import { generateEmbeddingFromSeed } from "./generateEmbeddingFromSeed";

export const getImagesByEmbedding = async (
  textEmbedding: number[],
  limit: number,
  offset: number
) => {
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
    .offset(offset)
    .all();

  return results;
};

export const getRandomImages = async (
  mode: "random_embedding" | "random_images",
  seed: number,
  limit: number,
  offset: number
) => {
  // Get random images in a deterministic order
  if (mode === "random_images") {
    const randomOrder = sql<number>`((${embeddings.id} + ${seed}) * 2654435761) % 4294967296`;

    const results = await db
      .select({
        id: embeddings.id,
        filename: embeddings.filename,
      })
      .from(embeddings)
      .where(eq(embeddings.model, MODEL_NAME))
      .orderBy(asc(randomOrder))
      .limit(limit)
      .offset(offset)
      .all();

    return results;
  }

  // Find images similar to a random embedding
  if (mode === "random_embedding") {
    const seedEmbedding = generateEmbeddingFromSeed(seed);
    const results = await getImagesByEmbedding(seedEmbedding, limit, offset);
    return results;
  }

  throw new Error(`Unknown random mode: ${mode}`);
};
