/**
 * Seed nutrition_foods from USDA FoodData Central (SR Legacy + Foundation)
 * Uses the public DEMO_KEY — rate limited to 30 req/hr per IP.
 * Run: node scripts/seed-usda-foods.mjs
 */
import mysql from 'mysql2/promise';

const API_KEY = 'DEMO_KEY';
const BASE = 'https://api.nal.usda.gov/fdc/v1';

// Nutrient IDs in USDA FoodData Central
const NUTRIENT_IDS = {
  calories: [1008],           // Energy (kcal)
  protein:  [1003],           // Protein
  fat:      [1004],           // Total lipid (fat)
  carbs:    [1005],           // Carbohydrate, by difference
  fiber:    [1079],           // Fiber, total dietary
};

// Categories to fetch — broad coverage of common whole foods
const SEARCH_QUERIES = [
  // Proteins
  'chicken breast raw', 'chicken thigh raw', 'turkey breast raw', 'ground turkey raw',
  'beef sirloin raw', 'ground beef 90 lean raw', 'beef tenderloin raw',
  'pork tenderloin raw', 'pork loin raw', 'bacon cooked',
  'salmon raw', 'tuna canned water', 'cod raw', 'tilapia raw', 'shrimp raw',
  'egg whole raw', 'egg white raw', 'egg yolk raw',
  'tofu firm', 'tempeh', 'edamame',
  // Dairy
  'greek yogurt plain nonfat', 'cottage cheese lowfat', 'milk whole',
  'milk skim', 'cheddar cheese', 'mozzarella cheese', 'parmesan cheese',
  'whey protein powder', 'casein protein powder',
  // Grains & Starches
  'white rice cooked', 'brown rice cooked', 'oats rolled dry',
  'bread whole wheat', 'bread white', 'pasta cooked', 'quinoa cooked',
  'sweet potato cooked', 'potato baked', 'corn cooked',
  'tortilla corn', 'tortilla flour', 'rice cakes',
  // Vegetables
  'broccoli raw', 'spinach raw', 'kale raw', 'lettuce romaine raw',
  'tomato raw', 'cucumber raw', 'bell pepper raw', 'onion raw',
  'carrot raw', 'celery raw', 'mushroom raw', 'zucchini raw',
  'asparagus raw', 'green beans raw', 'cauliflower raw', 'cabbage raw',
  // Fruits
  'banana raw', 'apple raw', 'orange raw', 'strawberries raw',
  'blueberries raw', 'grapes raw', 'watermelon raw', 'mango raw',
  'pineapple raw', 'avocado raw', 'peach raw', 'pear raw',
  // Legumes
  'black beans cooked', 'chickpeas cooked', 'lentils cooked',
  'kidney beans cooked', 'pinto beans cooked',
  // Nuts & Seeds
  'almonds', 'walnuts', 'cashews', 'peanuts', 'peanut butter',
  'almond butter', 'chia seeds', 'flaxseeds', 'sunflower seeds',
  'pumpkin seeds',
  // Fats & Oils
  'olive oil', 'coconut oil', 'butter unsalted', 'avocado oil',
  // Condiments & Misc
  'honey', 'maple syrup', 'soy sauce', 'ketchup', 'mustard',
  'mayonnaise', 'salsa', 'hummus',
  // Processed / Packaged
  'protein bar', 'granola', 'dark chocolate',
];

function getNutrientValue(nutrients, ids) {
  for (const id of ids) {
    const n = nutrients.find(n => n.nutrientId === id || n.nutrientNumber === String(id));
    if (n && n.value != null) return parseFloat(n.value.toFixed(2));
  }
  return 0;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchFoods(query) {
  const url = `${BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=3&dataType=SR%20Legacy,Foundation&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  HTTP ${res.status} for "${query}"`);
    return [];
  }
  const data = await res.json();
  return data.foods || [];
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get existing names to avoid duplicates
  const [existing] = await conn.execute('SELECT name FROM nutrition_foods');
  const existingNames = new Set(existing.map(r => r.name.toLowerCase()));
  
  let inserted = 0;
  let skipped = 0;

  for (const query of SEARCH_QUERIES) {
    console.log(`Fetching: "${query}"...`);
    try {
      const foods = await fetchFoods(query);
      
      for (const food of foods) {
        const name = food.description
          .replace(/,\s*raw$/i, ' (raw)')
          .replace(/,\s*cooked$/i, ' (cooked)')
          .replace(/,\s*dry$/i, ' (dry)')
          .trim();
        
        // Skip if already exists (case-insensitive)
        if (existingNames.has(name.toLowerCase())) {
          skipped++;
          continue;
        }

        const nutrients = food.foodNutrients || [];
        const calories = getNutrientValue(nutrients, NUTRIENT_IDS.calories);
        const protein  = getNutrientValue(nutrients, NUTRIENT_IDS.protein);
        const fat      = getNutrientValue(nutrients, NUTRIENT_IDS.fat);
        const carbs    = getNutrientValue(nutrients, NUTRIENT_IDS.carbs);
        const fiber    = getNutrientValue(nutrients, NUTRIENT_IDS.fiber);

        // Skip if no meaningful data
        if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
          skipped++;
          continue;
        }

        await conn.execute(
          'INSERT INTO nutrition_foods (name, calories, protein, carbs, fiber, fat) VALUES (?, ?, ?, ?, ?, ?)',
          [name, calories, protein, carbs, fiber, fat]
        );
        existingNames.add(name.toLowerCase());
        inserted++;
        console.log(`  + ${name} | cal:${calories} p:${protein} c:${carbs} f:${fat}`);
      }
    } catch (err) {
      console.warn(`  Error for "${query}":`, err.message);
    }
    
    // Rate limit: DEMO_KEY allows ~30 req/hr — wait 2.5s between requests
    await sleep(2500);
  }

  await conn.end();
  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
