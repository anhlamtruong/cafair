/**
 * Database seed script.
 *
 * The recruiter-era seed data (events, jobRoles, candidates, evidence) was
 * removed along with the recruiter service. Re-populate with candidate-side
 * seed data once the new schemas are ready.
 */
async function seed() {
  console.log("Seeding database...");
  console.log("  ⚠️  No seed data configured (recruiter schema removed).");
  console.log("  Add candidate-side seed data here when ready.");
  console.log("✅ Seed complete (no-op).");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
