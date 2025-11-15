import { z } from "zod";

export const EmbeddingRecord = z.object({
  embedding: z.array(z.number()).length(512),
});
