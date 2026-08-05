import { loadEnv } from "./_env.ts";

loadEnv();

/**
 * Manually run the daily pipeline (bypasses the 06:00-ET cron gate).
 *   npm run pipeline           # skips if today's issue already exists
 *   npm run pipeline -- --force # regenerate today's issue
 *
 * Requires DATABASE_URL and AI_GATEWAY_API_KEY in the environment.
 */
async function main() {
  const force = process.argv.includes("--force");
  // Import lazily so env is loaded before any module reads it.
  const { runPipeline } = await import("../src/pipeline/run.ts");
  const summary = await runPipeline({ force });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
