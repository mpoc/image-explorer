import { and, asc, eq, inArray, not, sql } from "drizzle-orm";
import { MODEL_NAME } from "./config";
import { db, embeddings } from "./db";
import { generateEmbeddingFromSeed } from "./generateEmbeddingFromSeed";

export const getEmbeddingDistanceExpression = (textEmbedding: number[]) =>
  sql<number>`vector_distance_cos(embedding, vector32(${JSON.stringify(textEmbedding)}))`;

export const fetchSimilarImages = async ({
  embedding,
  excludeIds = [],
  limit,
  offset,
}: {
  embedding: number[];
  excludeIds?: number[];
  limit: number;
  offset: number;
}) => {
  const distanceExpression = getEmbeddingDistanceExpression(embedding);

  const startedAt = performance.now();
  const results = await db
    .select({
      id: embeddings.id,
      filename: embeddings.filename,
      distance: distanceExpression,
    })
    .from(embeddings)
    .where(
      and(
        not(inArray(embeddings.id, excludeIds)),
        eq(embeddings.model, MODEL_NAME)
      )
    )
    .orderBy(asc(distanceExpression))
    .limit(limit)
    .offset(offset)
    .all();
  const endedAt = performance.now();

  return { results, endedAt, startedAt };
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
    const { results } = await fetchSimilarImages({
      embedding: seedEmbedding,
      limit,
      offset,
    });
    return results;
  }

  throw new Error(`Unknown random mode: ${mode}`);
};

export const fetchImagesByIds = async (idList: number[]) =>
  await db
    .select({
      id: embeddings.id,
      embedding: embeddings.embedding,
      filename: embeddings.filename,
    })
    .from(embeddings)
    .where(
      and(inArray(embeddings.id, idList), eq(embeddings.model, MODEL_NAME))
    )
    .all();
