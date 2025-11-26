import { LibSQLVector } from "@mastra/libsql";
import { DB_URL } from "./constants";

export const vector = new LibSQLVector({
  id: "memory-vector",
  connectionUrl: DB_URL, // path is relative to the .mastra/output directory
});
