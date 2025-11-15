import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  customType,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const client = createClient({ url: "file:embeddings.db" });
// const client = createClient({ url: ":memory:" });
export const db = drizzle(client);

await db.run(sql`
  CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    model TEXT NOT NULL,
    embedding F32_BLOB(512) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export const float32Array = customType<{
  data: number[];
  config: { dimensions: number };
  configRequired: true;
  driverData: Buffer;
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`;
  },
  fromDriver(value: Buffer) {
    return Array.from(new Float32Array(value.buffer));
  },
  toDriver(value: number[]) {
    return sql`vector32(${JSON.stringify(value)})`;
  },
});

export const embeddings = sqliteTable(
  "embeddings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    filename: text("filename").notNull(),
    model: text("model").notNull(),
    embedding: float32Array("embedding", { dimensions: 512 }).notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  }
  // (table) => ({
  //   embeddingIdx: index("embeddings_idx").on(
  //     sql`libsql_vector_idx(${table.embedding})`
  //   ),
  // })
);
