import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "@neondatabase/serverless";
import { loadEnv } from "./_env.ts";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
    process.exit(1);
  }

  const dir = resolve(process.cwd(), "db/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pool = new Pool({ connectionString: url });
  try {
    for (const file of files) {
      const sql = readFileSync(resolve(dir, file), "utf8");
      process.stdout.write(`Applying ${file} … `);
      await pool.query(sql);
      console.log("ok");
    }
    console.log(`Done. Applied ${files.length} migration(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
