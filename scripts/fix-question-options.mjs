import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Map of slug → human-readable options
const fixes = [
  {
    slug: "diet_weighed_foods",
    options: ["Every meal", "Most meals", "Some meals", "Rarely", "Never"],
  },
  {
    slug: "diet_meal_prep_accuracy",
    options: ["Always on plan", "Mostly on plan", "Somewhat on plan", "Rarely on plan", "Not on plan"],
  },
  {
    slug: "diet_extras_frequency",
    options: ["Never", "1–2 days", "A few days", "Most days", "Every day"],
  },
  {
    slug: "diet_added_fats",
    options: ["Light spray only", "Small amount", "1 tsp or more", "No added fats"],
  },
  {
    slug: "diet_meal_timing",
    options: ["Never", "1–2 days", "A few days", "Most days", "Every day"],
  },
  {
    slug: "diet_off_plan_quality",
    options: ["Very close", "Somewhat close", "Not very close", "Very different", "No off-plan meals"],
  },
  {
    slug: "sleep_bedtime_consistency",
    options: ["Never", "1–2 days", "A few days", "Most days", "Every day"],
  },
  {
    slug: "weekly_assessment",
    options: ["Executed exactly", "Mostly followed", "Inconsistent", "Didn't follow"],
  },
  {
    slug: "adherence_barrier",
    options: [
      "No issues",
      "Hunger",
      "Cravings",
      "Social events",
      "Busy / no time",
      "Poor planning",
      "Low motivation",
      "Travel / disruption",
      "Other",
    ],
  },
];

for (const fix of fixes) {
  const [rows] = await db.execute(
    "SELECT id, questionText FROM check_in_questions WHERE slug = ?",
    [fix.slug]
  );
  if (rows.length === 0) {
    console.log(`⚠️  Not found: ${fix.slug}`);
    continue;
  }
  const q = rows[0];
  await db.execute(
    "UPDATE check_in_questions SET options = ? WHERE id = ?",
    [JSON.stringify(fix.options), q.id]
  );
  console.log(`✅ Updated "${q.questionText.slice(0, 60)}…"`);
}

await db.end();
console.log("\nDone.");
