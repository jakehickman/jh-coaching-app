#!/usr/bin/env python3
"""
Cleanup:
1. Remove apple varieties (Pink Lady, Granny Smith) — keep only "Apple, raw"
2. Replace all yoghurt entries with 4 clean generic entries:
   - Yoghurt, plain (full fat)     — from AFCD "Yoghurt, natural"
   - Yoghurt, plain (low fat)      — derived (AFCD low fat natural data)
   - Yoghurt, Greek style (full fat) — USDA FDC 171304 data
   - Yoghurt, Greek style (low fat)  — USDA FDC 171305 / published data

Macro sources:
  Greek full fat: USDA FDC 171304 — 97 kcal, 9g pro, 5g fat, 4g carb, 0g fibre per 100g
  Greek low fat:  USDA FDC 171305 — 73 kcal, 10.2g pro, 1.9g fat, 6.0g carb, 0g fibre per 100g
  Plain full fat: AFCD "Yoghurt, natural" — 73 kcal, 5.1g pro, 3.2g fat, 5.0g carb, 0.1g fibre
  Plain low fat:  AFCD "Yoghurt, flavoured, low fat" base adjusted — 56 kcal, 5.5g pro, 0.8g fat, 6.5g carb, 0.1g fibre
                  (using USDA FDC 171284 plain low fat: 63 kcal, 1.55g fat, 7.04g carb, 5.74g pro)
"""

import mysql.connector

DB_PARAMS = {
    'user': '3K2x4Mgy2RpvvVT.root',
    'password': 'Ta3euAH93De7dGlu54yl',
    'host': 'gateway05.us-east-1.prod.aws.tidbcloud.com',
    'port': 4000,
    'database': 'HZf6zqYa94nKHY3YxXLHa5',
    'ssl_disabled': False,
}

# New yoghurt entries to insert
# (name, calories, protein, fat, carbs, fiber, servingUnit, servingGrams)
NEW_YOGHURTS = [
    ('Yoghurt, plain (full fat)',      73.0,  5.1,  3.2,  5.0, 0.1, None, None),
    ('Yoghurt, plain (low fat)',       63.0,  5.7,  1.6,  7.0, 0.1, None, None),
    ('Yoghurt, Greek style (full fat)', 97.0,  9.0,  5.0,  4.0, 0.0, None, None),
    ('Yoghurt, Greek style (low fat)',  73.0, 10.2,  1.9,  6.0, 0.0, None, None),
]

# Serving sizes for yoghurt
# (food_name, label, grams)
YOGHURT_SERVINGS = [
    ('Yoghurt, plain (full fat)',       '1 tub (170g)', 170),
    ('Yoghurt, plain (full fat)',       '½ cup (125g)', 125),
    ('Yoghurt, plain (low fat)',        '1 tub (170g)', 170),
    ('Yoghurt, plain (low fat)',        '½ cup (125g)', 125),
    ('Yoghurt, Greek style (full fat)', '1 tub (170g)', 170),
    ('Yoghurt, Greek style (full fat)', '½ cup (125g)', 125),
    ('Yoghurt, Greek style (low fat)',  '1 tub (170g)', 170),
    ('Yoghurt, Greek style (low fat)',  '½ cup (125g)', 125),
]

def main():
    print("Connecting to database...")
    conn = mysql.connector.connect(**DB_PARAMS)
    cursor = conn.cursor()

    # ── 1. Remove apple varieties ──────────────────────────────────────────
    cursor.execute(
        "SELECT id FROM nutrition_foods WHERE name IN ('Apple, pink lady, raw', 'Apple, granny smith, raw')"
    )
    apple_ids = [r[0] for r in cursor.fetchall()]
    if apple_ids:
        placeholders = ','.join(['%s'] * len(apple_ids))
        cursor.execute(f"DELETE FROM food_servings WHERE foodId IN ({placeholders})", apple_ids)
        cursor.execute(f"DELETE FROM nutrition_foods WHERE id IN ({placeholders})", apple_ids)
        conn.commit()
        print(f"Removed {len(apple_ids)} apple variety entries.")
    else:
        print("No apple variety entries found (already removed).")

    # ── 2. Remove all existing yoghurt entries ─────────────────────────────
    cursor.execute(
        "SELECT id FROM nutrition_foods WHERE name LIKE '%oghurt%' OR name LIKE '%ogurt%'"
    )
    yoghurt_ids = [r[0] for r in cursor.fetchall()]
    if yoghurt_ids:
        placeholders = ','.join(['%s'] * len(yoghurt_ids))
        cursor.execute(f"DELETE FROM food_servings WHERE foodId IN ({placeholders})", yoghurt_ids)
        cursor.execute(f"DELETE FROM nutrition_foods WHERE id IN ({placeholders})", yoghurt_ids)
        conn.commit()
        print(f"Removed {len(yoghurt_ids)} existing yoghurt entries.")

    # ── 3. Insert 4 new yoghurt entries ───────────────────────────────────
    for name, cal, pro, fat, carb, fib, sunit, sgrams in NEW_YOGHURTS:
        cursor.execute(
            """INSERT INTO nutrition_foods (name, calories, protein, fat, carbs, fiber, servingUnit, servingGrams)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (name, cal, pro, fat, carb, fib, sunit, sgrams)
        )
    conn.commit()
    print(f"Inserted {len(NEW_YOGHURTS)} new yoghurt entries.")

    # ── 4. Insert serving sizes for new yoghurt entries ───────────────────
    # Get the new IDs
    cursor.execute(
        "SELECT id, name FROM nutrition_foods WHERE name LIKE '%oghurt%' OR name LIKE '%ogurt%'"
    )
    name_to_id = {row[1]: row[0] for row in cursor.fetchall()}

    # Insert 100g serving for each
    for name, food_id in name_to_id.items():
        cursor.execute(
            "INSERT INTO food_servings (foodId, label, grams) VALUES (%s, %s, %s)",
            (food_id, '100g', 100)
        )

    # Insert named servings
    for food_name, label, grams in YOGHURT_SERVINGS:
        food_id = name_to_id.get(food_name)
        if food_id:
            cursor.execute(
                "INSERT INTO food_servings (foodId, label, grams) VALUES (%s, %s, %s)",
                (food_id, label, grams)
            )
        else:
            print(f"  WARNING: food not found: {food_name}")

    conn.commit()
    print(f"Inserted serving sizes for yoghurt entries.")

    # ── 5. Verify ─────────────────────────────────────────────────────────
    cursor.execute("SELECT COUNT(*) FROM nutrition_foods")
    total = cursor.fetchone()[0]

    cursor.execute(
        "SELECT name, calories, protein, fat, carbs FROM nutrition_foods WHERE name LIKE '%oghurt%' OR name LIKE '%ogurt%' ORDER BY name"
    )
    print(f"\nFinal yoghurt entries:")
    print(f"{'Name':<40} {'Cal':>5} {'Pro':>5} {'Fat':>5} {'Carb':>5}")
    print("-" * 60)
    for r in cursor.fetchall():
        print(f"{r[0]:<40} {r[1]:>5.1f} {r[2]:>5.1f} {r[3]:>5.1f} {r[4]:>5.1f}")

    cursor.execute(
        "SELECT name FROM nutrition_foods WHERE name LIKE '%pple%' ORDER BY name"
    )
    print(f"\nApple entries remaining:")
    for r in cursor.fetchall():
        print(f"  {r[0]}")

    print(f"\nTotal foods: {total}")

    cursor.close()
    conn.close()
    print("\nDone!")

if __name__ == '__main__':
    main()
