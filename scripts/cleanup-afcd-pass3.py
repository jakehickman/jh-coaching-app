#!/usr/bin/env python3
"""
AFCD Food Database Cleanup - Pass 3 (Final)

Strategy: Use a WHITELIST approach. Only keep foods that match approved
patterns. Everything else gets deleted. This is more reliable than
trying to enumerate everything to remove.
"""

import mysql.connector
import re

DB_PARAMS = {
    'user': '3K2x4Mgy2RpvvVT.root',
    'password': 'Ta3euAH93De7dGlu54yl',
    'host': 'gateway05.us-east-1.prod.aws.tidbcloud.com',
    'port': 4000,
    'database': 'HZf6zqYa94nKHY3YxXLHa5',
    'ssl_disabled': False,
}

# ─────────────────────────────────────────────────────────────────────────────
# WHITELIST: exact names to keep
# ─────────────────────────────────────────────────────────────────────────────
KEEP_EXACT = {
    # Eggs
    'Egg, whole, raw', 'Egg white, raw', 'Egg yolk, raw',
    'Egg, chicken, whole, fried, no fat added',

    # Chicken
    'Chicken breast, lean, raw', 'Chicken thigh, lean, raw',
    'Chicken drumstick, lean, raw', 'Chicken wing, lean, raw',
    'Chicken mince, raw', 'Chicken liver, raw',
    'Chicken, breast, lean flesh, baked, no added fat',

    # Beef
    'Beef mince, lean, raw', 'Beef rump steak, lean, raw',
    'Beef stir-fry strips, lean, raw', 'Beef, diced, lean, raw',
    'Beef, corned, canned',
    'Beef, steak, boneless, fillet or tenderloin, lean, raw',
    'Beef, steak, boneless, scotch fillet, lean, raw',
    'Beef, steak, boneless, round, lean, raw',
    'Beef, steak, with bone, T-bone, lean, raw',
    'Beef, steak, boneless or bone-in, blade, lean, raw',
    'Beef, sirloin steak, lean, raw',
    'Beef, rump steak, lean, grilled, no added fat',
    'Beef, topside roast, lean, raw',
    'Beef, silverside roast, lean, raw',
    'Beef sausage, raw',

    # Lamb
    'Lamb cutlet, lean, raw', 'Lamb loin chop, lean, raw',
    'Lamb, diced, lean, raw', 'Lamb, stir-fry strips, lean, raw',
    'Lamb, fillet, lean, raw', 'Lamb, steak, boneless, lean, raw',
    'Lamb, leg roast, lean, raw', 'Lamb, roasting piece, shoulder, lean, raw',
    'Lamb, mince, raw', 'Lamb, liver, grilled, no added fat',
    'Lamb, eye of loin, lean, raw',

    # Pork
    'Pork loin chop, lean, raw', 'Pork fillet, lean, raw',
    'Pork rump steak, lean, raw', 'Pork butterfly steak, lean, raw',
    'Pork forequarter chop, lean, raw', 'Pork loin steak, lean, raw',
    'Pork mince, raw', 'Pork belly, raw',
    'Pork, stir-fry strips, raw',
    'Pork, scotch roast, lean, raw',
    'Pork, spare ribs, untrimmed, raw',
    'Bacon, raw', 'Bacon, cooked', 'Bacon, lean, cooked', 'Bacon, shortcut, cooked',
    'Bacon fat, cooked',
    'Ham, sliced', 'Prosciutto', 'Salami',
    'Chorizo, raw',
    'Frankfurt, cooked',

    # Turkey
    'Turkey breast, lean, raw',

    # Veal
    'Veal cutlet, lean, raw', 'Veal steak, lean, raw',
    'Veal stir-fry strips, lean, raw', 'Veal, diced, lean, raw',

    # Kangaroo / Venison
    'Kangaroo loin fillet, raw', 'Kangaroo steak, raw',
    'Venison leg, lean, raw', 'Venison mince, raw',

    # Sausages (cooked)
    'Beef sausage, thick, cooked', 'Beef sausage, thin, cooked',
    'Chicken sausage, cooked', 'Pork sausage, cooked',

    # Fish & Seafood
    'Barramundi fillet, raw', 'Basa fillet, raw', 'Hoki fillet, raw',
    'Bream fillet, raw', 'Flathead fillet, raw', 'Snapper fillet, raw',
    'Whiting fillet, raw', 'Tilapia fillet, raw',
    'Ocean trout fillet, raw', 'Rainbow trout, raw',
    'Salmon (Atlantic) fillet, raw', 'Salmon (King) fillet, raw',
    'Salmon, pink, canned', 'Salmon, red, canned', 'Salmon, smoked',
    'Sardine, raw',
    'Tuna (yellowfin) fillet, raw', 'Tuna, canned in water',
    'Anchovy, canned',
    'Prawn, raw', 'Prawn, flesh, cooked from raw, no added fat',
    'Scallop, raw', 'Octopus, raw', 'Oyster, raw',
    'Calamari, raw',
    'Crab, cooked', 'Lobster, cooked', 'Lobster, raw',
    'Mussels, cooked',
    'Morwong, fillet, raw',
    'Mulloway, fillet, raw',
    'Milkfish, aquacultured, fillet, raw',
    'Cod, smoked, raw',

    # Dairy
    'Milk, full fat', 'Milk, reduced fat', 'Milk, skim',
    'Milk, lactose free, reduced fat', 'Milk, lactose free, full fat',
    'Milk, evaporated', 'Milk, evaporated, reduced fat',
    'Condensed milk, sweetened',
    'Butter, salted', 'Butter, unsalted', 'Butter, reduced salt',
    'Sour cream', 'Sour cream, light',
    'Cream, thickened',
    'Cream cheese',
    'Cheese, cheddar', 'Cheese, cheddar, reduced fat',
    'Cheese, mozzarella', 'Cheese, parmesan, grated', 'Cheese, parmesan, fresh',
    'Cheese, feta', 'Cheese, haloumi', 'Cheese, haloumi, reduced salt',
    'Cheese, ricotta', 'Cheese, cottage', 'Cheese, bocconcini',
    'Cheese, brie', 'Cheese, camembert', 'Cheese, blue vein',
    'Cheese, goat', 'Cheese, edam',
    'Yoghurt, natural', 'Yoghurt, vanilla flavoured', 'Yoghurt, vanilla, low fat',
    'Yoghurt, flavoured, low fat', 'Yoghurt, flavoured, high fat',
    'Yoghurt, fruit flavoured', 'Yoghurt, strawberry flavoured',
    'Yoghurt, high protein, low fat',
    'Protein powder, whey',

    # Eggs (plant-based)
    'Tofu, firm',

    # Legumes
    'Chickpeas, canned', 'Chickpeas, cooked',
    'Lentils, cooked', 'Lentils, red, dry', 'Lentils, green, dry',
    'Kidney beans, canned', 'Kidney beans, cooked',
    'Black beans, cooked', 'Cannellini beans, canned', 'Cannellini beans, cooked',
    'Borlotti beans, canned', 'Borlotti beans, cooked',
    'Butter beans, canned',
    'Baked beans', 'Baked beans, reduced salt',
    'Edamame, cooked',
    'Bean, broad, dried', 'Bean, broad, fresh, raw',
    'Bean, butter, fresh, raw',
    'Bean, green, fresh, raw', 'Bean, green, fresh, cooked, no added fat',
    'Bean, haricot, dried',
    'Bean, lima, dried',
    'Bean, mung, whole, dried, uncooked',
    'Bean, red kidney, canned, drained', 'Bean, red kidney, dried', 'Bean, red kidney, fresh, raw',
    'Bean, soya (soy), dried',
    'Peas, raw', 'Peas, cooked',
    'Snow peas, raw',
    'Bean sprouts, raw',
    'Split peas, dry',
    'Soybeans, cooked', 'Soybeans, canned',
    'TVP / soy mince, dry',

    # Grains & Bread
    'Oats, rolled, dry', 'Oat bran', 'Wheat bran', 'Wheat germ',
    'Rice, white, dry', 'Rice, brown, dry',
    'Quinoa, dry', 'Quinoa, cooked',
    'Barley, pearl, cooked',
    'Bulgur wheat, dry',
    'Couscous, dry', 'Couscous, cooked',
    'Pasta, white, dry', 'Pasta, white, cooked',
    'Pasta, wholemeal, dry', 'Pasta, wholemeal, cooked',
    'Pasta, egg, cooked',
    'Bread, white', 'Bread, wholemeal', 'Bread, mixed grain', 'Bread, gluten free',
    'Bread roll, white', 'Bread roll, wholemeal', 'Bread roll, mixed grain',
    'Pita bread, white', 'Pita bread, wholemeal',
    'Naan bread', 'Tortilla wrap, white', 'Wrap, white',
    'Bagel, white', 'Burger bun, white', 'Crumpet',
    'Rice cake', 'Corn thins', 'Taco shell',
    'Breadcrumbs',
    'Weet-Bix',
    'Muesli, untoasted', 'Muesli, toasted',
    'Flour, wheat, white, plain', 'Flour, wheat, white, self-raising',
    'Flour, wheat, wholemeal, plain',
    'Flour, chickpea (besan)', 'Flour, rice', 'Flour, rye',
    'Flour, gluten free, plain',
    'Noodle, soba, dry', 'Soba noodles, cooked',
    'Cornmeal (polenta), uncooked',
    'Millet, uncooked',
    'Spelt, uncooked', 'Rye, grain, whole, uncooked',
    'Buckwheat groats, uncooked',
    'Semolina, uncooked',
    'Noodle, wheat, fresh, soaked, drained',
    'Noodle, wheat, instant, flavoured, dry, uncooked',
    'Noodle, wheat, instant, unflavoured, dry, uncooked',

    # Nuts & Seeds
    'Almonds, raw', 'Almond meal',
    'Cashews, raw', 'Cashews, roasted',
    'Walnuts, raw', 'Macadamia nuts, raw', 'Pecans, raw',
    'Pistachios, raw', 'Hazelnuts, raw',
    'Nut, brazil, raw or blanched, unsalted',
    'Nut, pine, raw, unsalted',
    'Nut, peanut, with skin, raw, unsalted',
    'Peanuts, roasted',
    'Peanut butter, natural', 'Peanut butter',
    'Chia seeds', 'Flaxseeds / linseeds', 'Sesame seeds',
    'Sunflower seeds, raw', 'Pumpkin seeds, raw',
    'Hemp seeds', 'Poppy seeds',
    'Tahini',
    'Almond milk, unsweetened', 'Almond milk, unsweetened, with calcium',

    # Oils & Fats
    'Olive oil', 'Avocado oil', 'Canola oil', 'Coconut oil', 'Sunflower oil',
    'Ghee',
    'Margarine',
    'Dripping, beef',

    # Fruits (raw)
    'Apple, raw', 'Apple, pink lady, raw', 'Apple, granny smith, raw',
    'Banana, raw', 'Orange, raw', 'Mango, raw', 'Pineapple, raw',
    'Strawberry, raw', 'Blueberry, raw', 'Raspberry, raw', 'Blackberry, raw',
    'Grape, green, raw', 'Kiwifruit, raw', 'Mandarin, raw',
    'Peach, raw', 'Pear, raw', 'Apricot, raw', 'Plum, raw',
    'Nectarine, raw', 'Cherry, raw', 'Fig, raw',
    'Avocado, raw',
    'Watermelon, raw', 'Rockmelon, raw', 'Honeydew melon, raw',
    'Lemon, raw', 'Lime, raw', 'Grapefruit, raw',
    'Passionfruit, raw', 'Pomegranate, raw', 'Lychee, raw',
    'Papaya, raw', 'Tangelo, raw',
    'Mulberry, raw',
    'Feijoa, raw',
    'Cumquat (kumquat), raw',
    'Cranberry, raw',
    'Currant, fresh',
    'Custard apple, African pride, peeled, raw',
    'Quandong, fruit, flesh',
    'Prickly pear, peeled, raw',
    'Melon, bitter, fresh, raw',
    # Frozen fruits
    'Banana, frozen', 'Mango, frozen', 'Strawberry, frozen',
    'Blueberry, frozen', 'Pineapple, frozen', 'Raspberry, purchased frozen',
    'Cherry, pitted, frozen', 'Mixed berry, frozen',
    # Dried fruits
    'Apricot, dried', 'Date, dried', 'Fig, dried', 'Prune, dried',
    'Raisin', 'Sultana', 'Currant, dried', 'Cranberry, dried, sweetened',
    'Mixed dried fruit',
    # Canned fruits
    'Pineapple, canned in juice, drained',
    'Raspberry, canned in syrup', 'Raspberry, canned in syrup, drained',
    'Cherry, black, canned in syrup', 'Cherry, black, canned in syrup, drained',
    # Coconut
    'Coconut, fresh, mature fruit, flesh', 'Coconut, fresh, mature, water or juice',
    'Coconut, fresh, young or immature, flesh', 'Coconut, fresh, young or immature, water or juice',
    'Coconut, grated & desiccated',
    'Coconut, cream, regular fat', 'Coconut, milk, canned, regular fat', 'Coconut, milk, canned, reduced fat',

    # Vegetables (raw & key cooked)
    'Broccoli, raw', 'Broccolini, raw',
    'Spinach, baby, raw', 'Spinach, raw',
    'Kale, raw',
    'Sweet potato, raw',
    'Potato, raw', 'Potato, desiree, raw', 'Potato, new, raw',
    'Potato, pontiac, raw', 'Potato, red skin, raw', 'Potato, sebago, raw',
    'Carrot, raw',
    'Tomato, raw', 'Tomato, cherry, raw',
    'Tomato sauce (ketchup)', 'Tomato, canned',
    'Onion, mature, brown skinned, peeled, raw',
    'Onion, mature, red skinned, raw',
    'Onion, mature, white skinned, peeled, fresh, raw',
    'Onion, spring, fresh, raw',
    'Garlic, peeled, fresh, raw',
    'Ginger, fresh, raw',
    'Capsicum, green, fresh, raw', 'Capsicum, red, fresh, raw', 'Capsicum, yellow, fresh, raw',
    'Zucchini, raw',
    'Cucumber, raw',
    'Mushroom, common, fresh, raw',
    'Mushroom, common, vitamin D enhanced, fresh, raw',
    'Lettuce, cos, raw', 'Lettuce, iceberg, raw',
    'Rocket, fresh, raw',
    'Asparagus, raw', 'Asparagus, canned in brine, drained',
    'Cauliflower, raw',
    'Cabbage, raw', 'Cabbage, Chinese, raw', 'Cabbage, red, raw',
    'Brussels sprouts, raw',
    'Bok choy, raw',
    'Silverbeet, raw',
    'Celery, raw',
    'Beetroot, raw', 'Beetroot, canned',
    'Pumpkin, butternut, peeled, fresh, raw', 'Pumpkin, Queensland blue, peeled, fresh, raw',
    'Pumpkin, golden nugget, peeled, fresh, raw', 'Pumpkin, jarrahdale, peeled, fresh, raw',
    'Pumpkin, kent/jap, peeled, fresh, raw', 'Pumpkin, peeled, fresh, raw',
    'Sweetcorn, raw',
    'Corn, fresh on cob, raw',
    'Corn, kernels, canned in brine, drained', 'Corn, kernels, purchased frozen, raw',
    'Eggplant, unpeeled, fresh, raw',
    'Shallot, peeled, fresh, raw',
    'Leek, raw',
    'Fennel, fresh, raw',
    'Snow peas, raw',
    'Bean, green, fresh, raw',
    'Chilli (chili), red, raw', 'Chilli (chili), green, raw',
    'Chives, raw',
    'Coriander, fresh, raw',
    'Parsley, continental, fresh, raw', 'Parsley, curly, fresh, raw',
    'Dill, fresh, raw',
    'Mint, fresh, raw',
    'Basil, fresh, raw',
    'Rosemary, dried', 'Sage, dried', 'Sage, fresh, raw',
    'Oregano, dried', 'Oregano, fresh, raw',
    'Sprout, alfalfa, fresh, raw', 'Sprout, bean, fresh, raw',
    'Mixed leafy greens, pre-packaged, all types',
    'Water spinach, raw',
    'Endive, fresh, raw',
    'Radish, red skinned, unpeeled, raw', 'Radish, white skinned, peeled, raw',
    'Okra, raw',
    'Parsnip, raw', 'Parsnip, peeled, fresh, baked, no added fat',
    'Taro, peeled, fresh, boiled, drained',
    'Choko, peeled, fresh, raw',
    'Squash, button, fresh, raw', 'Squash, button, fresh, boiled, drained',
    'Squash, scallopini, fresh, raw', 'Squash, scallopini, fresh, boiled, drained',
    'Rhubarb, stalk, raw',
    'Tamarillo, peeled, raw',
    'Cassava, peeled, fresh, raw',
    'Kohlrabi, peeled, fresh, raw',
    'Chicory, raw',
    'Seaweed, nori, dried',
    'Olive, green or black, drained',

    # Condiments & Sauces
    'Soy sauce', 'Soy sauce, reduced salt',
    'Fish sauce', 'Oyster sauce', 'Tabasco sauce',
    'Hot chilli sauce', 'Sweet chilli sauce', 'BBQ sauce',
    'Worcestershire sauce',
    'Tomato sauce (ketchup)',
    'Sauce, cranberry, commercial',
    'Sauce, hoi sin (hoisin), commercial',
    'Sauce, pasta or simmer, commercial, low fat',
    'Sauce, pasta, basil pesto, commercial',
    'Sauce, pasta, bolognese, homemade using beef mince & commercial tomato based sauce',
    'Mustard, cream style',
    'Mayonnaise', 'Mayonnaise, reduced fat',
    'Hummus', 'Guacamole', 'Tzatziki',
    'Vegemite', 'Marmite',
    'Honey', 'Maple syrup', 'Golden syrup', 'Molasses',
    'Sugar, white', 'Sugar, raw', 'Icing sugar', 'Icing mixture',
    'Jam, fruit', 'Chutney or relish, commercial',
    'Capers',
    'Beef stock', 'Chicken stock', 'Vegetable stock',
    'Vinegar', 'Balsamic vinegar',
    'Mirin',
    'Paste, Indian style curry, commercial',
    'Paste, green curry, commercial',
    'Paste, shrimp',
    'Paste, soybean',
    'Tomato paste',
    'Tomato, canned',
    'Tomato, sundried',
    'Tomato puree',

    # Spices
    'Cardamom, ground', 'Chilli powder', 'Cinnamon, ground',
    'Cloves, ground', 'Coriander, ground', 'Cumin, ground',
    'Fenugreek', 'Ginger, ground', 'Mustard powder',
    'Thyme, dried', 'Turmeric, ground',
    'Curry powder', 'Paprika, dry powder', 'Nutmeg, dried, ground',
    'Salt, table, iodised', 'Salt, table, non-iodised', 'Salt substitute, potassium chloride',

    # Beverages
    'Milk, full fat', 'Milk, reduced fat', 'Milk, skim',
    'Almond milk, unsweetened', 'Almond milk, unsweetened, with calcium',
    'Soy milk, with calcium', 'Soy milk, unsweetened',
    'Oat beverage, fluid, added Ca', 'Oat beverage, fluid, unfortified',
    'Rice beverage, fluid, added calcium', 'Rice beverage, unfortified',
    'Coconut beverage, added Ca', 'Coconut beverage, unfortified',
    'Coffee, black, from instant coffee powder',
    'Coffee, espresso, from ground coffee beans',
    'Coffee, flat white/latte/cappuccino, from ground coffee beans, with regular fat cow\'s milk',
    'Coffee, long black, from ground coffee beans',
    'Coffee, instant, dry powder or granules',
    'Black tea', 'Green tea',
    'Red wine', 'Red wine, cabernet sauvignon', 'Red wine, merlot',
    'Red wine, pinot noir', 'Red wine, shiraz', 'Red wine, sparkling',
    'White wine', 'White wine, chardonnay', 'White wine, riesling',
    'White wine, sauvignon blanc', 'White wine, semillon', 'White wine, sparkling',
    'Rosé wine', 'Dessert wine',
    'Port wine', 'Sherry, dry', 'Sherry, sweet',
    'Spirit (vodka/gin/rum/whisky)',
    'Beer, full strength', 'Beer, mid strength', 'Beer, low alcohol',
    'Cider, apple (alcohol ~4-5% v/v)',
    'Cola, regular', 'Soft drink, fruit flavoured',
    'Mineral water, natural, unflavoured', 'Mineral water, citrus flavoured',
    'Cordial, fruit juice/flavours, recommended dilution',

    # Misc / Treats (keep a few practical ones)
    'Cocoa powder',
    'Chocolate, dark, high cocoa solids', 'Chocolate, dark, no added sugar',
    'Chocolate, milk',
    'Muesli bar', 'Muesli bar, choc-coated', 'Muesli bar, with nuts',
    'Snack bar, fruit filled', 'Snack bar, oat based', 'Protein bar, nut based', 'Nut bar',
    'Spread, yeast, vegemite',  # already renamed to Vegemite
    'Psyllium, uncooked',
    'Custard, vanilla, regular fat',
    'Porridge, rolled oats, prepared with water',
    'Porridge, rolled oats, prepared with regular fat cow\'s milk',
    'Muffin, English style, from white flour',
    'Pancake, plain, homemade',
    'Croissant, plain',
    'Dressing, French or Italian, regular fat, commercial',
    'Dressing, thousand island, regular fat, commercial',
    'Confectionery, dried fruit & nuts, chocolate-coated',
    'Potato crisps or chips, plain, salted',
    'Corn chips, plain, salted',
    'Potato wedges, regular, purchased frozen, baked or roasted, no added fat',
    'Potato, fries, fast food outlet, deep fried, monounsaturated oil, salted',
    'Potato, fries, independent takeaway outlet, deep fried, blended oil, salted',
}

