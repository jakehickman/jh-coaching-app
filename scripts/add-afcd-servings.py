#!/usr/bin/env python3
"""
Add practical serving sizes to AFCD foods in the food_servings table.
Updated to match simplified food names after cleanup.
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

def get_servings(name: str) -> list[tuple[str, float, int]]:
    """
    Returns list of (label, grams, sort_order) tuples for a food name.
    Returns empty list if no specific serving applies (100g default will be used).
    Matches against simplified names post-cleanup.
    """
    n = name.lower()

    # ── EGGS ──────────────────────────────────────────────────────────────────
    if n.startswith('egg, whole'):
        return [('1 egg (large)', 60, 1), ('1 egg (medium)', 50, 2)]
    if n.startswith('egg yolk'):
        return [('1 yolk', 18, 1)]
    if n.startswith('egg white'):
        return [('1 white', 33, 1)]
    if 'egg' in n:
        return [('1 egg (60g)', 60, 1)]

    # ── CHICKEN ───────────────────────────────────────────────────────────────
    if 'chicken breast' in n:
        return [('1 breast (large)', 200, 1), ('1 breast (small)', 130, 2)]
    if 'chicken thigh' in n:
        return [('1 thigh', 120, 1)]
    if 'chicken drumstick' in n:
        return [('1 drumstick', 90, 1)]
    if 'chicken wing' in n:
        return [('1 wing', 50, 1)]
    if 'chicken mince' in n:
        return [('150g serve', 150, 1), ('1 cup (cooked)', 200, 2)]
    if 'chicken liver' in n:
        return [('100g serve', 100, 1)]
    if 'chicken' in n and 'sausage' in n:
        return [('1 sausage (80g)', 80, 1), ('2 sausages (160g)', 160, 2)]
    if 'chicken deli' in n:
        return [('2 slices (40g)', 40, 1)]
    if n.startswith('chicken'):
        return [('150g serve', 150, 1)]

    # ── BEEF ──────────────────────────────────────────────────────────────────
    if 'beef' in n and 'steak' in n:
        return [('1 steak (200g)', 200, 1), ('1 steak (150g)', 150, 2)]
    if 'beef mince' in n or 'beef, mince' in n:
        return [('150g serve', 150, 1), ('1 cup (cooked)', 200, 2)]
    if 'beef' in n and ('diced' in n or 'stir-fry' in n or 'strips' in n):
        return [('150g serve', 150, 1)]
    if 'beef eye fillet' in n:
        return [('1 steak (200g)', 200, 1), ('1 steak (150g)', 150, 2)]
    if 'beef sausage' in n:
        return [('1 sausage (80g)', 80, 1), ('2 sausages (160g)', 160, 2)]
    if n.startswith('beef'):
        return [('150g serve', 150, 1)]

    # ── PORK ──────────────────────────────────────────────────────────────────
    if 'pork' in n and ('chop' in n or 'cutlet' in n):
        return [('1 chop (150g)', 150, 1)]
    if 'pork' in n and 'steak' in n:
        return [('1 steak (150g)', 150, 1)]
    if 'pork fillet' in n:
        return [('150g serve', 150, 1)]
    if 'pork mince' in n:
        return [('150g serve', 150, 1)]
    if 'pork belly' in n:
        return [('150g serve', 150, 1)]
    if 'pork sausage' in n:
        return [('1 sausage (80g)', 80, 1), ('2 sausages (160g)', 160, 2)]
    if 'pork' in n and 'strips' in n:
        return [('150g serve', 150, 1)]
    if n.startswith('pork'):
        return [('150g serve', 150, 1)]
    if 'bacon' in n:
        return [('1 rasher', 25, 1), ('2 rashers', 50, 2)]
    if 'ham' in n:
        return [('2 slices (40g)', 40, 1), ('4 slices (80g)', 80, 2)]
    if 'salami' in n:
        return [('4 slices (30g)', 30, 1)]
    if 'prosciutto' in n:
        return [('3 slices (30g)', 30, 1)]

    # ── LAMB ──────────────────────────────────────────────────────────────────
    if 'lamb' in n and ('chop' in n or 'cutlet' in n or 'rack' in n):
        return [('1 chop (120g)', 120, 1), ('2 chops', 240, 2)]
    if 'lamb mince' in n:
        return [('150g serve', 150, 1), ('1 cup (cooked)', 200, 2)]
    if 'lamb' in n and ('diced' in n or 'strips' in n or 'stir-fry' in n):
        return [('150g serve', 150, 1)]
    if n.startswith('lamb'):
        return [('150g serve', 150, 1)]

    # ── TURKEY ────────────────────────────────────────────────────────────────
    if 'turkey breast' in n:
        return [('1 breast (200g)', 200, 1), ('150g serve', 150, 2)]
    if n.startswith('turkey'):
        return [('150g serve', 150, 1)]

    # ── VEAL ──────────────────────────────────────────────────────────────────
    if 'veal' in n and ('cutlet' in n or 'steak' in n):
        return [('1 cutlet (150g)', 150, 1)]
    if n.startswith('veal'):
        return [('150g serve', 150, 1)]

    # ── KANGAROO / VENISON ────────────────────────────────────────────────────
    if 'kangaroo' in n or 'venison' in n:
        return [('150g serve', 150, 1)]

    # ── FISH & SEAFOOD ────────────────────────────────────────────────────────
    if 'salmon' in n and 'fillet' in n:
        return [('1 fillet (180g)', 180, 1), ('1 fillet (150g)', 150, 2)]
    if 'salmon' in n and 'canned' in n:
        return [('1 can (95g drained)', 95, 1)]
    if 'salmon, smoked' in n or 'salmon smoked' in n:
        return [('3 slices (50g)', 50, 1)]
    if 'tuna' in n and 'canned' in n:
        return [('1 can (95g drained)', 95, 1)]
    if 'tuna' in n and 'fillet' in n:
        return [('1 fillet (180g)', 180, 1)]
    if 'sardine' in n and 'canned' in n:
        return [('1 can (95g drained)', 95, 1)]
    if 'sardine' in n:
        return [('3 sardines (90g)', 90, 1)]
    if 'anchovy' in n:
        return [('1 can (50g drained)', 50, 1)]
    if 'barramundi' in n or 'snapper' in n or 'bream' in n or 'flathead' in n or 'whiting' in n or 'hoki' in n or 'basa' in n or 'tilapia' in n or 'silver perch' in n or 'shark' in n:
        return [('1 fillet (180g)', 180, 1), ('1 fillet (150g)', 150, 2)]
    if 'trout' in n or 'ocean trout' in n or 'rainbow trout' in n:
        return [('1 fillet (150g)', 150, 1)]
    if 'prawn' in n:
        return [('6 prawns (100g)', 100, 1), ('12 prawns (200g)', 200, 2)]
    if 'scallop' in n:
        return [('6 scallops (100g)', 100, 1)]
    if 'mussel' in n:
        return [('6 mussels (90g)', 90, 1)]
    if 'oyster' in n:
        return [('6 oysters (90g)', 90, 1), ('12 oysters (180g)', 180, 2)]
    if 'calamari' in n or 'squid' in n:
        return [('150g serve', 150, 1)]
    if 'octopus' in n:
        return [('150g serve', 150, 1)]
    if 'crab' in n:
        return [('100g serve', 100, 1)]
    if 'lobster' in n:
        return [('150g serve', 150, 1)]
    if 'abalone' in n:
        return [('100g serve', 100, 1)]

    # ── DAIRY ─────────────────────────────────────────────────────────────────
    if 'milk, full fat' in n or 'milk, reduced fat' in n or 'milk, skim' in n or 'milk, lactose' in n:
        return [('1 cup (250ml)', 258, 1), ('½ cup (125ml)', 129, 2)]
    if 'milk, evaporated' in n:
        return [('¼ cup (60ml)', 60, 1), ('½ cup (120ml)', 120, 2)]
    if 'condensed milk' in n:
        return [('2 tbsp (40g)', 40, 1)]
    if 'chocolate milk' in n:
        return [('1 cup (250ml)', 258, 1)]
    if 'milk powder' in n:
        return [('2 tbsp (20g)', 20, 1)]
    if 'almond milk' in n or 'soy milk' in n or 'oat milk' in n or 'rice milk' in n or 'coconut milk (beverage)' in n:
        return [('1 cup (250ml)', 258, 1), ('½ cup (125ml)', 129, 2)]
    if 'yoghurt' in n:
        return [('1 tub (170g)', 170, 1), ('½ cup (125g)', 125, 2)]
    if 'cheese, cheddar' in n:
        return [('1 slice (25g)', 25, 1), ('¼ cup grated (30g)', 30, 2)]
    if 'cheese, mozzarella' in n:
        return [('¼ cup (30g)', 30, 1), ('50g serve', 50, 2)]
    if 'cheese, parmesan' in n:
        return [('2 tbsp (10g)', 10, 1)]
    if 'cheese, feta' in n:
        return [('50g serve', 50, 1)]
    if 'cheese, haloumi' in n:
        return [('2 slices (60g)', 60, 1)]
    if 'cheese, ricotta' in n:
        return [('½ cup (125g)', 125, 1)]
    if 'cheese, cottage' in n:
        return [('½ cup (125g)', 125, 1)]
    if 'cream cheese' in n:
        return [('2 tbsp (30g)', 30, 1)]
    if 'cheese, bocconcini' in n:
        return [('1 ball (50g)', 50, 1)]
    if 'cheese, brie' in n or 'cheese, camembert' in n:
        return [('2 slices (30g)', 30, 1)]
    if 'cheese, blue vein' in n:
        return [('30g serve', 30, 1)]
    if 'cheese, goat' in n:
        return [('30g serve', 30, 1)]
    if 'cheese, edam' in n:
        return [('1 slice (25g)', 25, 1)]
    if n.startswith('cheese'):
        return [('30g serve', 30, 1)]
    if 'butter' in n:
        return [('1 tsp (5g)', 5, 1), ('1 tbsp (15g)', 15, 2)]
    if 'sour cream' in n:
        return [('1 tbsp (20g)', 20, 1), ('¼ cup (60g)', 60, 2)]
    if 'cream, thickened' in n:
        return [('1 tbsp (20g)', 20, 1), ('¼ cup (60g)', 60, 2)]
    if n.startswith('cream'):
        return [('2 tbsp (30g)', 30, 1)]
    if 'protein powder' in n:
        return [('1 scoop (30g)', 30, 1)]

    # ── BREAD & GRAINS ────────────────────────────────────────────────────────
    if 'pita bread' in n or 'naan bread' in n or 'turkish bread' in n:
        return [('1 piece (65g)', 65, 1)]
    if 'wrap' in n or 'tortilla' in n:
        return [('1 wrap (45g)', 45, 1)]
    if n.startswith('bread') or 'bread roll' in n:
        return [('1 slice (35g)', 35, 1), ('2 slices (70g)', 70, 2)]
    if 'bagel' in n:
        return [('1 bagel (90g)', 90, 1)]
    if 'burger bun' in n or 'bun' in n:
        return [('1 bun (60g)', 60, 1)]
    if 'breadcrumbs' in n:
        return [('2 tbsp (20g)', 20, 1)]
    if 'crumpet' in n:
        return [('1 crumpet (75g)', 75, 1)]
    if 'rice cake' in n:
        return [('1 rice cake (9g)', 9, 1), ('2 rice cakes (18g)', 18, 2)]
    if 'corn thins' in n:
        return [('2 corn thins (14g)', 14, 1)]
    if 'taco shell' in n:
        return [('1 shell (12g)', 12, 1), ('2 shells (24g)', 24, 2)]
    if 'cracker' in n or 'crispbread' in n:
        return [('2 crackers (16g)', 16, 1), ('4 crackers (32g)', 32, 2)]
    if 'oat bran' in n:
        return [('2 tbsp (15g)', 15, 1)]
    if 'oats, rolled' in n or 'oats, hulled' in n:
        return [('½ cup dry (45g)', 45, 1), ('1 cup dry (90g)', 90, 2)]
    if 'rice, white, dry' in n:
        return [('¼ cup dry (45g)', 45, 1), ('½ cup dry (90g)', 90, 2)]
    if 'rice, white, cooked' in n:
        return [('½ cup cooked (90g)', 90, 1), ('1 cup cooked (180g)', 180, 2)]
    if 'rice, brown, dry' in n:
        return [('¼ cup dry (45g)', 45, 1), ('½ cup dry (90g)', 90, 2)]
    if 'rice, brown, cooked' in n:
        return [('½ cup cooked (90g)', 90, 1), ('1 cup cooked (180g)', 180, 2)]
    if n.startswith('rice'):
        return [('½ cup (90g)', 90, 1)]
    if 'pasta' in n and 'cooked' in n:
        return [('1 cup cooked (180g)', 180, 1), ('1½ cups cooked (270g)', 270, 2)]
    if 'pasta' in n and 'dry' in n:
        return [('75g dry', 75, 1)]
    if 'quinoa, dry' in n:
        return [('¼ cup dry (45g)', 45, 1)]
    if 'quinoa, cooked' in n:
        return [('½ cup cooked (90g)', 90, 1), ('1 cup cooked (180g)', 180, 2)]
    if 'couscous, dry' in n:
        return [('¼ cup dry (45g)', 45, 1)]
    if 'couscous, cooked' in n:
        return [('½ cup cooked (90g)', 90, 1)]
    if 'barley' in n and 'cooked' in n:
        return [('½ cup cooked (90g)', 90, 1)]
    if 'barley' in n and 'dry' in n:
        return [('¼ cup dry (45g)', 45, 1)]
    if 'bulgur' in n:
        return [('¼ cup dry (45g)', 45, 1)]
    if 'buckwheat' in n:
        return [('¼ cup dry (45g)', 45, 1)]
    if 'semolina' in n:
        return [('¼ cup dry (40g)', 40, 1)]
    if 'wheat bran' in n:
        return [('2 tbsp (15g)', 15, 1)]
    if 'wheat germ' in n:
        return [('2 tbsp (15g)', 15, 1)]
    if 'flour' in n:
        return [('¼ cup (30g)', 30, 1), ('½ cup (60g)', 60, 2)]
    if 'muesli' in n and 'bar' not in n:
        return [('½ cup (45g)', 45, 1)]
    if 'weet-bix' in n or 'wheat biscuit' in n:
        return [('2 biscuits (30g)', 30, 1)]
    if 'breakfast cereal' in n:
        return [('½ cup (30g)', 30, 1), ('1 cup (60g)', 60, 2)]
    if 'noodle' in n or 'soba' in n:
        return [('1 cup cooked (180g)', 180, 1)]
    if 'soba noodles' in n:
        return [('1 cup cooked (180g)', 180, 1)]

    # ── LEGUMES ───────────────────────────────────────────────────────────────
    if 'chickpeas' in n and ('canned' in n or 'cooked' in n):
        return [('½ cup (90g)', 90, 1), ('1 cup (180g)', 180, 2)]
    if 'chickpeas, dry' in n:
        return [('¼ cup dry (50g)', 50, 1)]
    if 'lentils' in n and 'cooked' in n:
        return [('½ cup (100g)', 100, 1), ('1 cup (200g)', 200, 2)]
    if 'lentils' in n and 'dry' in n:
        return [('¼ cup dry (50g)', 50, 1)]
    if ('beans' in n or 'bean' in n) and ('canned' in n or 'cooked' in n):
        return [('½ cup (90g)', 90, 1), ('1 cup (180g)', 180, 2)]
    if 'baked beans' in n:
        return [('½ cup (130g)', 130, 1), ('1 cup (260g)', 260, 2)]
    if 'edamame' in n:
        return [('½ cup (80g)', 80, 1)]
    if 'tofu' in n:
        return [('½ cup (130g)', 130, 1), ('100g serve', 100, 2)]
    if 'tvp' in n or 'soy mince' in n:
        return [('¼ cup dry (25g)', 25, 1)]
    if 'split peas' in n:
        return [('¼ cup dry (50g)', 50, 1)]
    if 'peas, raw' in n:
        return [('½ cup (80g)', 80, 1), ('1 cup (160g)', 160, 2)]

    # ── NUTS & SEEDS ──────────────────────────────────────────────────────────
    if 'almonds, raw' in n or 'almonds, roasted' in n:
        return [('10 almonds (14g)', 14, 1), ('¼ cup (35g)', 35, 2)]
    if 'almond meal' in n:
        return [('¼ cup (25g)', 25, 1)]
    if 'cashews' in n:
        return [('10 cashews (15g)', 15, 1), ('¼ cup (35g)', 35, 2)]
    if 'walnuts' in n:
        return [('4 halves (15g)', 15, 1), ('¼ cup (30g)', 30, 2)]
    if 'macadamia' in n:
        return [('10 nuts (15g)', 15, 1), ('¼ cup (35g)', 35, 2)]
    if 'pistachios' in n:
        return [('¼ cup (30g)', 30, 1)]
    if 'pecans' in n:
        return [('10 halves (14g)', 14, 1), ('¼ cup (28g)', 28, 2)]
    if 'hazelnuts' in n:
        return [('10 nuts (15g)', 15, 1), ('¼ cup (35g)', 35, 2)]
    if 'peanut butter' in n:
        return [('1 tbsp (20g)', 20, 1), ('2 tbsp (40g)', 40, 2)]
    if 'peanut' in n:
        return [('¼ cup (35g)', 35, 1)]
    if 'chia seeds' in n:
        return [('1 tbsp (12g)', 12, 1), ('2 tbsp (24g)', 24, 2)]
    if 'flaxseed' in n or 'linseed' in n:
        return [('1 tbsp (10g)', 10, 1), ('2 tbsp (20g)', 20, 2)]
    if 'sesame seeds' in n:
        return [('1 tbsp (9g)', 9, 1)]
    if 'sunflower seeds' in n:
        return [('2 tbsp (18g)', 18, 1), ('¼ cup (35g)', 35, 2)]
    if 'pumpkin seeds' in n:
        return [('2 tbsp (18g)', 18, 1), ('¼ cup (35g)', 35, 2)]
    if 'tahini' in n:
        return [('1 tbsp (20g)', 20, 1)]
    if 'seed' in n:
        return [('2 tbsp (20g)', 20, 1)]
    if 'nut' in n or 'nuts' in n:
        return [('¼ cup (30g)', 30, 1)]

    # ── OILS & FATS ───────────────────────────────────────────────────────────
    if 'oil' in n or 'ghee' in n:
        return [('1 tsp (5g)', 5, 1), ('1 tbsp (14g)', 14, 2)]
    if 'margarine' in n:
        return [('1 tsp (5g)', 5, 1), ('1 tbsp (15g)', 15, 2)]
    if 'mayonnaise' in n:
        return [('1 tbsp (20g)', 20, 1)]

    # ── FRUITS ────────────────────────────────────────────────────────────────
    if 'apple' in n and 'raw' in n:
        return [('1 medium (150g)', 150, 1), ('1 large (200g)', 200, 2)]
    if 'banana' in n and 'raw' in n:
        return [('1 medium (120g)', 120, 1), ('1 large (150g)', 150, 2)]
    if 'orange' in n and 'raw' in n:
        return [('1 medium (180g)', 180, 1)]
    if 'mango' in n and 'raw' in n:
        return [('1 medium (200g)', 200, 1), ('½ mango (100g)', 100, 2)]
    if 'mango' in n and 'frozen' in n:
        return [('1 cup (150g)', 150, 1)]
    if 'pineapple' in n and 'raw' in n:
        return [('1 cup chunks (165g)', 165, 1), ('2 slices (100g)', 100, 2)]
    if 'pineapple' in n and ('frozen' in n or 'canned' in n):
        return [('1 cup (150g)', 150, 1)]
    if 'strawberry' in n:
        return [('1 cup (150g)', 150, 1), ('6 berries (90g)', 90, 2)]
    if 'blueberry' in n:
        return [('½ cup (75g)', 75, 1), ('1 cup (150g)', 150, 2)]
    if 'raspberry' in n:
        return [('½ cup (60g)', 60, 1), ('1 cup (120g)', 120, 2)]
    if 'blackberry' in n:
        return [('½ cup (70g)', 70, 1), ('1 cup (140g)', 140, 2)]
    if 'grape' in n and 'raw' in n:
        return [('½ cup (80g)', 80, 1), ('1 cup (160g)', 160, 2)]
    if 'watermelon' in n:
        return [('1 cup diced (150g)', 150, 1), ('2 cups diced (300g)', 300, 2)]
    if 'peach' in n and 'raw' in n:
        return [('1 medium (150g)', 150, 1)]
    if 'pear' in n and 'raw' in n:
        return [('1 medium (170g)', 170, 1)]
    if 'kiwifruit' in n:
        return [('1 kiwifruit (75g)', 75, 1), ('2 kiwifruits (150g)', 150, 2)]
    if 'avocado' in n:
        return [('½ avocado (75g)', 75, 1), ('1 avocado (150g)', 150, 2)]
    if 'apricot' in n and 'raw' in n:
        return [('2 apricots (100g)', 100, 1)]
    if 'apricot' in n and 'dried' in n:
        return [('5 halves (30g)', 30, 1)]
    if 'cherry' in n and 'raw' in n:
        return [('½ cup (75g)', 75, 1), ('1 cup (150g)', 150, 2)]
    if 'plum' in n and 'raw' in n:
        return [('2 plums (130g)', 130, 1)]
    if 'prune' in n:
        return [('5 prunes (50g)', 50, 1)]
    if 'date' in n:
        return [('3 dates (30g)', 30, 1)]
    if 'fig' in n and 'raw' in n:
        return [('2 figs (100g)', 100, 1)]
    if 'fig' in n and 'dried' in n:
        return [('2 dried figs (30g)', 30, 1)]
    if 'raisin' in n or 'sultana' in n or 'currant' in n:
        return [('2 tbsp (30g)', 30, 1)]
    if 'lemon' in n and 'raw' in n:
        return [('1 lemon (80g)', 80, 1), ('½ lemon (40g)', 40, 2)]
    if 'lime' in n and 'raw' in n:
        return [('1 lime (60g)', 60, 1)]
    if 'grapefruit' in n:
        return [('½ grapefruit (150g)', 150, 1)]
    if 'mandarin' in n:
        return [('1 mandarin (80g)', 80, 1), ('2 mandarins (160g)', 160, 2)]
    if 'passionfruit' in n:
        return [('1 passionfruit (30g)', 30, 1), ('2 passionfruits (60g)', 60, 2)]
    if 'rockmelon' in n or 'cantaloupe' in n:
        return [('1 cup diced (160g)', 160, 1)]
    if 'honeydew' in n:
        return [('1 cup diced (170g)', 170, 1)]
    if 'papaya' in n or 'pawpaw' in n:
        return [('1 cup (145g)', 145, 1)]
    if 'lychee' in n:
        return [('6 lychees (90g)', 90, 1)]
    if 'pomegranate' in n:
        return [('½ pomegranate (150g)', 150, 1)]
    if 'nectarine' in n:
        return [('1 nectarine (150g)', 150, 1)]
    if 'coconut cream' in n or 'coconut milk' in n:
        return [('¼ cup (60ml)', 60, 1), ('½ cup (120ml)', 120, 2)]
    if 'coconut' in n:
        return [('2 tbsp (15g)', 15, 1)]

    # ── VEGETABLES ────────────────────────────────────────────────────────────
    if 'broccoli' in n:
        return [('1 cup (90g)', 90, 1), ('2 cups (180g)', 180, 2)]
    if 'broccolini' in n:
        return [('1 bunch (80g)', 80, 1)]
    if 'spinach, baby' in n:
        return [('1 cup raw (30g)', 30, 1), ('2 cups raw (60g)', 60, 2)]
    if 'spinach' in n:
        return [('1 cup raw (30g)', 30, 1), ('2 cups raw (60g)', 60, 2)]
    if 'kale' in n:
        return [('1 cup raw (30g)', 30, 1), ('2 cups raw (60g)', 60, 2)]
    if 'sweet potato' in n:
        return [('1 medium (150g)', 150, 1), ('1 large (200g)', 200, 2)]
    if 'potato' in n and 'sweet' not in n and 'chip' not in n:
        return [('1 medium (150g)', 150, 1), ('1 large (200g)', 200, 2)]
    if 'carrot' in n:
        return [('1 medium (80g)', 80, 1), ('2 medium (160g)', 160, 2)]
    if 'tomato, cherry' in n:
        return [('6 cherry tomatoes (90g)', 90, 1), ('1 cup (150g)', 150, 2)]
    if 'tomato, raw' in n or 'tomato, common' in n:
        return [('1 medium (120g)', 120, 1), ('2 medium (240g)', 240, 2)]
    if 'tomato paste' in n:
        return [('1 tbsp (18g)', 18, 1), ('2 tbsp (36g)', 36, 2)]
    if 'tomato puree' in n:
        return [('½ cup (125g)', 125, 1)]
    if 'tomato, sundried' in n:
        return [('¼ cup (30g)', 30, 1)]
    if 'tomato, canned' in n:
        return [('½ cup (130g)', 130, 1), ('1 cup (260g)', 260, 2)]
    if 'onion' in n and 'spring' not in n:
        return [('1 medium (110g)', 110, 1), ('½ onion (55g)', 55, 2)]
    if 'spring onion' in n or 'shallot' in n:
        return [('2 stalks (30g)', 30, 1)]
    if 'garlic' in n:
        return [('1 clove (5g)', 5, 1), ('2 cloves (10g)', 10, 2)]
    if 'ginger' in n and 'ground' not in n:
        return [('1 tsp grated (5g)', 5, 1), ('1 tbsp grated (15g)', 15, 2)]
    if 'capsicum' in n:
        return [('½ capsicum (80g)', 80, 1), ('1 capsicum (160g)', 160, 2)]
    if 'zucchini' in n:
        return [('1 medium (180g)', 180, 1), ('½ zucchini (90g)', 90, 2)]
    if 'cucumber' in n:
        return [('½ cucumber (150g)', 150, 1), ('1 cup sliced (120g)', 120, 2)]
    if 'mushroom' in n:
        return [('1 cup sliced (70g)', 70, 1), ('4 mushrooms (80g)', 80, 2)]
    if 'lettuce' in n:
        return [('1 cup shredded (50g)', 50, 1), ('2 cups shredded (100g)', 100, 2)]
    if 'rocket' in n:
        return [('1 cup (20g)', 20, 1), ('2 cups (40g)', 40, 2)]
    if 'asparagus' in n:
        return [('6 spears (90g)', 90, 1), ('12 spears (180g)', 180, 2)]
    if 'cauliflower' in n:
        return [('1 cup florets (100g)', 100, 1), ('2 cups florets (200g)', 200, 2)]
    if 'cabbage' in n:
        return [('1 cup shredded (70g)', 70, 1), ('2 cups shredded (140g)', 140, 2)]
    if 'brussels sprout' in n:
        return [('6 sprouts (90g)', 90, 1), ('1 cup (90g)', 90, 2)]
    if 'bok choy' in n or 'pak choy' in n:
        return [('1 cup (70g)', 70, 1), ('2 cups (140g)', 140, 2)]
    if 'silverbeet' in n or 'water spinach' in n:
        return [('1 cup (36g)', 36, 1)]
    if 'celery' in n:
        return [('1 stalk (40g)', 40, 1), ('2 stalks (80g)', 80, 2)]
    if 'beetroot' in n and 'raw' in n:
        return [('1 medium (80g)', 80, 1)]
    if 'beetroot' in n and 'canned' in n:
        return [('2 slices (50g)', 50, 1)]
    if 'pumpkin' in n and 'seed' not in n:
        return [('1 cup diced (120g)', 120, 1), ('200g serve', 200, 2)]
    if 'sweetcorn' in n or 'corn' in n:
        return [('1 cob (90g)', 90, 1), ('½ cup kernels (80g)', 80, 2)]
    if 'snow pea' in n:
        return [('1 cup (60g)', 60, 1)]
    if 'green bean' in n or 'green beans' in n:
        return [('1 cup (100g)', 100, 1)]
    if 'eggplant' in n:
        return [('1 cup diced (100g)', 100, 1)]
    if 'leek' in n:
        return [('1 leek (90g)', 90, 1)]
    if 'fennel' in n:
        return [('1 cup sliced (90g)', 90, 1)]
    if 'artichoke' in n:
        return [('1 artichoke (120g)', 120, 1)]
    if 'chilli' in n and 'fresh' in n:
        return [('1 chilli (15g)', 15, 1)]
    if 'bean sprout' in n:
        return [('½ cup (50g)', 50, 1)]
    if 'watercress' in n:
        return [('1 cup (34g)', 34, 1)]

    # ── CONDIMENTS & SAUCES ───────────────────────────────────────────────────
    if 'soy sauce' in n:
        return [('1 tbsp (18g)', 18, 1)]
    if 'fish sauce' in n:
        return [('1 tbsp (18g)', 18, 1)]
    if 'oyster sauce' in n:
        return [('1 tbsp (18g)', 18, 1)]
    if 'tomato sauce' in n or 'ketchup' in n:
        return [('1 tbsp (18g)', 18, 1), ('2 tbsp (36g)', 36, 2)]
    if 'worcestershire' in n:
        return [('1 tbsp (18g)', 18, 1)]
    if 'hot chilli sauce' in n or 'tabasco' in n:
        return [('1 tsp (5g)', 5, 1)]
    if 'bbq sauce' in n or 'barbecue sauce' in n:
        return [('1 tbsp (20g)', 20, 1)]
    if 'sweet chilli' in n:
        return [('1 tbsp (20g)', 20, 1)]
    if 'vinegar' in n:
        return [('1 tbsp (15g)', 15, 1)]
    if 'mustard' in n:
        return [('1 tsp (5g)', 5, 1), ('1 tbsp (15g)', 15, 2)]
    if 'honey' in n:
        return [('1 tsp (7g)', 7, 1), ('1 tbsp (21g)', 21, 2)]
    if 'maple syrup' in n or 'golden syrup' in n or 'molasses' in n:
        return [('1 tbsp (20g)', 20, 1)]
    if 'jam' in n or 'chutney' in n:
        return [('1 tbsp (20g)', 20, 1)]
    if 'vegemite' in n or 'marmite' in n:
        return [('1 tsp (5g)', 5, 1)]
    if 'hummus' in n:
        return [('2 tbsp (40g)', 40, 1)]
    if 'guacamole' in n:
        return [('2 tbsp (30g)', 30, 1)]
    if 'tzatziki' in n:
        return [('2 tbsp (30g)', 30, 1)]
    if 'stock' in n:
        return [('1 cup (250ml)', 250, 1)]

    # ── SPICES ────────────────────────────────────────────────────────────────
    if any(x in n for x in ['ground', 'dried', 'powder', 'spice', 'cumin', 'turmeric',
                             'cinnamon', 'cardamom', 'coriander', 'paprika', 'chilli powder',
                             'ginger, ground', 'cloves', 'fenugreek', 'sage', 'thyme, dried']):
        return [('1 tsp (3g)', 3, 1), ('1 tbsp (9g)', 9, 2)]

    # ── BEVERAGES ─────────────────────────────────────────────────────────────
    if 'coffee' in n:
        return [('1 cup (240ml)', 240, 1)]
    if 'tea' in n:
        return [('1 cup (240ml)', 240, 1)]
    if 'juice' in n:
        return [('½ cup (125ml)', 125, 1), ('1 cup (250ml)', 250, 2)]
    if 'cola' in n or 'soft drink' in n:
        return [('1 can (375ml)', 375, 1)]
    if 'beer' in n:
        return [('1 can (375ml)', 375, 1)]
    if 'cider' in n:
        return [('1 can (375ml)', 375, 1)]
    if 'wine' in n or 'rosé' in n:
        return [('1 glass (150ml)', 150, 1)]
    if 'port' in n or 'sherry' in n or 'dessert wine' in n:
        return [('1 glass (60ml)', 60, 1)]
    if 'spirit' in n or 'vodka' in n or 'gin' in n or 'rum' in n or 'whisky' in n:
        return [('1 nip (30ml)', 30, 1)]

    # ── MISC ──────────────────────────────────────────────────────────────────
    if 'chocolate, dark' in n or 'dark chocolate' in n:
        return [('2 squares (20g)', 20, 1), ('4 squares (40g)', 40, 2)]
    if 'chocolate, milk' in n or 'milk chocolate' in n:
        return [('2 squares (20g)', 20, 1), ('4 squares (40g)', 40, 2)]
    if 'muesli bar' in n or 'snack bar' in n or 'protein bar' in n or 'nut bar' in n:
        return [('1 bar (35g)', 35, 1)]
    if 'psyllium' in n:
        return [('1 tbsp (10g)', 10, 1)]

    # No specific serving — will use 100g default
    return []


def main():
    print("Connecting to database...")
    conn = mysql.connector.connect(**DB_PARAMS)
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM nutrition_foods ORDER BY id")
    foods = cursor.fetchall()
    print(f"Processing {len(foods)} foods...")

    cursor.execute("DELETE FROM food_servings")
    conn.commit()
    print("Cleared existing food_servings.")

    inserts = []
    foods_with_servings = 0
    foods_without = 0

    for food_id, food_name in foods:
        servings = get_servings(food_name)
        if servings:
            foods_with_servings += 1
            for label, grams, sort_order in servings:
                inserts.append((food_id, label, grams, sort_order))
        else:
            foods_without += 1

    print(f"Foods with custom servings: {foods_with_servings}")
    print(f"Foods without (100g only): {foods_without}")
    print(f"Total serving rows to insert: {len(inserts)}")

    insert_sql = "INSERT INTO food_servings (foodId, label, grams, sortOrder) VALUES (%s, %s, %s, %s)"
    batch_size = 500
    for i in range(0, len(inserts), batch_size):
        cursor.executemany(insert_sql, inserts[i:i+batch_size])
        conn.commit()

    cursor.execute("SELECT COUNT(*) FROM food_servings")
    count = cursor.fetchone()[0]
    print(f"\nInserted {count} serving rows into food_servings.")

    cursor.close()
    conn.close()
    print("Done!")


if __name__ == '__main__':
    main()
