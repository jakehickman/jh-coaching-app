import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  date,
  json,
} from "drizzle-orm/mysql-core";

// ─── JSON column shape types ─────────────────────────────────────────────────

export interface MealIngredient {
  foodId?: number;
  name: string;
  quantity: number; // grams
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface Meal {
  id?: string;
  name: string;
  ingredients: MealIngredient[];
  notes?: string;
}

export interface TrainingExercise {
  name: string;
  sets: string;
  reps: string;
  notes?: string;
  equipment?: string;
  libraryId?: number;
}

export interface TrainingDay {
  name: string;
  exercises: TrainingExercise[];
}

export interface WorkoutSet {
  weight?: number | null;
  reps?: number | null;
  notes?: string | null;
  completed?: boolean;
}

export interface WorkoutExercise {
  name: string;
  libraryId?: number;
  substitutedFor?: string | null;
  equipmentDetails?: string | null; // legacy field, kept for backward compat
  machinePreset?: string | null;    // saved machine preset name e.g. "Prime Pin Loaded"
  machineSettings?: string | null;  // session-specific settings e.g. "Seat 4, pad 2"
  exerciseNotes?: string | null;
  sets: WorkoutSet[];
}

export interface CustomMuscleGroup {
  name: string;
  value: number;
}

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  approved: boolean("approved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Client profiles — one per client user, linked to a coach
export const clientProfiles = mysqlTable("client_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK -> users.id
  coachId: int("coachId"), // FK -> users.id (coach)
  displayName: varchar("displayName", { length: 128 }),
  startDate: date("startDate"),
  notes: text("notes"),
  checkInDay: mysqlEnum("checkInDay", ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]),
  stepGoal: int("stepGoal"), // daily step goal
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientProfile = typeof clientProfiles.$inferSelect;

// Daily logs — one row per day per client
export const dailyLogs = mysqlTable("daily_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  logDate: date("logDate").notNull(),
  weight: float("weight"), // kg
  sleepHours: float("sleepHours"),
  caffeineServings: float("caffeineServings"), // servings (1 serving = 80-100mg)
  trainingCompleted: boolean("trainingCompleted").default(false),
  trainingType: varchar("trainingType", { length: 64 }), // e.g. "Upper", "Lower", "Rest"
  stepsCount: int("stepsCount"),
  sleepQuality: int("sleepQuality"), // 1-5
  hungerLevel: int("hungerLevel"), // 1-5
  offPlanMeals: int("offPlanMeals").default(0), // number of off-plan meals that day
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyLog = typeof dailyLogs.$inferSelect;

// Body measurements — grouped by session date
export const measurements = mysqlTable("measurements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  measureDate: date("measureDate").notNull(),
  // Waist circumference (cm)
  waist: float("waist"),
  // Skinfold thickness — 5 readings per site (mm), averaged in coach view
  umbilical1: float("umbilical1"),
  umbilical2: float("umbilical2"),
  umbilical3: float("umbilical3"),
  umbilical4: float("umbilical4"),
  umbilical5: float("umbilical5"),
  suprailiac1: float("suprailiac1"),
  suprailiac2: float("suprailiac2"),
  suprailiac3: float("suprailiac3"),
  suprailiac4: float("suprailiac4"),
  suprailiac5: float("suprailiac5"),
  calf1: float("calf1"),
  calf2: float("calf2"),
  calf3: float("calf3"),
  calf4: float("calf4"),
  calf5: float("calf5"),
  thigh1: float("thigh1"),
  thigh2: float("thigh2"),
  thigh3: float("thigh3"),
  thigh4: float("thigh4"),
  thigh5: float("thigh5"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Measurement = typeof measurements.$inferSelect;

// Meal plans — coach sets per client, training vs non-training day
export const mealPlans = mysqlTable("meal_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // client
  coachId: int("coachId"),
  dayType: mysqlEnum("dayType", ["training", "rest"]).notNull(),
  meals: json("meals").$type<Meal[]>(), // JSON array of meal objects
  totalCalories: int("totalCalories"),
  totalProtein: int("totalProtein"),
  totalCarbs: int("totalCarbs"),
   totalFat: int("totalFat"),
  treatAllowanceKcal: int("treatAllowanceKcal"), // daily treat allowance in kcal (per day type)
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MealPlan = typeof mealPlans.$inferSelect;

// Shopping list items
export const shoppingItems = mysqlTable("shopping_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: varchar("category", { length: 64 }), // e.g. "Protein", "Vegetables"
  itemName: varchar("itemName", { length: 128 }).notNull(),
  quantity: varchar("quantity", { length: 64 }),
  checked: boolean("checked").default(false),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShoppingItem = typeof shoppingItems.$inferSelect;

// Training programs — coach sets per client
export const trainingPrograms = mysqlTable("training_programs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // client
  coachId: int("coachId"),
  programName: varchar("programName", { length: 128 }),
  days: json("days").$type<TrainingDay[]>(), // JSON: array of day objects with exercises
  schedule: json("schedule").$type<string[]>(), // JSON: array of strings e.g. ["Day 1","Day 2","Off","Day 3","Day 4","Off"]
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainingProgram = typeof trainingPrograms.$inferSelect;

// MESO cycles — periodization tracker
export const mesoCycles = mysqlTable("meso_cycles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mesoName: varchar("mesoName", { length: 64 }), // e.g. "MESO 1"
  startDate: date("startDate"),
  endDate: date("endDate"),
  totalWeeks: int("totalWeeks").default(4),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MesoCycle = typeof mesoCycles.$inferSelect;

// MESO sessions — individual workout logs within a meso cycle
export const mesoSessions = mysqlTable("meso_sessions", {
  id: int("id").autoincrement().primaryKey(),
  mesoId: int("mesoId").notNull(),
  userId: int("userId").notNull(),
  sessionDate: date("sessionDate"),
  weekNumber: int("weekNumber"),
  dayLabel: varchar("dayLabel", { length: 64 }), // e.g. "Day A - Upper"
  exercises: json("exercises").$type<WorkoutExercise[]>(), // JSON: [{name, sets:[{weight, reps, rir}]}
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MesoSession = typeof mesoSessions.$inferSelect;

// Timeline milestones — show prep countdown
export const timelineMilestones = mysqlTable("timeline_milestones", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  milestoneDate: date("milestoneDate").notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }), // e.g. "Check-in", "Peak Week", "Show Day"
  completed: boolean("completed").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TimelineMilestone = typeof timelineMilestones.$inferSelect;

// Coaching notes — coach leaves notes per client
export const coachingNotes = mysqlTable("coaching_notes", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(),
  clientId: int("clientId").notNull(),
  noteDate: date("noteDate").notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 64 }), // e.g. "Check-in", "Adjustment", "Motivation"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoachingNote = typeof coachingNotes.$inferSelect;

// Exercise library — exercises with muscle group volume contributions
export const exerciseLibrary = mysqlTable("exercise_library", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  // Muscle group contributions (sets per set performed)
  chest: float("chest").default(0),
  frontDelts: float("frontDelts").default(0),
  sideDelts: float("sideDelts").default(0),
  triceps: float("triceps").default(0),
  lats: float("lats").default(0),
  upperBack: float("upperBack").default(0),
  rearDelts: float("rearDelts").default(0),
  biceps: float("biceps").default(0),
  quads: float("quads").default(0),
  hams: float("hams").default(0),
  glutes: float("glutes").default(0),
  gluteMed: float("gluteMed").default(0),
  calves: float("calves").default(0),
  abs: float("abs").default(0),
  // Extra custom muscle groups stored as JSON: [{name, value}]
  customGroups: json("customGroups").$type<CustomMuscleGroup[]>(),
  videoUrl: varchar("videoUrl", { length: 512 }), // YouTube or other video URL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExerciseLibraryEntry = typeof exerciseLibrary.$inferSelect;
export type InsertExerciseLibraryEntry = typeof exerciseLibrary.$inferInsert;

// Weekly check-ins — structured weekly summary
export const weeklyCheckIns = mysqlTable("weekly_check_ins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  weekStartDate: date("weekStartDate").notNull(),
  avgWeight: float("avgWeight"),
  weightChange: float("weightChange"),
  trainingAdherence: int("trainingAdherence"), // 0-100 %
  nutritionAdherence: int("nutritionAdherence"), // 0-100 %
  overallFeeling: int("overallFeeling"), // 1-10
  wins: text("wins"),
  challenges: text("challenges"),
  nextWeekGoals: text("nextWeekGoals"),
  coachFeedback: text("coachFeedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyCheckIn = typeof weeklyCheckIns.$inferSelect;

// Nutrition foods — food database with macros per 100g (USDA-sourced)
export const nutritionFoods = mysqlTable("nutrition_foods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  calories: float("calories").notNull().default(0),   // kcal per 100g
  protein: float("protein").notNull().default(0),     // g per 100g
  carbs: float("carbs").notNull().default(0),         // g per 100g
  fiber: float("fiber").notNull().default(0),         // g per 100g
  fat: float("fat").notNull().default(0),             // g per 100g
  servingUnit: varchar("servingUnit", { length: 64 }),  // e.g. "egg", "slice", "tbsp" — null means per 100g
  servingGrams: float("servingGrams"),                  // grams per 1 serving unit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NutritionFood = typeof nutritionFoods.$inferSelect;
export type InsertNutritionFood = typeof nutritionFoods.$inferInsert;

// Workout sessions — client logs sets/reps/weight per program day
export const workoutSessions = mysqlTable("workout_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionDate: date("sessionDate").notNull(),
  dayLabel: varchar("dayLabel", { length: 128 }).notNull(), // e.g. "Day A - Upper"
  // JSON: [{name: string, sets: [{weight: number|null, reps: number|null, notes: string|null}]}]
  exercises: json("exercises").$type<WorkoutExercise[]>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

// Onboarding submissions — new client intake form responses
export const onboardingSubmissions = mysqlTable("onboarding_submissions", {
  id: int("id").autoincrement().primaryKey(),
  // Optional link to a user account (null if submitted before account creation)
  userId: int("userId"),
  // Personal details
  fullName: varchar("fullName", { length: 128 }),
  email: varchar("email", { length: 320 }),
  age: int("age"),
  heightCm: float("heightCm"),
  currentWeightKg: float("currentWeightKg"),
  goalWeightKg: float("goalWeightKg"),
  // Goals & history
  primaryGoal: varchar("primaryGoal", { length: 256 }),
  trainingExperience: varchar("trainingExperience", { length: 64 }), // e.g. "None", "< 1 year", "1-3 years", "3+ years"
  trainingFrequency: varchar("trainingFrequency", { length: 64 }), // days per week
  equipment: varchar("equipment", { length: 64 }), // "Gym", "Home gym", "Minimal"
  dietApproach: varchar("dietApproach", { length: 64 }), // "Track calories", "Flexible/intuitive", "No preference"
  injuries: text("injuries"),
  lifestyle: text("lifestyle"), // work schedule, stress, sleep notes
  additionalInfo: text("additionalInfo"),
  // Meta
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewed: boolean("reviewed").default(false).notNull(),
});

export type OnboardingSubmission = typeof onboardingSubmissions.$inferSelect;
export type InsertOnboardingSubmission = typeof onboardingSubmissions.$inferInsert;

// Habits — coach-created habits
export const habits = mysqlTable("habits", {
  id: int("id").autoincrement().primaryKey(),
  coachId: int("coachId").notNull(), // FK -> users.id (coach)
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  frequency: mysqlEnum("frequency", ["daily", "x_per_week"]).notNull().default("daily"),
  targetDays: int("targetDays").default(7), // 1-7, used when frequency = x_per_week
  startDate: date("startDate"),
  deleted: boolean("deleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Habit = typeof habits.$inferSelect;
export type InsertHabit = typeof habits.$inferInsert;

// Habit assignments — which clients have which habits assigned
export const habitAssignments = mysqlTable("habit_assignments", {
  id: int("id").autoincrement().primaryKey(),
  habitId: int("habitId").notNull(), // FK -> habits.id
  clientId: int("clientId").notNull(), // FK -> users.id (client)
  active: boolean("active").default(true).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type HabitAssignment = typeof habitAssignments.$inferSelect;

// Habit completions — one row per completed day per habit per client
export const habitCompletions = mysqlTable("habit_completions", {
  id: int("id").autoincrement().primaryKey(),
  habitId: int("habitId").notNull(), // FK -> habits.id
  clientId: int("clientId").notNull(), // FK -> users.id (client)
  completedDate: date("completedDate").notNull(), // yyyy-mm-dd
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HabitCompletion = typeof habitCompletions.$inferSelect;

// Frequency enum for execution accuracy questions
export const FREQ_OPTIONS = ["never", "once_twice", "few_days", "most_days"] as const;
export type FreqOption = typeof FREQ_OPTIONS[number];

// Adherence barrier options
export const BARRIER_OPTIONS = [
  "no_issues", "hunger", "cravings", "social_events",
  "busy_time", "poor_planning", "low_motivation", "travel_disruption", "other"
] as const;
export type BarrierOption = typeof BARRIER_OPTIONS[number];

// Check-in submissions — client weekly check-in form responses
export const checkInSubmissions = mysqlTable("check_in_submissions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(), // FK -> users.id
  coachId: int("coachId"), // FK -> users.id
  weekStartDate: date("weekStartDate").notNull(), // Monday of the check-in week
  // Section 1: Diet Execution (6 questions)
  // Q1: How often did you weigh all foods raw/uncooked with a digital scale?
  dietWeighedFoods: mysqlEnum("dietWeighedFoods", ["every_meal","most_meals","some_meals","rarely","never"]),
  // Q2: How often did you prepare meals exactly as written in your plan?
  dietMealPrepAccuracy: mysqlEnum("dietMealPrepAccuracy", ["every_meal","most_meals","some_meals","rarely","never"]),
  // Q3: Excluding off-plan meals, how often did you eat/drink anything not in your plan?
  dietExtrasFrequency: mysqlEnum("dietExtrasFrequency", ["never","one_two_days","few_days","most_days","every_day"]),
  // Q4: How do you use added fats when cooking?
  dietAddedFats: mysqlEnum("dietAddedFats", ["light_spray","small_amount","one_tsp_or_more","no_added_fats"]),
  // Q5: How often did you eat meals more than 2 hours off schedule?
  dietMealTiming: mysqlEnum("dietMealTiming", ["never","one_two_days","few_days","most_days","every_day"]),
  // Q6: When you had an off-plan meal, how close was it to your plan in calories/macros?
  dietOffPlanQuality: mysqlEnum("dietOffPlanQuality", ["very_close","somewhat_close","not_very_close","very_different","no_off_plan_meals"]),
  // Q7: How often did you go to bed more than 1 hour later than your planned bedtime?
  sleepBedtimeConsistency: mysqlEnum("sleepBedtimeConsistency", ["never","one_two_days","few_days","most_days","every_day"]),

  // Section 2: Adherence Barrier
  adherenceBarrier: mysqlEnum("adherenceBarrier", [
    "no_issues","hunger","cravings","social_events",
    "busy_time","poor_planning","low_motivation","travel_disruption","other"
  ]),
  barrierExplain: text("barrierExplain"), // only shown if barrier != no_issues
  // Section 3: Weekly Self-Assessment
  weeklyAssessment: mysqlEnum("weeklyAssessment", ["executed_exactly","mostly_followed","inconsistent","didnt_follow"]),
  // Coach review status
  reviewedAt: timestamp("reviewedAt"),
  // Coach notes — feedback and program adjustments tied to this submission
  coachNotes: text("coachNotes"),
  // Changes made — free-text record of meal plan / training adjustments after review
  changesNotes: text("changesNotes"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CheckInSubmission = typeof checkInSubmissions.$inferSelect;;
export type InsertCheckInSubmission = typeof checkInSubmissions.$inferInsert;

// Equipment presets — per user per exercise, saved machine names + last-used settings
export const equipmentPresets = mysqlTable("equipment_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exerciseName: varchar("exerciseName", { length: 128 }).notNull(),
  presetName: varchar("presetName", { length: 256 }).notNull(), // e.g. "Prime Pin Loaded"
  lastSettings: varchar("lastSettings", { length: 512 }),       // e.g. "Seat 4, pad 2" — auto-updated per session
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EquipmentPreset = typeof equipmentPresets.$inferSelect;
export type InsertEquipmentPreset = typeof equipmentPresets.$inferInsert;

// ─── New single-cycle check-in system ────────────────────────────────────────

// One active row per client — the current check-in cycle.
// 'overdue' is NOT stored; it is derived at read time: status='upcoming' AND dueDate < today.
export const checkInCycles = mysqlTable("check_in_cycles", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(), // FK -> users.id
  dueDate: date("dueDate").notNull(),  // The date this check-in is due
  status: mysqlEnum("status", ["upcoming", "submitted"]).notNull().default("upcoming"),
  submissionId: int("submissionId"),   // FK -> check_in_submissions.id (set when submitted)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CheckInCycle = typeof checkInCycles.$inferSelect;
export type InsertCheckInCycle = typeof checkInCycles.$inferInsert;

// Permanent log of all completed cycles (coach clicked "Mark Complete").
export const checkInHistory = mysqlTable("check_in_history", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(), // FK -> users.id
  dueDate: date("dueDate").notNull(),  // The due date of the completed cycle
  submissionId: int("submissionId"),   // FK -> check_in_submissions.id (null if cycle was missed)
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export type CheckInHistoryRow = typeof checkInHistory.$inferSelect;
export type InsertCheckInHistory = typeof checkInHistory.$inferInsert;

// Append-only history of every macro change per client.
// One row is inserted each time a coach saves a meal plan update.
export const mealPlanHistory = mysqlTable("meal_plan_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),       // client
  coachId: int("coachId"),               // coach who made the change
  // Training day macros
  trainingCalories: int("trainingCalories"),
  trainingProtein: int("trainingProtein"),
  trainingCarbs: int("trainingCarbs"),
  trainingFat: int("trainingFat"),
  // Rest day macros
  restCalories: int("restCalories"),
  restProtein: int("restProtein"),
  restCarbs: int("restCarbs"),
  restFat: int("restFat"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});
export type MealPlanHistoryRow = typeof mealPlanHistory.$inferSelect;
export type InsertMealPlanHistory = typeof mealPlanHistory.$inferInsert;
