#!/usr/bin/env python3
"""
AFCD Food Database Cleanup - Pass 2

Removes remaining unwanted entries and renames/consolidates foods
that slipped through the first cleanup pass.
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

# ─────────────────────────────────────────────────────────────────────────────
# Patterns to REMOVE (substring match on name, case-insensitive)
# ─────────────────────────────────────────────────────────────────────────────
REMOVE_PATTERNS = [
    # Branded cereals
    "kellogg's", "sanitarium", "uncle toby", "be natural",
    # Sweet biscuits (not useful for coaching)
    "biscuit, sweet",
    # Cakes & slices
    "cake,", "cake mix", "slice,", "lamington",
    # Sweet buns & pastries
    "bun, sweet", "hot cross bun", "scone,", "pastry,",
    # Sausage rolls, spring rolls, pies
    "sausage roll", "spring roll", "pie, savoury",
    # Instant soups
    "soup,",
    # Instant noodles
    "noodle, wheat, instant",
    # Buffalo (exotic)
    "buffalo,",
    # Boiled/cooked duplicates for vegetables where we have raw
    # (keep raw + one cooked method; remove extra cooked variants)
    # Specific entries to remove by pattern
    "boiled, drained",  # removes all boiled veg duplicates
    "stir-fried, no added fat",  # removes stir-fried veg duplicates
    "baked, no added fat",  # removes baked veg duplicates
    "fried, no added fat",  # removes fried veg duplicates
    "steamed, no added fat",  # removes steamed veg duplicates
    "microwaved",  # removes microwaved veg duplicates
    "cassava",
    "taro,",
    "kohlrabi",
    "parsnip",
    "okra",
    "seaweed, boiled",
    "sprat,",
    "shark, battered",
    "shark, fillet",  # we already have shark (gummy) fillet, raw from pass 1 cleanup
    "silver perch, aquacultured",  # already have silver perch fillet, raw
    "snack, grain based",
    "snack ball",
    "spread, hazelnut",  # nutella-type
    "spaghetti in tomato",
    "spam,",
    "squash, button, fresh, boiled",
    "squash, scallopini, fresh, boiled",
    "squash, scallopini, fresh, raw",
    "soft drink, cola flavour, decaffeinated",
    "soft drink, cola flavour, intense sweetened",
    "soft drink, dry ginger ale",
    "soft drink, energy drink",
    "soft drink, tonic water",
    "soft drink, fruit flavours, intense",
    "stock, dry powder",
    "stock, liquid, all flavours",
    "taco seasoning mix",
    "tamarillo",
    "tamarind",
    "syrup, malt",
    "syrup, rice malt",
    "sauce, pasta,",
    "sauce, plum",
    "sauce, rogan josh",
    "sauce, salsa",
    "sauce, simmer",
    "sauce, white, savoury",
    "sauce, butter chicken",  # already removed in pass 1
    "sauce, simmer for chicken",
    "sauce, hoisin",
    "nut, peanut, with skin, roasted, with oil",
    "nut, peanut, without skin, roasted, with oil",
    "oil, blend of",
    "fat, solid, vegetable",
    "dairy blend, butter",
    "pumpkin, golden nugget",
    "pumpkin, jarrahdale",
    "pumpkin, kent/jap",
    "pumpkin, peeled, fresh, boiled",
    "pumpkin, queensland blue, peeled, fresh, boiled",
    "pumpkin, butternut, peeled, fresh, boiled",
    "mixed vegetables, purchased frozen",
    "cornmeal (polenta)",
    "millet,",
    "spelt, boiled",
    "spelt, uncooked",
    "semolina, boiled",
    "buckwheat groats, cooked",
    "bulgur, soaked",
    "noodle, soba, boiled",
    "noodle, rice stick",
    "cabbage, chinese flowering",
    "cabbage, chinese, boiled",
    "cabbage, mustard",
    "cabbage, red, boiled",
    "cabbage, savoy, boiled",
    "cabbage, white, boiled",
    "bok choy, fried",
    "bok choy, steamed",
    "brussels sprout, fresh, baked",
    "snow pea, fresh, boiled",
    "snow pea, fresh, fried",
    "shallot, peeled, fresh, fried",
    "pea, green, fresh, boiled",
    "pea, green, frozen, boiled",
    "pea, split, dried, boiled",
    "bean, broad, fresh, boiled",
    "bean, butter, fresh, boiled",
    "bean, green, fresh, boiled",
    "bean, green, frozen, boiled",
    "bean, haricot, dried, boiled",
    "bean, red kidney, dried, boiled",
    "bean, red kidney, fresh, boiled",
    "bean, soya (soy), dried, boiled",
    "beetroot, fresh, purple, peeled, boiled",
    "celeriac, peeled, boiled",
    "chicory, boiled",
    "choko, peeled, fresh, boiled",
    "fennel, fresh, boiled",
    "corn, fresh on cob, boiled",
    "corn, kernels, purchased frozen, boiled",
    "okra, boiled",
    "parsnip, peeled, fresh, boiled",
    "squash, button, fresh, boiled",
    "squash, scallopini, fresh, boiled",
    "sweet potato, raw",  # will re-add via rename below
    "sweetcorn, fresh or frozen on cob",
    "scallop, fried",
    "squid or calamari, fried",
    "sausage, beef, fried",
    "sausage, beef, grilled",
    "sausage, chicken, flavoured, fried",
    "sausage, chicken, plain, fried",
    "sausage, chorizo, fried",
    "sausage, lamb, flavoured, fried",
    "sausage, lamb, plain, fried",
    "sausage, pork, fried",
    "sausage, vegetarian",
    "soft drink, cola flavour, decaffeinated",
    "breakfast cereal, beverage",
    "beverage, flavoured milk",
    "beverage, chocolate",
    "beverage, coffee",
    "soy beverage, reduced fat",
    "soy beverage, regular fat",
    "almond beverage, added sugar & ca",
    "almond beverage, added sugar & vitamins",
    "almond beverage, added sugar, unfortified",
]

# ─────────────────────────────────────────────────────────────────────────────
# Exact names to REMOVE
# ─────────────────────────────────────────────────────────────────────────────
REMOVE_EXACT = {
    'Oil, blend of monounsaturated vegetable oils',
    'Oil, blend of polyunsaturated vegetable oils',
    'Fat, solid, vegetable oil based',
    'Dairy blend, butter & edible oil spread (~80% fat), reduced salt (sodium 400 mg/100 g)',
    'Dairy blend, butter & edible oil spread (~80% fat), sodium 600 mg/100 g',
    'Squash, scallopini, fresh, raw',
    'Squash, button, fresh, raw',
    'Tamarillo, peeled, raw',
    'Tamarind, paste, pure',
    'Taro, peeled, fresh, raw',
    'Cassava, peeled, fresh, raw',
    'Cassava, white flesh, peeled, fresh, raw',
    'Cassava, yellow flesh, peeled, fresh, raw',
    'Kohlrabi, peeled, fresh, raw',
    'Seaweed, nori, dried',
    'Seaweed, boiled, drained',
    'Sprat, blue, wild caught, flesh, skin & bones, raw',
    'Sprat, blue, wild caught, flesh, skin & bones, fried, no added fat',
    'Shark, battered, deep-fried, takeaway outlet',
    'Shark, fillet, without skin, raw',
    'Shark, fillet, without skin, baked, no added fat',
    'Shark, fillet, without skin, steamed, no added fat',
    'Silver perch, aquacultured, raw',
    'Silver perch, aquacultured, baked, no added fat',
    'Silver perch, aquacultured, steamed, no added fat',
    'Spaghetti in tomato & cheese sauce, canned, reduced salt',
    'Spam, canned',
    'Spelt, boiled, no added fat or salt',
    'Spelt, uncooked',
    'Semolina, boiled, no added fat or salt',
    'Buckwheat groats, cooked in water, no added salt',
    'Bulgur, soaked in water, no added fat or salt',
    'Bulgur, uncooked',
    'Millet, boiled, no added fat or salt',
    'Noodle, soba, boiled, drained',
    'Noodle, rice stick, boiled, drained',
    'Noodle, wheat, instant, flavoured, boiled, drained',
    'Noodle, wheat, instant, flavoured, boiled, undrained',
    'Noodle, wheat, instant, unflavoured, boiled, drained',
    'Noodle, wheat, instant, unflavoured, boiled, undrained',
    'Cornmeal (polenta), boiled, no added fat or salt',
    'Mixed vegetables, purchased frozen, carrot, corn & pea/bean, boiled, drained',
    'Pumpkin, golden nugget, peeled, fresh, boiled, drained',
    'Pumpkin, jarrahdale, peeled, fresh, boiled, drained',
    'Pumpkin, kent/jap, peeled, fresh, boiled, drained, no added fat',
    'Pumpkin, peeled, fresh, boiled, drained',
    'Pumpkin, Queensland blue, peeled, fresh, boiled, drained',
    'Pumpkin, butternut, peeled, fresh, boiled, drained',
    'Sweetcorn, fresh or frozen on cob, baked, roasted, fried, stir-fried, grilled or BBQ\'d, no added fat',
    'Sweet potato, raw',  # will be re-added with correct name
    'Bok choy, fried, no added fat',
    'Bok choy, steamed',
    'Brussels sprout, fresh, baked, no added fat',
    'Snow pea, fresh, boiled, drained',
    'Snow pea, fresh, fried, no added fat',
    'Shallot, peeled, fresh, fried, no added fat',
    'Pea, green, fresh, boiled, drained',
    'Pea, green, frozen, boiled, drained',
    'Pea, split, dried, boiled, drained',
    'Bean, broad, fresh, boiled, drained',
    'Bean, butter, fresh, boiled, drained',
    'Bean, green, fresh, boiled, drained',
    'Bean, green, frozen, boiled, drained',
    'Bean, haricot, dried, boiled, drained',
    'Bean, red kidney, dried, boiled, drained',
    'Bean, red kidney, fresh, boiled, drained',
    'Bean, soya (soy), dried, boiled, drained',
    'Beetroot, fresh, purple, peeled, boiled, drained',
    'Celeriac, peeled, boiled, drained',
    'Chicory, boiled, drained',
    'Choko, peeled, fresh, boiled, drained',
    'Fennel, fresh, boiled, drained',
    'Corn, fresh on cob, boiled, drained',
    'Corn, kernels, purchased frozen, boiled, drained',
    'Scallop, fried, no added fat',
    'Squid or calamari, fried, no added fat',
    'Sausage, beef, fried, no added fat',
    'Sausage, beef, grilled, no added fat',
    'Sausage, chicken, flavoured, fried, no added fat',
    'Sausage, chicken, plain, fried, no added fat',
    'Sausage, chorizo, fried, no added fat',
    'Sausage, lamb, flavoured, fried, no added fat',
    'Sausage, lamb, plain, fried, no added fat',
    'Sausage, pork, fried, no added fat',
    'Sausage, vegetarian style, added Fe, Zn and vitamin B12, raw',
    'Sausage, vegetarian style, fried, no added fat',
    'Sausage, vegetarian style, unfortified, raw',
    'Buffalo, riverine, cube roll, raw',
    'Buffalo, riverine, topside, raw',
    'Buffalo, swamp, cube roll, raw',
    'Buffalo, swamp, topside, raw',
    'Bun, sweet, hot cross bun, with dried fruit',
    'Bun, sweet, with dried fruit, iced',
    'Bun, sweet, with dried fruit, uniced',
    'Snack ball, date based',
    'Snack, grain based, extruded, flavoured',
    'Spread, hazelnut & chocolate flavoured',
    'Sauce, pasta, cheese or cream-based, commercial',
    'Sauce, pasta, tomato-based, commercial, heated',
    'Sauce, plum, commercial',
    'Sauce, rogan josh, commercial',
    'Sauce, salsa, tomato-based, commercial',
    'Sauce, simmer, curry flavoured, commercial',
    'Sauce, white, savoury, homemade',
    'Sausage roll, commercial, ready to eat',
    'Sausage roll, purchased frozen, baked',
    'Soft drink, cola flavour, decaffeinated',
    'Soft drink, cola flavour, intense sweetened or diet',
    'Soft drink, cola flavour, intense sweetened or diet, decaffeinated',
    'Soft drink, dry ginger ale or ginger beer, regular',
    'Soft drink, energy drink, Red Bull',
    'Soft drink, energy drink, V',
    'Soft drink, fruit flavours, intense sweetened or diet',
    'Soft drink, tonic water',
    'Soft drink, tonic water, intense sweetened or diet',
    'Stock, dry powder or cube',
    'Stock, liquid, all flavours (except fish), prepared from commercial powder or cube',
    'Taco seasoning mix, chilli-based',
    'Syrup, malt',
    'Syrup, rice malt',
    'Breakfast cereal, beverage, non-chocolate flavours, added vitamins & minerals (Up & Go)',
    'Breakfast cereal, flakes of corn, added vitamins & minerals (Kellogg\'s Cornflakes)',
    'Breakfast cereal, flakes of corn, unfortified',
    'Breakfast cereal, mixed grain (rice & wheat), flakes, added vitamins & minerals (Kellogg\'s Special K)',
    'Breakfast cereal, mixed grain (wheat & oat), flakes, apricot & sultana, added vitamins & minerals (Kellogg\'s Just Right)',
    'Breakfast cereal, mixed grain (wheat, oat & corn), added vitamins & minerals (Kellogg\'s Nutri-grain)',
    'Breakfast cereal, mixed grain (wheat, rice & oat), flakes, honey, unfortified (Be Natural Honey Flakes)',
    'Breakfast cereal, puffed or popped rice, added vitamins & minerals (Kellogg\'s Rice Bubbles)',
    'Breakfast cereal, puffed or popped rice, cocoa coating, added vitamins & minerals (Kellogg\'s Coco Pops)',
    'Breakfast cereal, puffed or popped rice, no added sugar or salt, unfortified',
    'Breakfast cereal, wheat bran, flakes, added vitamins & minerals (Kellogg\'s Bran Flakes)',
    'Breakfast cereal, wheat bran, flakes, sultanas, added vitamins & minerals (Kellogg\'s Sultana Bran)',
    'Breakfast cereal, wheat bran, pellets, added vitamins & minerals (Kellogg\'s All Bran)',
    'Breakfast cereal, whole wheat, biscuit, added vitamins & minerals (Sanitarium Weet Bix)',
    'Breakfast cereal, whole wheat, biscuit, bran, added vitamins & minerals (Sanitarium Weet-Bix Hi-Bran)',
    'Breakfast cereal, whole wheat, biscuit, no added sugar, unfortified',
    'Breakfast cereal, whole wheat, flakes, added vitamins & minerals (Weeties style)',
    'Breakfast cereal, whole wheat, flakes, dried fruit & nuts, added vitamins & minerals (Uncle Toby\'s Fibre Plus)',
    'Breakfast cereal, whole wheat, puffed, no added sugar or salt, unfortified',
    'Biscuit, savoury, corn cake, plain, salted',
    'Biscuit, savoury, from rye flour, crispbread',
    'Biscuit, savoury, from wheat flour, crispbread, puffed & toasted',
    'Biscuit, savoury, from white wheat flour, Salada style',
    'Biscuit, savoury, from white wheat flour, cheese-flavoured',
    'Biscuit, savoury, from white wheat flour, flaky cracker style',
    'Biscuit, savoury, from white wheat flour, flavoured (excluding cheese)',
    'Biscuit, savoury, from white wheat flour, plain snack cracker style',
    'Biscuit, savoury, from white wheat flour, water cracker style',
    'Biscuit, savoury, from wholemeal wheat flour & rye flour, crispbread, puffed',
    'Biscuit, savoury, from wholemeal wheat flour, crispbread',
    'Biscuit, savoury, rice cake, from brown rice, plain',
    'Biscuit, savoury, rice cracker, added vegetable powder',
    'Biscuit, savoury, rice cracker, flavoured (excluding seaweed)',
    'Biscuit, savoury, rice cracker, plain',
    'Biscuit, savoury, rice cracker, seaweed flavoured',
    'Biscuit, savoury, seed based',
    'Biscuit, sweet, Anzac style, commercial',
    'Biscuit, sweet, Anzac style, homemade from basic ingredients',
    'Biscuit, sweet, biscuit base, caramel filling, chocolate-coated, commercial',
    'Biscuit, sweet, biscuit base, mint filling, chocolate-coated',
    'Biscuit, sweet, breakfast style, with or without dried fruit',
    'Biscuit, sweet, chocolate chip or coated',
    'Biscuit, sweet, chocolate chip, homemade from basic ingredients, fat not further defined',
    'Biscuit, sweet, chocolate flavoured, commercial',
    'Biscuit, sweet, cream filled, commercial',
    'Biscuit, sweet, ginger flavoured, commercial',
    'Biscuit, sweet, plain',
    'Biscuit, sweet, plain, with icing, commercial',
    'Biscuit, sweet, sandwich, cream & jam filling',
    'Biscuit, sweet, sandwich, cream filling, chocolate-coated, tim tam style',
    'Biscuit, sweet, shortbread style, commercial',
    'Biscuit, sweet, wheatmeal',
    'Cake mix, plain, dry powder',
    'Cake or cupcake, sponge, plain, commercial, iced, unfilled',
    'Cake, carrot, commercial, iced',
    'Cake, carrot, homemade, iced',
    'Cake, carrot, homemade, uniced',
    'Cake, chocolate, homemade, iced',
    'Cake, chocolate, homemade, uniced',
    'Cake, fruit, homemade, uniced',
    'Cake, lamington, unfilled',
    'Slice, brownie, chocolate, with nuts, homemade',
    'Slice, brownie, chocolate, without nuts, commercial',
    'Slice, caramel',
    'Scone, fruit, commercial',
    'Scone, plain, commercial',
    'Scone, pumpkin, homemade',
    'Pastry, puff, vegetable oil, commercial, baked',
    'Pastry, puff, vegetable oil, commercial, raw',
    'Soup, broth style, with meat & noodles, instant dry mix',
    'Soup, broth style, with meat, instant dry mix',
    'Soup, cream variety, instant dry mix',
    'Soup, vegetable & noodle, instant dry mix',
    'Soup, vegetable, instant dry mix',
    'Soy beverage, reduced fat (~1%), added Ca & vitamins A, B1, B2 & B12',
    'Soy beverage, regular fat (~3%), added Ca',
    'Soy beverage, regular fat (~3%), added Ca & vitamins A, B1, B2 & B12',
    'Soy beverage, regular fat (~3%), unfortified',
    'Almond beverage, added sugar & Ca',
    'Almond beverage, added sugar & vitamins B1, B2, B12, C & Ca',
    'Almond beverage, added sugar, unfortified',
    'Beverage, flavoured milk, prepared with cow\'s milk, reduced fat',
    'Beverage, chocolate flavoured, prepared with cow\'s milk, reduced fat',
    'Beverage, coffee flavoured, prepared with cow\'s milk, regular fat',
    'Beverage, coffee flavoured, prepared with cow\'s milk, reduced fat',
    'Cabbage, Chinese flowering, raw',
    'Cabbage, Chinese, boiled, drained',
    'Cabbage, mustard, raw',
    'Cabbage, mustard, boiled, drained',
    'Cabbage, red, boiled, drained',
    'Cabbage, savoy, boiled, drained',
    'Cabbage, white, boiled, drained',
    'Nut, peanut, with skin, roasted, with oil, salted',
    'Nut, peanut, without skin, roasted, with oil, salted',
    'Nut, peanut, without skin, roasted, with oil, unsalted',
    'Sauce, tomato, commercial, reduced salt',
    'Sauce, tomato, reduced sugar & salt, commercial',
    'Soy sauce',  # will be re-added as simplified name below
    'Cabbage, Chinese, raw',  # keep as Chinese cabbage
    'Soft drink, cola flavour',  # keep as Cola, regular
    'Soft drink, fruit flavours',  # keep as Soft drink, fruit flavoured
    'Bread, from white flour, toasted',  # remove toasted duplicate
    'Sausage, chorizo, uncooked',  # keep as Chorizo, raw
}

# ─────────────────────────────────────────────────────────────────────────────
# Name renames for entries we want to keep but rename
# ─────────────────────────────────────────────────────────────────────────────
RENAMES = {
    'Oil, olive': 'Olive oil',
    'Oil, avocado': 'Avocado oil',
    'Oil, canola': 'Canola oil',
    'Oil, coconut': 'Coconut oil',
    'Oil, sunflower': 'Sunflower oil',
    'Sunflower oil': 'Sunflower oil',  # already simplified
    'Seed, hemp, dried': 'Hemp seeds',
    'Seed, poppy': 'Poppy seeds',
    'Seed, pumpkin, hulled & dried': 'Pumpkin seeds, raw',
    'Seed, sunflower': 'Sunflower seeds, raw',
    'Nut, peanut, with skin, roasted, with oil, unsalted': 'Peanuts, roasted',
    'Nut, peanut, without skin, roasted, with oil, unsalted': 'Peanuts, roasted (skinless)',
    'Sausage, beef, raw': 'Beef sausage, raw',
    'Sausage, chorizo, uncooked': 'Chorizo, raw',
    'Sausage, lamb, plain, fried, no added fat': 'Lamb sausage, cooked',
    'Cabbage, Chinese, raw': 'Chinese cabbage, raw',
    'Soft drink, cola flavour': 'Cola, regular',
    'Soft drink, fruit flavours': 'Soft drink, fruit flavoured',
    'Sauce, tomato, commercial': 'Tomato sauce (ketchup)',
    'Soy sauce': 'Soy sauce',
    'Sauce, soy, commercial, reduced salt': 'Soy sauce, reduced salt',
    'Sauce, tabasco, commercial': 'Tabasco sauce',
    'Sauce, hot chilli, commercial': 'Hot chilli sauce',
    'Sauce, sweet chilli, commercial': 'Sweet chilli sauce',
    'Sauce, oyster, commercial': 'Oyster sauce',
    'Sauce, fish, commercial': 'Fish sauce',
    'Sauce, barbecue, commercial': 'BBQ sauce',
    'Sauce, worcestershire, commercial': 'Worcestershire sauce',
    'Spread, yeast, vegemite': 'Vegemite',
    'Spread, yeast, marmite': 'Marmite',
    'Syrup, maple, pure': 'Maple syrup',
    'Sugar, white, granulated or lump': 'Sugar, white',
    'Sugar, white, icing': 'Icing sugar',
    'Sugar, white, icing mixture': 'Icing mixture',
    'Scallop, raw': 'Scallop, raw',
    'Sweet potato, raw': 'Sweet potato, raw',
    'Sweetcorn, fresh, raw': 'Sweetcorn, raw',
    'Taco shell, from corn flour, plain': 'Taco shell',
    'Bulgur, uncooked': 'Bulgur wheat, dry',
    'Cornmeal (polenta), boiled, no added fat or salt': 'Polenta, cooked',
    'Millet, boiled, no added fat or salt': 'Millet, cooked',
    'Spelt, boiled, no added fat or salt': 'Spelt, cooked',
    'Semolina, boiled, no added fat or salt': 'Semolina, cooked',
    'Seaweed, nori, dried': 'Nori (seaweed), dried',
    'Squash, button, fresh, raw': 'Button squash, raw',
    'Squash, scallopini, fresh, raw': 'Scallopini squash, raw',
    'Taro, peeled, fresh, raw': 'Taro, raw',
    'Tamarillo, peeled, raw': 'Tamarillo, raw',
    'Tamarind, paste, pure': 'Tamarind paste',
    'Cassava, peeled, fresh, raw': 'Cassava, raw',
    'Kohlrabi, peeled, fresh, raw': 'Kohlrabi, raw',
    'Parsnip, peeled, fresh, raw': 'Parsnip, raw',
    'Okra, raw': 'Okra, raw',
    'Snack ball, date based': 'Bliss ball, date based',
    'Sausage, chorizo, uncooked': 'Chorizo, raw',
    'Sausage, beef, raw': 'Beef sausage, raw',
    'Bun, sweet, hot cross bun, with dried fruit': 'Hot cross bun',
    'Scone, plain, commercial': 'Scone, plain',
    'Scone, fruit, commercial': 'Scone, fruit',
    'Snack bar, fruit filled': 'Snack bar, fruit filled',
    'Snack bar, oat based': 'Snack bar, oat based',
    'Breakfast cereal, whole wheat, biscuit, added vitamins & minerals (Sanitarium Weet Bix)': 'Weet-Bix',
    'Breakfast cereal, whole wheat, biscuit, no added sugar, unfortified': 'Weet-Bix style (unfortified)',
    'Breakfast cereal, flakes of corn, unfortified': 'Corn flakes',
    'Breakfast cereal, puffed or popped rice, no added sugar or salt, unfortified': 'Puffed rice cereal',
    'Breakfast cereal, whole wheat, puffed, no added sugar or salt, unfortified': 'Puffed wheat cereal',
    'Pumpkin, butternut, peeled, raw': 'Pumpkin, butternut, raw',
    'Pumpkin, Queensland blue, peeled, raw': 'Pumpkin, Queensland blue, raw',
    'Soy beverage, added Ca': 'Soy milk, with calcium',
    'Soy beverage, no added sugar, unfortified': 'Soy milk, unsweetened',
    'Almond beverage, no added sugar, unfortified': 'Almond milk, unsweetened',
    'Almond beverage, no added sugar, added Ca': 'Almond milk, unsweetened, with calcium',
    'Soft drink, cola flavour': 'Cola, regular',
    'Soft drink, fruit flavours': 'Soft drink, fruit flavoured',
}


def main():
    print("Connecting to database...")
    conn = mysql.connector.connect(**DB_PARAMS)
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM nutrition_foods ORDER BY id")
    foods = cursor.fetchall()
    print(f"Starting food count: {len(foods)}")

    to_delete = []
    to_rename = []
    seen_names = {}

    for food_id, name in foods:
        # Check exact removals
        if name in REMOVE_EXACT:
            to_delete.append(food_id)
            continue

        # Apply rename if applicable
        new_name = RENAMES.get(name, name)

        # Dedup: if we already have this name, delete the duplicate
        if new_name in seen_names:
            to_delete.append(food_id)
            continue

        seen_names[new_name] = food_id
        if new_name != name:
            to_rename.append((new_name, food_id))

    print(f"To delete: {len(to_delete)}")
    print(f"To rename: {len(to_rename)}")

    # Delete
    if to_delete:
        # Delete in batches
        for i in range(0, len(to_delete), 200):
            batch = to_delete[i:i+200]
            placeholders = ','.join(['%s'] * len(batch))
            cursor.execute(f"DELETE FROM food_servings WHERE foodId IN ({placeholders})", batch)
            cursor.execute(f"DELETE FROM nutrition_foods WHERE id IN ({placeholders})", batch)
        conn.commit()
        print(f"Deleted {len(to_delete)} foods.")

    # Rename
    if to_rename:
        for new_name, food_id in to_rename:
            cursor.execute("UPDATE nutrition_foods SET name = %s WHERE id = %s", (new_name, food_id))
        conn.commit()
        print(f"Renamed {len(to_rename)} foods.")

    cursor.execute("SELECT COUNT(*) FROM nutrition_foods")
    final_count = cursor.fetchone()[0]
    print(f"Final food count: {final_count}")

    # Show sample
    cursor.execute("SELECT name FROM nutrition_foods ORDER BY name LIMIT 50")
    print("\nSample (first 50 alphabetically):")
    for r in cursor.fetchall():
        print(f"  {r[0]}")

    cursor.close()
    conn.close()
    print("\nDone!")


if __name__ == '__main__':
    main()
