import { EMBEDDING_API_BASE_URL } from "./config";
import { EmbeddingRecord } from "./types";

export const fetchTextEmbedding = async (text: string) => {
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
