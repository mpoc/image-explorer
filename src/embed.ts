import { eq } from "drizzle-orm";
import { MODEL_NAME } from "./config";
import { db, embeddings } from "./db";
import { fetchImageEmbedding } from "./embeddings";

const generateIdempotencyKey = (filename: string, model: string): string =>
  `${filename}:${model}` as const;

const getEmbedding = async (imagePath: string): Promise<number[]> => {
  const idempotencyKey = generateIdempotencyKey(imagePath, MODEL_NAME);

  const cached = await db
    .select()
    .from(embeddings)
    .where(eq(embeddings.idempotencyKey, idempotencyKey))
    .limit(1);

  const cachedRow = cached[0];
  if (cachedRow?.embedding) {
    console.log("✅ Using cached embedding");
    return cachedRow.embedding;
  }

  console.log("🔄 Generating new embedding...");
  const embeddingArray = await fetchImageEmbedding(imagePath);

  console.log("📝 Storing embedding in database...");

  await db.insert(embeddings).values({
    idempotencyKey,
    filename: imagePath,
    model: MODEL_NAME,
    embedding: embeddingArray,
  });

  console.log("💾 Embedding saved to database");
  return embeddingArray;
};
