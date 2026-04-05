import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// All values are per 100g, sourced from USDA FoodData Central (SR Legacy / Foundation Foods)
// calories (kcal), protein (g), carbs (g), fiber (g), fat (g)
const foods = [
  // ── Proteins ──────────────────────────────────────────────────────────────
  { name: "Egg Whites",                    calories: 52,   protein: 10.9, carbs: 0.7,  fiber: 0,   fat: 0.2  }, // USDA #45339346 liquid egg whites
  { name: "Chicken Breast",               calories: 165,  protein: 31.0, carbs: 0,    fiber: 0,   fat: 3.6  }, // USDA #171477 raw skinless boneless
  { name: "Greek Yogurt",                  calories: 59,   protein: 10.2, carbs: 3.6,  fiber: 0,   fat: 0.4  }, // USDA #170903 plain nonfat
  { name: "95/5 Ground Beef",              calories: 152,  protein: 21.4, carbs: 0,    fiber: 0,   fat: 7.0  }, // USDA #174036 raw 95% lean
  { name: "Wild Atlantic Salmon",          calories: 142,  protein: 19.8, carbs: 0,    fiber: 0,   fat: 6.3  }, // USDA #175167 raw
  { name: "Eggs",                          calories: 143,  protein: 12.6, carbs: 0.7,  fiber: 0,   fat: 9.5  }, // USDA #748967 whole raw
  { name: "Whey Protein Powder",           calories: 352,  protein: 75.0, carbs: 8.0,  fiber: 0,   fat: 3.5  }, // typical unflavored whey isolate
  { name: "Casein Protein Powder",         calories: 370,  protein: 80.0, carbs: 5.0,  fiber: 0,   fat: 2.0  }, // typical micellar casein
  { name: "90/10 Ground Beef",             calories: 176,  protein: 20.0, carbs: 0,    fiber: 0,   fat: 10.0 }, // USDA #174035 raw 90% lean
  { name: "Skinless Chicken Thigh",        calories: 177,  protein: 24.0, carbs: 0,    fiber: 0,   fat: 8.7  }, // USDA #171478 raw boneless skinless
  { name: "Canned Tuna",                   calories: 116,  protein: 25.5, carbs: 0,    fiber: 0,   fat: 0.8  }, // USDA #172003 in water drained
  { name: "Cheddar Cheese",               calories: 403,  protein: 24.9, carbs: 1.3,  fiber: 0,   fat: 33.1 }, // USDA #173414
  { name: "Bone Broth",                    calories: 14,   protein: 2.7,  carbs: 0.4,  fiber: 0,   fat: 0.3  }, // USDA #2103689 chicken bone broth

  // ── Carbohydrates ─────────────────────────────────────────────────────────
  { name: "Potatoes",                      calories: 77,   protein: 2.0,  carbs: 17.5, fiber: 2.1, fat: 0.1  }, // USDA #170026 raw flesh
  { name: "Oats",                          calories: 389,  protein: 16.9, carbs: 66.3, fiber: 10.6,fat: 6.9  }, // USDA #173904 dry rolled oats
  { name: "Apple",                         calories: 52,   protein: 0.3,  carbs: 13.8, fiber: 2.4, fat: 0.2  }, // USDA #171688 raw with skin
  { name: "Banana",                        calories: 89,   protein: 1.1,  carbs: 22.8, fiber: 2.6, fat: 0.3  }, // USDA #173944 raw
  { name: "White Rice",                    calories: 365,  protein: 7.1,  carbs: 80.0, fiber: 1.3, fat: 0.7  }, // USDA #169756 dry long grain
  { name: "Honey",                         calories: 304,  protein: 0.3,  carbs: 82.4, fiber: 0.2, fat: 0    }, // USDA #169640
  { name: "Granola",                       calories: 471,  protein: 10.1, carbs: 64.0, fiber: 5.3, fat: 20.0 }, // USDA #169761 plain
  { name: "Sourdough Bread",               calories: 274,  protein: 9.0,  carbs: 52.0, fiber: 2.4, fat: 2.5  }, // USDA #172686
  { name: "Tortilla",                      calories: 312,  protein: 8.0,  carbs: 54.0, fiber: 3.5, fat: 7.3  }, // USDA #175036 flour tortilla
  { name: "Rice Cakes",                    calories: 387,  protein: 8.2,  carbs: 81.5, fiber: 1.5, fat: 2.8  }, // USDA #169724 plain
  { name: "Raspberries",                   calories: 52,   protein: 1.2,  carbs: 11.9, fiber: 6.5, fat: 0.7  }, // USDA #167755 raw
  { name: "Mixed Berries",                 calories: 57,   protein: 0.7,  carbs: 14.0, fiber: 2.0, fat: 0.3  }, // approximate blueberry/strawberry/raspberry mix

  // ── Fats ──────────────────────────────────────────────────────────────────
  { name: "Avocado",                       calories: 160,  protein: 2.0,  carbs: 8.5,  fiber: 6.7, fat: 14.7 }, // USDA #171705 raw
  { name: "Green Olives",                  calories: 145,  protein: 1.0,  carbs: 3.8,  fiber: 3.3, fat: 15.3 }, // USDA #169096 canned
  { name: "Almonds",                       calories: 579,  protein: 21.2, carbs: 21.6, fiber: 12.5,fat: 49.9 }, // USDA #170567 raw
  { name: "Olive Oil",                     calories: 884,  protein: 0,    carbs: 0,    fiber: 0,   fat: 100.0}, // USDA #171413
  { name: "Peanut Butter",                 calories: 588,  protein: 25.1, carbs: 20.1, fiber: 5.7, fat: 50.4 }, // USDA #172470 smooth no salt
  { name: "Chia Seeds",                    calories: 486,  protein: 16.5, carbs: 42.1, fiber: 34.4,fat: 30.7 }, // USDA #170554
  { name: "70-85% Dark Chocolate",         calories: 598,  protein: 7.8,  carbs: 45.9, fiber: 10.9,fat: 42.6 }, // USDA #170273 70-85% cacao
  { name: "Sesame Oil",                    calories: 884,  protein: 0,    carbs: 0,    fiber: 0,   fat: 100.0}, // USDA #172338

  // ── Vegetables ────────────────────────────────────────────────────────────
  { name: "Spinach",                       calories: 23,   protein: 2.9,  carbs: 3.6,  fiber: 2.2, fat: 0.4  }, // USDA #168462 raw
  { name: "Carrots",                       calories: 41,   protein: 0.9,  carbs: 9.6,  fiber: 2.8, fat: 0.2  }, // USDA #170393 raw
  { name: "Broccoli",                      calories: 34,   protein: 2.8,  carbs: 6.6,  fiber: 2.6, fat: 0.4  }, // USDA #170379 raw
  { name: "Zucchini",                      calories: 17,   protein: 1.2,  carbs: 3.1,  fiber: 1.0, fat: 0.3  }, // USDA #169291 raw
  { name: "Bell Pepper",                   calories: 31,   protein: 1.0,  carbs: 6.0,  fiber: 2.1, fat: 0.3  }, // USDA #170108 raw red
  { name: "Onion",                         calories: 40,   protein: 1.1,  carbs: 9.3,  fiber: 1.7, fat: 0.1  }, // USDA #170000 raw
  { name: "Green Beans",                   calories: 31,   protein: 1.8,  carbs: 7.0,  fiber: 2.7, fat: 0.2  }, // USDA #169961 raw
  { name: "Baby Carrot",                   calories: 35,   protein: 0.6,  carbs: 8.2,  fiber: 2.9, fat: 0.1  }, // USDA #170390 raw mini
  { name: "Kimchi",                        calories: 15,   protein: 1.1,  carbs: 2.4,  fiber: 1.6, fat: 0.5  }, // USDA #169999
  { name: "Dried Shiitake Mushrooms",      calories: 296,  protein: 9.6,  carbs: 75.4, fiber: 11.5,fat: 1.0  }, // USDA #168436

  // ── Supplements / Other ───────────────────────────────────────────────────
  { name: "Essential Amino Acids",         calories: 272,  protein: 68.0, carbs: 0,    fiber: 0,   fat: 0    }, // typical EAA powder (pure amino acids)
  { name: "Highly Branched Cyclic Dextrin",calories: 380,  protein: 0,    carbs: 95.0, fiber: 0,   fat: 0    }, // typical HBCD powder
  { name: "Orange",                        calories: 47,   protein: 0.9,  carbs: 11.8, fiber: 2.4, fat: 0.1  }, // USDA #169097 raw navel
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Clear existing data
await conn.execute("DELETE FROM nutrition_foods");

for (const food of foods) {
  await conn.execute(
    `INSERT INTO nutrition_foods (name, calories, protein, carbs, fiber, fat)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [food.name, food.calories, food.protein, food.carbs, food.fiber, food.fat]
  );
}

console.log(`Seeded ${foods.length} foods into nutrition_foods.`);
await conn.end();
