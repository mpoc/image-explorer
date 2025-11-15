import { serve } from "bun";
import { and, asc, eq, lte, not, sql } from "drizzle-orm";
import { z } from "zod";
import { MODEL_NAME } from "./config";
import dashboard from "./dashboard.html";
import { db, embeddings } from "./db";
import { computeTextEmbedding } from "./embeddings";
import { generateEmbeddingFromSeed } from "./generateSeededEmbedding";

const Limit = z.coerce.number().default(40);

const server = serve({
  port: 3000,
  routes: {
    "/": dashboard,
    "/api/random": {
      async GET(req) {
        const url = new URL(req.url);
        const seed = Number.parseInt(url.searchParams.get("seed") || "42", 10);
        const limit = Limit.parse(url.searchParams.get("limit"));

        try {
          const seedEmbedding = generateEmbeddingFromSeed(seed);

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
          const textEmbedding = await computeTextEmbedding(text);

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
    "/api/proxy": {
      async GET(req) {
        const url = new URL(req.url);
        const imageUrl = url.searchParams.get("url");

        if (!imageUrl) {
          return Response.json(
            { error: "Missing url parameter" },
            { status: 400 }
          );
        }

        try {
          const response = await fetch(imageUrl, {
            headers: {
              ...(process.env.AUTHORIZATION
                ? { Authorization: process.env.AUTHORIZATION }
                : {}),
            },
          });

          if (!response.ok) {
            return Response.json(
              {
                error: `Failed to fetch image: ${response.status} ${response.statusText}`,
              },
              { status: response.status }
            );
          }

          const contentType = response.headers.get("content-type");

          console.log(
            new Date().toISOString(),
            `Proxied image from ${imageUrl} with content type ${contentType}`
          );

          return new Response(response.body, {
            headers: {
              ...(contentType ? { "Content-Type": contentType } : {}),
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=31536000",
            },
          });
        } catch (error) {
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
