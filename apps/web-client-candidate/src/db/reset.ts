import { client } from "./index";

/**
 * Database reset script.
 *
 * The recruiter-era tables (candidates, events, jobRoles, evidence,
 * recruiterActions) and their schema were removed when the candidate
 * UI was introduced. Re-add table references here once candidate-side
 * schemas are created.
 */
async function main() {
  console.log("🗑️  Resetting database...\n");
  console.log("  ⚠️  No tables to reset (recruiter schema removed).");
  console.log("  Add new candidate-side tables here when ready.\n");
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  client.end();
  process.exit(1);
});
