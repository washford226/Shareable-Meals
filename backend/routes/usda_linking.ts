import mysql from "mysql2/promise";

const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
};

function convertToGrams(quantity: number, unit?: string): number {
  if (!unit) return quantity;
  switch (unit.toLowerCase()) {
    case "g":
    case "gram":
    case "grams":
      return quantity;
    case "kg":
    case "kilogram":
      return quantity * 1000;
    case "mg":
    case "milligram":
      return quantity / 1000;
    case "oz":
      return quantity * 28.3495;
    case "lb":
    case "lbs":
    case "pound":
      return quantity * 453.592;
    case "ml":
      return quantity;
    case "cup":
    case "cups":
      return quantity * 240;
    default:
      return quantity;
  }
}

export async function calculateAndStoreMealNutrition(
  mealId: number,
  db: mysql.Pool
) {
  const [ingredients]: any[] = await db.query(
    `SELECT quantity, unit, food_id, raw_name FROM meal_ingredients WHERE meal_id = ?`,
    [mealId]
  );

  // Fetch servings for this meal
  const [mealRows]: any[] = await db.query(
    `SELECT servings FROM meals WHERE id = ? LIMIT 1`,
    [mealId]
  );
  const servings = mealRows.length && mealRows[0].servings ? Number(mealRows[0].servings) : 1;

  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const ing of ingredients) {
    const foodId = ing.food_id;
    const rawName = ing.raw_name?.trim();
    if (!foodId) {
      console.warn(`Skipping ingredient with missing food_id:`, ing);
      continue;
    }
    if (!rawName) {
      console.warn(`Skipping ingredient with missing raw_name:`, ing);
      continue;
    }

    try {
      console.log(`Ingredient "${rawName}" (food_id ${foodId}): fetching fdc_id...`);

      // Fetch fdc_id for this food_id
      const [foodRows]: any[] = await db.query(
        `SELECT fdc_id FROM Foods WHERE food_id = ? LIMIT 1`,
        [foodId]
      );
      if (!foodRows.length || !foodRows[0].fdc_id) {
        console.warn(
          `No fdc_id found for food_id ${foodId}, skipping "${rawName}".`
        );
        continue;
      }
      const fdcId = foodRows[0].fdc_id;

      console.log(`Ingredient "${rawName}" (food_id ${foodId}): fetching nutrients...`);

      // Fetch nutrients by fdc_id
      const [nutrientRows]: any[] = await db.query(
        `SELECT 
          AVG(CASE WHEN nutrient_id = ? THEN amount END) AS calories,
          AVG(CASE WHEN nutrient_id = ? THEN amount END) AS protein,
          AVG(CASE WHEN nutrient_id = ? THEN amount END) AS fat,
          AVG(CASE WHEN nutrient_id = ? THEN amount END) AS carbs
        FROM Food_Nutrient
        WHERE fdc_id = ?`,
        [
          NUTRIENT_IDS.calories,
          NUTRIENT_IDS.protein,
          NUTRIENT_IDS.fat,
          NUTRIENT_IDS.carbs,
          fdcId,
        ]
      );

      const nutrients = nutrientRows[0];

      let calories = nutrients.calories;
      let protein = nutrients.protein;
      let fat = nutrients.fat;
      let carbs = nutrients.carbs;

      const grams = convertToGrams(ing.quantity, ing.unit);
      const factor = grams / 100;

      // Calculate calories from macros if missing
      if (
        (calories == null || calories === 0) &&
        protein != null &&
        fat != null &&
        carbs != null
      ) {
        // Get calorie conversion factors by fdc_id
        const [convRows]: any[] = await db.query(
          `SELECT ccf.protein_value, ccf.fat_value, ccf.carbohydrate_value
           FROM Food_Calorie_Conversion_Factor ccf
           JOIN Food_Nutrient_Conversion_Factor ncf ON ncf.id = ccf.food_nutrient_conversion_factor_id
           WHERE ncf.fdc_id = ?
           LIMIT 1`,
          [fdcId]
        );

        if (convRows.length) {
          const conv = convRows[0];
          calories =
            protein * conv.protein_value +
            fat * conv.fat_value +
            carbs * conv.carbohydrate_value;
        } else {
          // Use standard Atwater factors fallback
          calories = protein * 4 + fat * 9 + carbs * 4;
        }
      }

      if (calories != null) totalCalories += calories * factor;
      if (protein != null) totalProtein += protein * factor;
      if (fat != null) totalFat += fat * factor;
      if (carbs != null) totalCarbs += carbs * factor;

      console.log(
        `Ingredient "${rawName}" (food_id ${foodId}): calories=${calories}, protein=${protein}, fat=${fat}, carbs=${carbs}, factor=${factor}`
      );
    } catch (err) {
      console.error(`❌ Error processing "${rawName}":`, err);
    }
  }

  // Divide totals by servings to get per-serving values
  const perServingCalories = totalCalories / servings;
  const perServingProtein = totalProtein / servings;
  const perServingFat = totalFat / servings;
  const perServingCarbs = totalCarbs / servings;

  await db.query(
    `UPDATE meals SET calories = ?, protein = ?, fat = ?, carbohydrates = ? WHERE id = ?`,
    [
      Math.round(perServingCalories),
      Math.round(perServingProtein),
      Math.round(perServingFat),
      Math.round(perServingCarbs),
      mealId,
    ]
  );

  console.log(`✅ Updated meal ${mealId} with per-serving nutrition.`);
}
