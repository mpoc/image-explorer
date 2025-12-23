import { z } from "zod";

export const CsvIds = z.codec(z.string().nullish(), z.number().array(), {
  decode: (s) =>
    s
      ?.split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n)) ?? [],
  encode: (ids) => ids.join(","),
});
