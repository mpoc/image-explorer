import Bun, { serve } from "bun";
import { and, asc, eq, inArray, lte, not, sql } from "drizzle-orm";
import { z } from "zod";
import { MODEL_NAME } from "./config";
import dashboard from "./dashboard.html";
import { db, embeddings } from "./db";
import { computeTextEmbedding } from "./embeddings";
import { generateEmbeddingFromSeed } from "./generateEmbeddingFromSeed";
import { DEFAULT_EXTRAPOLATOR, getExtrapolator } from "./path-extrapolator";

const number = (input: unknown): number => z.coerce.number().parse(input);

const parseIdList = (idParam: string | null): number[] => {
  if (!idParam) {
    return [];
  }
  return idParam
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
};

const server = serve({
  port: 3000,
  routes: {
    "/": dashboard,
    "/api/random": {
      async GET(req) {
        const url = new URL(req.url);
        const seed = number(url.searchParams.get("seed") || "42");
        const limit = number(url.searchParams.get("limit") || "40");

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
        const idList = parseIdList(url.searchParams.get("id"));
        const limit = number(url.searchParams.get("limit") || "40");

        if (idList.length === 0) {
          return Response.json(
            { error: "Missing id parameter" },
            { status: 400 }
          );
        }

        try {
          // Fetch all embeddings for the path
          const pathResults = await db
            .select({
              id: embeddings.id,
              embedding: embeddings.embedding,
              filename: embeddings.filename,
            })
            .from(embeddings)
            .where(
              and(
                inArray(embeddings.id, idList),
                eq(embeddings.model, MODEL_NAME)
              )
            )
            .all();

          const embeddingMap = new Map(pathResults.map((r) => [r.id, r]));

          const orderedPath = idList
            .map((id) => embeddingMap.get(id))
            .filter((r) => r !== undefined);

          if (orderedPath.length === 0) {
            return Response.json(
              { error: "No images found for provided IDs" },
              { status: 404 }
            );
          }

          const pathEmbeddings = orderedPath.map((p) => p.embedding);
          const extrapolator = getExtrapolator(DEFAULT_EXTRAPOLATOR);
          const targetEmbedding = extrapolator.extrapolate(pathEmbeddings);

          const distanceExpression = sql<number>`vector_distance_cos(embedding, vector32(${JSON.stringify(targetEmbedding)}))`;

          // Find similar images, excluding all images in the path
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
                not(inArray(embeddings.id, idList)), // Exclude all path images, TODO: Rethink this approach, maybe only exclude last image?
                eq(embeddings.model, MODEL_NAME),
                lte(distanceExpression, 0.2)
              )
            )
            .orderBy(asc(distanceExpression))
            .limit(limit)
            .all();
          const endedAt = performance.now();

          console.log(
            `Found ${results.length} similar images for path [${idList.join(",")}], took ${(endedAt - startedAt).toFixed(2)} ms`
          );

          return Response.json({
            source: orderedPath.map((p) => ({
              id: p.id,
              filename: p.filename,
            })),
            mode: extrapolator.name,
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
        const limit = number(url.searchParams.get("limit") || "40");

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
        const params = new URL(req.url).searchParams;

        try {
          const urlFromParam = z.url().safeParse(params.get("url"));
          if (!urlFromParam.success) {
            return Response.json(
              { error: "Missing url parameter" },
              { status: 400 }
            );
          }

          const imageUrl = new URL(urlFromParam.data);

          // Proxy local files directly through Bun.file instead of fetch assuming better performance
          if (imageUrl.protocol === "file:") {
            const file = Bun.file(imageUrl);

            console.log(
              new Date().toISOString(),
              `Proxied local file from ${imageUrl.toString()}`
            );

            return new Response(file, {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=31536000",
              },
            });
          }

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
