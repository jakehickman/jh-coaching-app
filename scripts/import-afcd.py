#!/usr/bin/env python3
"""
AFCD Release 3 Import Script
Reads nutrient_profiles.xlsx and imports 1,588 Australian foods into nutrition_foods table.

Column mapping (0-indexed, row 3 = headers, data from row 4):
  Col 0: Public Food Key
  Col 1: Classification (numeric code)
  Col 3: Food Name
  Col 4: Energy with dietary fibre (kJ) -> divide by 4.184 for kcal
  Col 7: Protein (g per 100g)
  Col 9: Fat, total (g per 100g)
  Col 11: Total dietary fibre (g per 100g)
  Col 19: Total sugars (g per 100g)
  Col 22: Starch (g per 100g)

Total carbs = starch + sugars (+ fibre if using available carbs approach)
Note: AFCD uses "available carbohydrates" = starch + sugars (not including fibre)
"""

import openpyxl
import mysql.connector
import re
import sys
import os

# Database connection from env
DB_URL = "mysql://3K2x4Mgy2RpvvVT.root:Ta3euAH93De7dGlu54yl@gateway05.us-east-1.prod.aws.tidbcloud.com:4000/HZf6zqYa94nKHY3YxXLHa5?ssl={\"rejectUnauthorized\":true}"

def parse_db_url(url):
    """Parse MySQL URL into connection params."""
    # mysql://user:pass@host:port/dbname?ssl=...
    match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', url)
    if not match:
        raise ValueError(f"Cannot parse DB URL: {url}")
    user, password, host, port, database = match.groups()
    return {
        'user': user,
        'password': password,
        'host': host,
        'port': int(port),
        'database': database,
        'ssl_disabled': False,
    }

def safe_float(val, default=0.0):
    """Convert value to float, returning default if None or invalid."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def main():
    print("Loading AFCD nutrient profiles...")
    wb = openpyxl.load_workbook('/home/ubuntu/afcd/nutrient_profiles.xlsx', read_only=True)
    ws = wb['All solids & liquids per 100 g']

    foods = []
    skipped = 0

    for row in ws.iter_rows(min_row=4, values_only=True):
        food_key = row[0]
        if not food_key:
            continue

        food_name = row[3]
        if not food_name:
            skipped += 1
            continue

        # Energy: kJ -> kcal
        energy_kj = safe_float(row[4])
        calories = round(energy_kj / 4.184, 1)

        protein = round(safe_float(row[7]), 1)
        fat = round(safe_float(row[9]), 1)
        fiber = round(safe_float(row[11]), 1)
        sugars = safe_float(row[19])
        starch = safe_float(row[22])
        carbs = round(sugars + starch, 1)

        foods.append({
            'name': str(food_name).strip(),
            'calories': calories,
            'protein': protein,
            'carbs': carbs,
            'fiber': fiber,
            'fat': fat,
        })

    wb.close()
    print(f"Loaded {len(foods)} foods ({skipped} skipped due to missing name)")

    # Connect to database
    print("Connecting to database...")
    params = parse_db_url(DB_URL)
    conn = mysql.connector.connect(**params)
    cursor = conn.cursor()

    # Clear existing data
    print("Clearing existing nutrition_foods data...")
    cursor.execute("DELETE FROM food_servings")
    cursor.execute("DELETE FROM nutrition_foods")
    conn.commit()
    print("Cleared food_servings and nutrition_foods tables.")

    # Insert AFCD foods
    print(f"Inserting {len(foods)} AFCD foods...")
    insert_sql = """
        INSERT INTO nutrition_foods (name, calories, protein, carbs, fiber, fat)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    batch = []
    for f in foods:
        batch.append((
            f['name'],
            f['calories'],
            f['protein'],
            f['carbs'],
            f['fiber'],
            f['fat'],
        ))

    cursor.executemany(insert_sql, batch)
    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM nutrition_foods")
    count = cursor.fetchone()[0]
    print(f"Inserted {count} foods into nutrition_foods.")

    # Show sample
    cursor.execute("SELECT id, name, calories, protein, carbs, fiber, fat FROM nutrition_foods LIMIT 10")
    rows = cursor.fetchall()
    print("\nSample foods:")
    for r in rows:
        print(f"  [{r[0]}] {r[1][:50]:<50} | cal={r[2]:.0f} | P={r[3]:.1f}g | C={r[4]:.1f}g | F={r[5]:.1f}g | fat={r[6]:.1f}g")

    cursor.close()
    conn.close()
    print("\nImport complete!")

if __name__ == '__main__':
    main()
