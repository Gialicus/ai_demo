import { LibSQLStore } from "@mastra/libsql";
import { DB_URL } from "./constants";

export const storage = new LibSQLStore({
  id: "memory-storage",
  url: DB_URL, // path is relative to the .mastra/output directory
});
