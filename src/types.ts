import { z } from "zod";

// TODO: Remove once verified that Transformers v4 WebGPU works
export const EmbeddingRecord = z.object({
  embedding: z.array(z.number()).length(512),
});
