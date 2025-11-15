import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { EMBEDDING_API_BASE_URL, MODEL_NAME } from "./config";
import { db, embeddings } from "./db";
import { EmbeddingRecord } from "./types";

const generateIdempotencyKey = (filename: string, model: string): string =>
  `${filename}:${model}` as const;

const fetchEmbedding = async (imagePath: string) => {
  const image = imagePath.startsWith("http")
    ? imagePath
    : readFileSync(imagePath).toString("base64");

  const response = await fetch(`${EMBEDDING_API_BASE_URL}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.AUTHORIZATION
        ? { Authorization: process.env.AUTHORIZATION }
        : {}),
    },
    body: JSON.stringify({ image }),
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
  const embeddingArray = await fetchEmbedding(imagePath);

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