# ─────────────────────────────────────────────────────────────────────────────
# Additional renames to apply after filtering
# ─────────────────────────────────────────────────────────────────────────────
RENAMES = {
    'Garlic, peeled, fresh, raw': 'Garlic, raw',
    'Ginger, fresh, raw': 'Ginger, fresh',
    'Chilli (chili), red, raw': 'Chilli, red, raw',
    'Chilli (chili), green, raw': 'Chilli, green, raw',
    'Chilli (chili), green, fried, no added fat': 'Chilli, green, cooked',
    'Chilli (chili), red, fried, no added fat': 'Chilli, red, cooked',
    'Chives, raw': 'Chives, fresh',
    'Coriander, fresh, raw': 'Coriander, fresh',
    'Parsley, continental, fresh, raw': 'Parsley, continental, fresh',
    'Parsley, curly, fresh, raw': 'Parsley, curly, fresh',
    'Dill, fresh, raw': 'Dill, fresh',
    'Mint, fresh, raw': 'Mint, fresh',
    'Basil, fresh, raw': 'Basil, fresh',
    'Sage, fresh, raw': 'Sage, fresh',
    'Oregano, fresh, raw': 'Oregano, fresh',
    'Onion, mature, brown skinned, peeled, raw': 'Onion, brown, raw',
    'Onion, mature, red skinned, raw': 'Onion, red, raw',
    'Onion, mature, white skinned, peeled, fresh, raw': 'Onion, white, raw',
    'Onion, spring, fresh, raw': 'Spring onion, raw',
    'Mushroom, common, fresh, raw': 'Mushroom, raw',
    'Mushroom, common, vitamin D enhanced, fresh, raw': 'Mushroom, vitamin D enriched, raw',
    'Lettuce, cos, raw': 'Lettuce, cos, raw',
    'Lettuce, iceberg, raw': 'Lettuce, iceberg, raw',
    'Rocket, fresh, raw': 'Rocket, raw',
    'Eggplant, unpeeled, fresh, raw': 'Eggplant, raw',
    'Shallot, peeled, fresh, raw': 'Shallot, raw',
    'Leek, raw': 'Leek, raw',
    'Fennel, fresh, raw': 'Fennel, raw',
    'Cabbage, raw': 'Cabbage, white, raw',
    'Cabbage, Chinese, raw': 'Chinese cabbage, raw',
    'Cabbage, red, raw': 'Cabbage, red, raw',
    'Corn, fresh on cob, raw': 'Sweetcorn, on cob, raw',
    'Corn, kernels, canned in brine, drained': 'Corn kernels, canned',
    'Corn, kernels, purchased frozen, raw': 'Corn kernels, frozen, raw',
    'Pumpkin, peeled, fresh, raw': 'Pumpkin, generic, raw',
    'Pumpkin, peeled, fresh, baked, no added fat': 'Pumpkin, generic, baked',
    'Pumpkin, golden nugget, peeled, fresh, raw': 'Pumpkin, golden nugget, raw',
    'Pumpkin, jarrahdale, peeled, fresh, raw': 'Pumpkin, jarrahdale, raw',
    'Pumpkin, kent/jap, peeled, fresh, raw': 'Pumpkin, kent/jap, raw',
    'Pumpkin, butternut, peeled, fresh, raw': 'Pumpkin, butternut, raw',
    'Pumpkin, Queensland blue, peeled, fresh, raw': 'Pumpkin, Queensland blue, raw',
    'Pumpkin, butternut, peeled, fresh, baked, no added fat': 'Pumpkin, butternut, baked',
    'Pumpkin, Queensland blue, peeled, fresh, baked, no added fat': 'Pumpkin, Queensland blue, baked',
    'Squash, button, fresh, raw': 'Button squash, raw',
    'Squash, scallopini, fresh, raw': 'Scallopini squash, raw',
    'Rhubarb, stalk, raw': 'Rhubarb, raw',
    'Tamarillo, peeled, raw': 'Tamarillo, raw',
    'Cassava, peeled, fresh, raw': 'Cassava, raw',
    'Kohlrabi, peeled, fresh, raw': 'Kohlrabi, raw',
    'Chicory, raw': 'Chicory, raw',
    'Endive, fresh, raw': 'Endive, raw',
    'Radish, red skinned, unpeeled, raw': 'Radish, red, raw',
    'Radish, white skinned, peeled, raw': 'Radish, white, raw',
    'Choko, peeled, fresh, raw': 'Choko, raw',
    'Sprout, alfalfa, fresh, raw': 'Alfalfa sprouts, raw',
    'Sprout, bean, fresh, raw': 'Bean sprouts, raw',
    'Mixed leafy greens, pre-packaged, all types': 'Mixed leafy greens',
    'Asparagus, canned in brine, drained': 'Asparagus, canned',
    'Beetroot, canned': 'Beetroot, canned',
    'Tomato, canned': 'Tomato, canned',
    'Olive, green or black, drained': 'Olives',
    'Nut, brazil, raw or blanched, unsalted': 'Brazil nuts, raw',
    'Nut, pine, raw, unsalted': 'Pine nuts, raw',
    'Nut, peanut, with skin, raw, unsalted': 'Peanuts, raw',
    'Peanuts, roasted': 'Peanuts, roasted',
    'Flour, wheat, white, plain': 'Flour, plain white',
    'Flour, wheat, white, self-raising': 'Flour, self-raising',
    'Flour, wheat, wholemeal, plain': 'Flour, wholemeal',
    'Flour, chickpea (besan)': 'Chickpea flour (besan)',
    'Flour, rice': 'Rice flour',
    'Flour, rye': 'Rye flour',
    'Flour, gluten free, plain': 'Flour, gluten free',
    'Cornmeal (polenta), uncooked': 'Polenta, dry',
    'Millet, uncooked': 'Millet, dry',
    'Spelt, uncooked': 'Spelt grain, dry',
    'Rye, grain, whole, uncooked': 'Rye grain, dry',
    'Buckwheat groats, uncooked': 'Buckwheat, dry',
    'Semolina, uncooked': 'Semolina, dry',
    'Noodle, soba, dry': 'Soba noodles, dry',
    'Noodle, wheat, fresh, soaked, drained': 'Wheat noodles, fresh',
    'Noodle, wheat, instant, flavoured, dry, uncooked': 'Instant noodles, flavoured, dry',
    'Noodle, wheat, instant, unflavoured, dry, uncooked': 'Instant noodles, unflavoured, dry',
    'Oat beverage, fluid, added Ca': 'Oat milk, with calcium',
    'Oat beverage, fluid, unfortified': 'Oat milk, unsweetened',
    'Rice beverage, fluid, added calcium': 'Rice milk, with calcium',
    'Rice beverage, unfortified': 'Rice milk, unsweetened',
    'Coconut beverage, added Ca': 'Coconut milk (beverage), with calcium',
    'Coconut beverage, unfortified': 'Coconut milk (beverage), unsweetened',
    'Coffee, black, from instant coffee powder': 'Coffee, instant, black',
    'Coffee, espresso, from ground coffee beans': 'Coffee, espresso',
    'Coffee, flat white/latte/cappuccino, from ground coffee beans, with regular fat cow\'s milk': 'Coffee, flat white/latte',
    'Coffee, long black, from ground coffee beans': 'Coffee, long black',
    'Coffee, instant, dry powder or granules': 'Coffee, instant powder',
    'Cider, apple (alcohol ~4-5% v/v)': 'Cider, apple',
    'Mineral water, natural, unflavoured': 'Mineral water',
    'Mineral water, citrus flavoured': 'Mineral water, citrus',
    'Cordial, fruit juice/flavours, recommended dilution': 'Cordial, fruit flavoured',
    'Chocolate, dark, high cocoa solids': 'Dark chocolate, >70%',
    'Chocolate, dark, no added sugar': 'Dark chocolate, no added sugar',
    'Chocolate, milk': 'Milk chocolate',
    'Muffin, English style, from white flour': 'English muffin',
    'Pancake, plain, homemade': 'Pancake, plain',
    'Dressing, French or Italian, regular fat, commercial': 'French/Italian dressing',
    'Dressing, thousand island, regular fat, commercial': 'Thousand island dressing',
    'Confectionery, dried fruit & nuts, chocolate-coated': 'Choc-coated fruit & nut',
    'Potato crisps or chips, plain, salted': 'Potato chips, plain',
    'Corn chips, plain, salted': 'Corn chips, plain',
    'Potato wedges, regular, purchased frozen, baked or roasted, no added fat': 'Potato wedges, baked',
    'Potato, fries, fast food outlet, deep fried, monounsaturated oil, salted': 'Hot chips, fast food',
    'Potato, fries, independent takeaway outlet, deep fried, blended oil, salted': 'Hot chips, takeaway',
    'Psyllium, uncooked': 'Psyllium husks',
    'Custard, vanilla, regular fat': 'Custard, vanilla',
    'Porridge, rolled oats, prepared with water': 'Porridge, made with water',
    'Porridge, rolled oats, prepared with regular fat cow\'s milk': 'Porridge, made with milk',
    'Sauce, cranberry, commercial': 'Cranberry sauce',
    'Sauce, hoi sin (hoisin), commercial': 'Hoisin sauce',
    'Sauce, pasta or simmer, commercial, low fat': 'Pasta sauce, low fat',
    'Sauce, pasta, basil pesto, commercial': 'Pesto, basil',
    'Sauce, pasta, bolognese, homemade using beef mince & commercial tomato based sauce': 'Bolognese sauce, homemade',
    'Chutney or relish, commercial': 'Chutney',
    'Paste, Indian style curry, commercial': 'Curry paste, Indian style',
    'Paste, green curry, commercial': 'Curry paste, green',
    'Paste, shrimp': 'Shrimp paste',
    'Paste, soybean': 'Soybean paste',
    'Prawn, flesh, cooked from raw, no added fat': 'Prawn, cooked',
    'Morwong, fillet, raw': 'Morwong fillet, raw',
    'Mulloway, fillet, raw': 'Mulloway fillet, raw',
    'Milkfish, aquacultured, fillet, raw': 'Milkfish fillet, raw',
    'Cod, smoked, raw': 'Smoked cod, raw',
    'Beef, steak, boneless, fillet or tenderloin, lean, raw': 'Beef eye fillet, lean, raw',
    'Beef, steak, boneless, scotch fillet, lean, raw': 'Beef scotch fillet, lean, raw',
    'Beef, steak, boneless, round, lean, raw': 'Beef round steak, lean, raw',
    'Beef, steak, with bone, T-bone, lean, raw': 'Beef T-bone steak, lean, raw',
    'Beef, steak, boneless or bone-in, blade, lean, raw': 'Beef blade steak, lean, raw',
    'Beef, sirloin steak, lean, raw': 'Beef sirloin steak, lean, raw',
    'Beef, rump steak, lean, grilled, no added fat': 'Beef rump steak, lean, cooked',
    'Beef, topside roast, lean, raw': 'Beef topside roast, lean, raw',
    'Beef, silverside roast, lean, raw': 'Beef silverside roast, lean, raw',
    'Lamb, stir-fry strips, lean, raw': 'Lamb stir-fry strips, lean, raw',
    'Lamb, fillet, lean, raw': 'Lamb fillet, lean, raw',
    'Lamb, steak, boneless, lean, raw': 'Lamb steak, lean, raw',
    'Lamb, leg roast, lean, raw': 'Lamb leg roast, lean, raw',
    'Lamb, roasting piece, shoulder, lean, raw': 'Lamb shoulder roast, lean, raw',
    'Lamb, mince, raw': 'Lamb mince, raw',
    'Lamb, liver, grilled, no added fat': 'Lamb liver, cooked',
    'Lamb, eye of loin, lean, raw': 'Lamb eye of loin, lean, raw',
    'Pork, stir-fry strips, raw': 'Pork stir-fry strips, raw',
    'Pork, scotch roast, lean, raw': 'Pork scotch roast, lean, raw',
    'Pork, spare ribs, untrimmed, raw': 'Pork spare ribs, raw',
    'Frankfurt, cooked': 'Frankfurt (hot dog), cooked',
    'Chorizo, raw': 'Chorizo, raw',
    'Dripping, beef': 'Beef dripping',
    'Margarine': 'Margarine',
    'Mirin': 'Mirin',
    'Capers': 'Capers',
    'Beef stock': 'Beef stock',
    'Chicken stock': 'Chicken stock',
    'Vegetable stock': 'Vegetable stock',
    'Vinegar': 'Vinegar, white',
    'Balsamic vinegar': 'Balsamic vinegar',
    'Honey': 'Honey',
    'Golden syrup': 'Golden syrup',
    'Molasses': 'Molasses',
    'Jam, fruit': 'Jam, fruit',
    'Chutney or relish, commercial': 'Chutney',
    'Mustard, cream style': 'Mustard, cream style',
    'Mayonnaise': 'Mayonnaise',
    'Mayonnaise, reduced fat': 'Mayonnaise, reduced fat',
    'Hummus': 'Hummus',
    'Guacamole': 'Guacamole',
    'Tzatziki': 'Tzatziki',
    'Vegemite': 'Vegemite',
    'Marmite': 'Marmite',
    'Psyllium, uncooked': 'Psyllium husks',
    'Cocoa powder': 'Cocoa powder',
    'Croissant, plain': 'Croissant',
    'Confectionery, dried fruit & nuts, chocolate-coated': 'Choc-coated fruit & nut',
    'Muesli, toasted, added dried fruit & nuts, unfortified': 'Muesli, toasted',
    'Muesli, untoasted or natural style, added dried fruit, unfortified': 'Muesli, untoasted',
    'Muesli, granola, toasted, added nuts & seeds, unfortified': 'Granola',
    'Muesli, granola, non-oat based, toasted, added nuts & seeds, unfortified': 'Granola, non-oat',
    'Weet-Bix': 'Weet-Bix',
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
        if name not in KEEP_EXACT:
            to_delete.append(food_id)
            continue

        new_name = RENAMES.get(name, name)

        # Dedup after rename
        if new_name in seen_names:
            to_delete.append(food_id)
            continue

        seen_names[new_name] = food_id
        if new_name != name:
            to_rename.append((new_name, food_id))

    print(f"To delete: {len(to_delete)}")
    print(f"To rename: {len(to_rename)}")
    print(f"To keep: {len(foods) - len(to_delete)}")

    if to_delete:
        for i in range(0, len(to_delete), 200):
            batch = to_delete[i:i+200]
            placeholders = ','.join(['%s'] * len(batch))
            cursor.execute(f"DELETE FROM food_servings WHERE foodId IN ({placeholders})", batch)
            cursor.execute(f"DELETE FROM nutrition_foods WHERE id IN ({placeholders})", batch)
        conn.commit()
        print(f"Deleted {len(to_delete)} foods.")

    if to_rename:
        for new_name, food_id in to_rename:
            cursor.execute("UPDATE nutrition_foods SET name = %s WHERE id = %s", (new_name, food_id))
        conn.commit()
        print(f"Renamed {len(to_rename)} foods.")

    cursor.execute("SELECT COUNT(*) FROM nutrition_foods")
    final_count = cursor.fetchone()[0]
    print(f"\nFinal food count: {final_count}")

    cursor.execute("SELECT name FROM nutrition_foods ORDER BY name")
    all_foods = [r[0] for r in cursor.fetchall()]
    with open('/tmp/final_foods.txt', 'w') as f:
        for n in all_foods:
            f.write(n + '\n')
    print(f"Written to /tmp/final_foods.txt")

    print("\nSample (first 50):")
    for n in all_foods[:50]:
        print(f"  {n}")

    cursor.close()
    conn.close()
    print("\nDone!")


if __name__ == '__main__':
    main()
