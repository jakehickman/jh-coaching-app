import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const exercises = [
  { name: "Cable Pushdown", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 1, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Flat Smith Press", chest: 1, frontDelts: 0.5, sideDelts: 0, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Low Incline DB Press", chest: 1, frontDelts: 0.5, sideDelts: 0, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Cable Overhead Extension", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 1, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "1-Arm Cable Lateral Raise", chest: 0, frontDelts: 0.5, sideDelts: 1, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Neutral Cable Pulldown", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 1, upperBack: 0.5, rearDelts: 0.5, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Overhand Machine Row", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0.5, upperBack: 1, rearDelts: 1, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Alternating DB Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 1, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Kneeling Cable Crunch", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 1 },
  { name: "Bent Leg Calf Raise", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 1, abs: 0 },
  { name: "Barbell SLDL", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0.5, rearDelts: 0, biceps: 0, quads: 0, hams: 1, glutes: 0.5, calves: 0, abs: 0 },
  { name: "Leg Press - Low Stance", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 1, hams: 0, glutes: 0.5, calves: 0, abs: 0 },
  { name: "Seated Leg Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 1, glutes: 0, calves: 0.5, abs: 0 },
  { name: "Machine Sissy Squat", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 1, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Machine Hip Thrust", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 1, calves: 0, abs: 0 },
  { name: "Machine Hip Adduction", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Straight Leg Calf Raise", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 1, abs: 0 },
  { name: "Smith JM Press", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 1, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Machine Chest Press", chest: 1, frontDelts: 0.5, sideDelts: 0, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Low Incline Cable Fly", chest: 1, frontDelts: 0.5, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "1-Arm Cable Reverse Fly", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 1, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "DB Hammer Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 1, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "1-Arm Facing Away Cable Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 1, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Flat DB Press", chest: 1, frontDelts: 0.5, sideDelts: 0, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Low Incline Smith Press", chest: 1, frontDelts: 0.5, sideDelts: 0, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Lying DB Extension", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 1, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Side Lying DB Lateral Raise", chest: 0, frontDelts: 0, sideDelts: 1, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Overhand Cable Pulldown", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0.5, upperBack: 1, rearDelts: 0.5, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Neutral Seated Cable Row", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 1, upperBack: 0.5, rearDelts: 0.5, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "EZ-Bar Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 1, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Machine Crunch", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 1 },
  { name: "Leg Extension", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 1, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Hack Squat", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 1, hams: 0, glutes: 0.5, calves: 0, abs: 0 },
  { name: "45° Hip Extension", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 1, glutes: 0.5, calves: 0, abs: 0 },
  { name: "Pendulum Squat", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 1, hams: 0, glutes: 0.5, calves: 0, abs: 0 },
  { name: "Machine Dip", chest: 0.5, frontDelts: 0.5, sideDelts: 0, triceps: 1, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Machine Fly", chest: 1, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Machine Reverse Fly", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 1, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "1-Arm DB Preacher Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 1, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "High Incline DB Press", chest: 0, frontDelts: 1, sideDelts: 1, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Cable Pullover", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0.5, lats: 1, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Barbell Row", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0.5, upperBack: 1, rearDelts: 0.5, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "1-Arm Cable Diagonal Pull", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 1, upperBack: 0.5, rearDelts: 0.5, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Chest Supported T-Bar Row", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0.5, upperBack: 1, rearDelts: 0.5, biceps: 0.5, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "High Incline Smith Press", chest: 0, frontDelts: 1, sideDelts: 1, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Machine Shoulder Press", chest: 0, frontDelts: 1, sideDelts: 1, triceps: 0.5, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Flat Cable Fly", chest: 1, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "DB Lateral Raise", chest: 0, frontDelts: 0.5, sideDelts: 1, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0 },
  { name: "Leg Press - Mid Stance", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 1, hams: 0, glutes: 1, calves: 0, abs: 0 },
  { name: "DB Split Squat", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0.5, hams: 0, glutes: 1, calves: 0, abs: 0 },
  { name: "Lying Leg Curl", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0, hams: 1, glutes: 0, calves: 0.5, abs: 0 },
  { name: "Barbell RDL", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0.5, rearDelts: 0, biceps: 0, quads: 0, hams: 1, glutes: 0.5, calves: 0, abs: 0 },
  { name: "Smith Split Squat", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0, lats: 0, upperBack: 0, rearDelts: 0, biceps: 0, quads: 0.5, hams: 0, glutes: 1, calves: 0, abs: 0 },
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Clear existing data first
await conn.execute("DELETE FROM exercise_library");

for (const ex of exercises) {
  await conn.execute(
    `INSERT INTO exercise_library (name, chest, frontDelts, sideDelts, triceps, lats, upperBack, rearDelts, biceps, quads, hams, glutes, calves, abs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ex.name, ex.chest, ex.frontDelts, ex.sideDelts, ex.triceps, ex.lats, ex.upperBack, ex.rearDelts, ex.biceps, ex.quads, ex.hams, ex.glutes, ex.calves, ex.abs]
  );
}

console.log(`Seeded ${exercises.length} exercises.`);
await conn.end();
