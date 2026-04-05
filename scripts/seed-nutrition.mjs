import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// All values are per 100g, sourced from USDA FoodData Central (SR Legacy / Foundation Foods)
// calories (kcal), protein (g), carbs (g), fiber (g), fat (g)
// servingUnit: label for 1 serving (e.g. "egg", "slice") — null = per 100g only
// servingGrams: grams per 1 serving unit
const foods = [
  // ── Proteins ──────────────────────────────────────────────────────────────
  { name: "Egg Whites",                    calories: 52,   protein: 10.9, carbs: 0.7,  fiber: 0,    fat: 0.2,  servingUnit: null,    servingGrams: null  },
  { name: "Chicken Breast",               calories: 165,  protein: 31.0, carbs: 0,    fiber: 0,    fat: 3.6,  servingUnit: null,    servingGrams: null  },
  { name: "Greek Yogurt",                  calories: 59,   protein: 10.2, carbs: 3.6,  fiber: 0,    fat: 0.4,  servingUnit: null,    servingGrams: null  },
  { name: "95/5 Ground Beef",              calories: 152,  protein: 21.4, carbs: 0,    fiber: 0,    fat: 7.0,  servingUnit: null,    servingGrams: null  },
  { name: "Wild Atlantic Salmon",          calories: 142,  protein: 19.8, carbs: 0,    fiber: 0,    fat: 6.3,  servingUnit: null,    servingGrams: null  },
  { name: "Eggs",                          calories: 143,  protein: 12.6, carbs: 0.7,  fiber: 0,    fat: 9.5,  servingUnit: "egg",   servingGrams: 50    }, // 1 large egg ≈ 50g
  { name: "Whey Protein Powder",           calories: 352,  protein: 75.0, carbs: 8.0,  fiber: 0,    fat: 3.5,  servingUnit: "scoop", servingGrams: 30    }, // typical 30g scoop
  { name: "Casein Protein Powder",         calories: 370,  protein: 80.0, carbs: 5.0,  fiber: 0,    fat: 2.0,  servingUnit: "scoop", servingGrams: 30    },
  { name: "90/10 Ground Beef",             calories: 176,  protein: 20.0, carbs: 0,    fiber: 0,    fat: 10.0, servingUnit: null,    servingGrams: null  },
  { name: "Skinless Chicken Thigh",        calories: 177,  protein: 24.0, carbs: 0,    fiber: 0,    fat: 8.7,  servingUnit: null,    servingGrams: null  },
  { name: "Canned Tuna",                   calories: 116,  protein: 25.5, carbs: 0,    fiber: 0,    fat: 0.8,  servingUnit: "can",   servingGrams: 140   }, // typical 140g drained can
  { name: "Cheddar Cheese",               calories: 403,  protein: 24.9, carbs: 1.3,  fiber: 0,    fat: 33.1, servingUnit: "slice", servingGrams: 28    }, // 1 slice ≈ 28g
  { name: "Bone Broth",                    calories: 14,   protein: 2.7,  carbs: 0.4,  fiber: 0,    fat: 0.3,  servingUnit: "cup",   servingGrams: 240   },

  // ── Carbohydrates ─────────────────────────────────────────────────────────
  { name: "Potatoes",                      calories: 77,   protein: 2.0,  carbs: 17.5, fiber: 2.1,  fat: 0.1,  servingUnit: null,    servingGrams: null  },
  { name: "Oats",                          calories: 389,  protein: 16.9, carbs: 66.3, fiber: 10.6, fat: 6.9,  servingUnit: null,    servingGrams: null  },
  { name: "Apple",                         calories: 52,   protein: 0.3,  carbs: 13.8, fiber: 2.4,  fat: 0.2,  servingUnit: "apple", servingGrams: 182   }, // 1 medium apple ≈ 182g
  { name: "Banana",                        calories: 89,   protein: 1.1,  carbs: 22.8, fiber: 2.6,  fat: 0.3,  servingUnit: "banana",servingGrams: 118   }, // 1 medium banana ≈ 118g
  { name: "White Rice",                    calories: 365,  protein: 7.1,  carbs: 80.0, fiber: 1.3,  fat: 0.7,  servingUnit: null,    servingGrams: null  },
  { name: "Honey",                         calories: 304,  protein: 0.3,  carbs: 82.4, fiber: 0.2,  fat: 0,    servingUnit: "tbsp",  servingGrams: 21    }, // 1 tbsp ≈ 21g
  { name: "Granola",                       calories: 471,  protein: 10.1, carbs: 64.0, fiber: 5.3,  fat: 20.0, servingUnit: null,    servingGrams: null  },
  { name: "Sourdough Bread",               calories: 274,  protein: 9.0,  carbs: 52.0, fiber: 2.4,  fat: 2.5,  servingUnit: "slice", servingGrams: 45    }, // 1 slice ≈ 45g
  { name: "Tortilla",                      calories: 312,  protein: 8.0,  carbs: 54.0, fiber: 3.5,  fat: 7.3,  servingUnit: "tortilla", servingGrams: 45 }, // 1 medium flour tortilla ≈ 45g
  { name: "Rice Cakes",                    calories: 387,  protein: 8.2,  carbs: 81.5, fiber: 1.5,  fat: 2.8,  servingUnit: "cake",  servingGrams: 9     }, // 1 rice cake ≈ 9g
  { name: "Raspberries",                   calories: 52,   protein: 1.2,  carbs: 11.9, fiber: 6.5,  fat: 0.7,  servingUnit: null,    servingGrams: null  },
  { name: "Mixed Berries",                 calories: 57,   protein: 0.7,  carbs: 14.0, fiber: 2.0,  fat: 0.3,  servingUnit: null,    servingGrams: null  },
  { name: "Orange",                        calories: 47,   protein: 0.9,  carbs: 11.8, fiber: 2.4,  fat: 0.1,  servingUnit: "orange",servingGrams: 131   }, // 1 medium orange ≈ 131g

  // ── Fats ──────────────────────────────────────────────────────────────────
  { name: "Avocado",                       calories: 160,  protein: 2.0,  carbs: 8.5,  fiber: 6.7,  fat: 14.7, servingUnit: null,    servingGrams: null  },
  { name: "Green Olives",                  calories: 145,  protein: 1.0,  carbs: 3.8,  fiber: 3.3,  fat: 15.3, servingUnit: "olive", servingGrams: 4     }, // 1 olive ≈ 4g
  { name: "Almonds",                       calories: 579,  protein: 21.2, carbs: 21.6, fiber: 12.5, fat: 49.9, servingUnit: null,    servingGrams: null  },
  { name: "Olive Oil",                     calories: 884,  protein: 0,    carbs: 0,    fiber: 0,    fat: 100.0,servingUnit: "tbsp",  servingGrams: 14    }, // 1 tbsp ≈ 14g
  { name: "Peanut Butter",                 calories: 588,  protein: 25.1, carbs: 20.1, fiber: 5.7,  fat: 50.4, servingUnit: "tbsp",  servingGrams: 16    }, // 1 tbsp ≈ 16g
  { name: "Chia Seeds",                    calories: 486,  protein: 16.5, carbs: 42.1, fiber: 34.4, fat: 30.7, servingUnit: "tbsp",  servingGrams: 12    }, // 1 tbsp ≈ 12g
  { name: "70-85% Dark Chocolate",         calories: 598,  protein: 7.8,  carbs: 45.9, fiber: 10.9, fat: 42.6, servingUnit: "square",servingGrams: 10    }, // 1 square ≈ 10g
  { name: "Sesame Oil",                    calories: 884,  protein: 0,    carbs: 0,    fiber: 0,    fat: 100.0,servingUnit: "tbsp",  servingGrams: 14    },

  // ── Vegetables ────────────────────────────────────────────────────────────
  { name: "Spinach",                       calories: 23,   protein: 2.9,  carbs: 3.6,  fiber: 2.2,  fat: 0.4,  servingUnit: null,    servingGrams: null  },
  { name: "Carrots",                       calories: 41,   protein: 0.9,  carbs: 9.6,  fiber: 2.8,  fat: 0.2,  servingUnit: null,    servingGrams: null  },
  { name: "Broccoli",                      calories: 34,   protein: 2.8,  carbs: 6.6,  fiber: 2.6,  fat: 0.4,  servingUnit: null,    servingGrams: null  },
  { name: "Zucchini",                      calories: 17,   protein: 1.2,  carbs: 3.1,  fiber: 1.0,  fat: 0.3,  servingUnit: null,    servingGrams: null  },
  { name: "Bell Pepper",                   calories: 31,   protein: 1.0,  carbs: 6.0,  fiber: 2.1,  fat: 0.3,  servingUnit: null,    servingGrams: null  },
  { name: "Onion",                         calories: 40,   protein: 1.1,  carbs: 9.3,  fiber: 1.7,  fat: 0.1,  servingUnit: null,    servingGrams: null  },
  { name: "Green Beans",                   calories: 31,   protein: 1.8,  carbs: 7.0,  fiber: 2.7,  fat: 0.2,  servingUnit: null,    servingGrams: null  },
  { name: "Baby Carrot",                   calories: 35,   protein: 0.6,  carbs: 8.2,  fiber: 2.9,  fat: 0.1,  servingUnit: null,    servingGrams: null  },
  { name: "Kimchi",                        calories: 15,   protein: 1.1,  carbs: 2.4,  fiber: 1.6,  fat: 0.5,  servingUnit: null,    servingGrams: null  },
  { name: "Dried Shiitake Mushrooms",      calories: 296,  protein: 9.6,  carbs: 75.4, fiber: 11.5, fat: 1.0,  servingUnit: null,    servingGrams: null  },

  // ── Supplements / Other ───────────────────────────────────────────────────
  { name: "Essential Amino Acids",         calories: 272,  protein: 68.0, carbs: 0,    fiber: 0,    fat: 0,    servingUnit: "scoop", servingGrams: 10    }, // typical 10g EAA scoop
  { name: "Highly Branched Cyclic Dextrin",calories: 380,  protein: 0,    carbs: 95.0, fiber: 0,    fat: 0,    servingUnit: "scoop", servingGrams: 25    }, // typical 25g HBCD scoop
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Clear existing data
await conn.execute("DELETE FROM nutrition_foods");

for (const food of foods) {
  await conn.execute(
    `INSERT INTO nutrition_foods (name, calories, protein, carbs, fiber, fat, servingUnit, servingGrams)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [food.name, food.calories, food.protein, food.carbs, food.fiber, food.fat, food.servingUnit, food.servingGrams]
  );
}

console.log(`Seeded ${foods.length} foods into nutrition_foods.`);
await conn.end();
