import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── 1. Seed default questions ────────────────────────────────────────────────
// These map to the existing named columns in check_in_submissions.
// Options for single_choice questions use the same enum values as the DB columns
// so the migration script below can map them directly.

const DEFAULT_QUESTIONS = [
  {
    slug: "diet_weighed_foods",
    questionText: "How often did you weigh all foods raw/uncooked with a digital scale?",
    type: "single_choice",
    options: ["every_meal", "most_meals", "some_meals", "rarely", "never"],
    displayOrder: 1,
  },
  {
    slug: "diet_meal_prep_accuracy",
    questionText: "How often did you prepare meals exactly as written in your plan?",
    type: "single_choice",
    options: ["every_meal", "most_meals", "some_meals", "rarely", "never"],
    displayOrder: 2,
  },
  {
    slug: "diet_extras_frequency",
    questionText: "Excluding off-plan meals, how often did you eat/drink anything not in your plan?",
    type: "single_choice",
    options: ["never", "one_two_days", "few_days", "most_days", "every_day"],
    displayOrder: 3,
  },
  {
    slug: "diet_added_fats",
    questionText: "How do you use added fats when cooking?",
    type: "single_choice",
    options: ["light_spray", "small_amount", "one_tsp_or_more", "no_added_fats"],
    displayOrder: 4,
  },
  {
    slug: "diet_meal_timing",
    questionText: "How often did you eat meals more than 2 hours off schedule?",
    type: "single_choice",
    options: ["never", "one_two_days", "few_days", "most_days", "every_day"],
    displayOrder: 5,
  },
  {
    slug: "diet_off_plan_quality",
    questionText: "When you had an off-plan meal, how close was it to your plan in calories/macros?",
    type: "single_choice",
    options: ["very_close", "somewhat_close", "not_very_close", "very_different", "no_off_plan_meals"],
    displayOrder: 6,
  },
  {
    slug: "sleep_bedtime_consistency",
    questionText: "How often did you go to bed more than 1 hour later than your planned bedtime?",
    type: "single_choice",
    options: ["never", "one_two_days", "few_days", "most_days", "every_day"],
    displayOrder: 7,
  },
  {
    slug: "adherence_barrier",
    questionText: "What was your biggest adherence barrier this week?",
    type: "single_choice",
    options: ["no_issues", "hunger", "cravings", "social_events", "busy_time", "poor_planning", "low_motivation", "travel_disruption", "other"],
    displayOrder: 8,
  },
  {
    slug: "barrier_explain",
    questionText: "If you selected a barrier above, please explain briefly.",
    type: "free_text",
    options: null,
    displayOrder: 9,
  },
  {
    slug: "weekly_assessment",
    questionText: "Overall, how would you rate your adherence this week?",
    type: "single_choice",
    options: ["executed_exactly", "mostly_followed", "inconsistent", "didnt_follow"],
    displayOrder: 10,
  },
];

// Insert questions (skip if slug already exists)
for (const q of DEFAULT_QUESTIONS) {
  await conn.execute(
    `INSERT IGNORE INTO check_in_questions (slug, questionText, type, options, displayOrder, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [q.slug, q.questionText, q.type, q.options ? JSON.stringify(q.options) : null, q.displayOrder]
  );
}
console.log("✓ Default questions seeded");

// ─── 2. Migrate existing submission answers ───────────────────────────────────
// Map each named column in check_in_submissions to the corresponding question slug.
const COLUMN_TO_SLUG = {
  dietWeighedFoods: "diet_weighed_foods",
  dietMealPrepAccuracy: "diet_meal_prep_accuracy",
  dietExtrasFrequency: "diet_extras_frequency",
  dietAddedFats: "diet_added_fats",
  dietMealTiming: "diet_meal_timing",
  dietOffPlanQuality: "diet_off_plan_quality",
  sleepBedtimeConsistency: "sleep_bedtime_consistency",
  adherenceBarrier: "adherence_barrier",
  barrierExplain: "barrier_explain",
  weeklyAssessment: "weekly_assessment",
};

// Load question id map
const [questionRows] = await conn.execute("SELECT id, slug FROM check_in_questions");
const slugToId = {};
for (const row of questionRows) {
  slugToId[row.slug] = row.id;
}

// Load all submissions
const [submissions] = await conn.execute(
  `SELECT id, dietWeighedFoods, dietMealPrepAccuracy, dietExtrasFrequency, dietAddedFats,
          dietMealTiming, dietOffPlanQuality, sleepBedtimeConsistency, adherenceBarrier,
          barrierExplain, weeklyAssessment
   FROM check_in_submissions`
);

let migrated = 0;
for (const sub of submissions) {
  for (const [col, slug] of Object.entries(COLUMN_TO_SLUG)) {
    const value = sub[col];
    if (value == null) continue;
    const questionId = slugToId[slug];
    if (!questionId) continue;
    // Skip if answer already exists for this submission + question
    const [existing] = await conn.execute(
      "SELECT id FROM check_in_answers WHERE submissionId = ? AND questionId = ?",
      [sub.id, questionId]
    );
    if (existing.length > 0) continue;
    await conn.execute(
      "INSERT INTO check_in_answers (submissionId, questionId, value) VALUES (?, ?, ?)",
      [sub.id, questionId, String(value)]
    );
    migrated++;
  }
}
console.log(`✓ Migrated ${migrated} answers from ${submissions.length} submissions`);

await conn.end();
