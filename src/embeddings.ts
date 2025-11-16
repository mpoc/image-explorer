import { readFileSync } from "node:fs";
import { EMBEDDING_API_BASE_URL } from "./config";
import { EmbeddingRecord } from "./types";

export const computeTextEmbedding = async (text: string) => {
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
export const computeImageEmbedding = async (imagePath: string) => {
  const url = new URL(imagePath);
  const image =
    url.protocol === "file:" ? readFileSync(url).toString("base64") : imagePath;

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
