import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const usdaDir = path.join(__dirname, "../usda_data/FoodData_Central_foundation_food_csv_2025-04-24");

function safeInt(val: any) {
  const num = parseInt(val);
  return isNaN(num) ? null : num;
}
function safeFloat(val: any) {
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

async function readCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const data: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => data.push(row))
      .on("end", () => resolve(data))
      .on("error", reject);
  });
}

async function batchInsert(
  table: string,
  columns: string[],
  data: any[][],
  batchSize = 1000
) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const objects = batch.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    const { error } = await supabase.from(table).upsert(objects);
    if (error) {
      throw error;
    }
    console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(data.length / batchSize)} into ${table}`);
  }
}

async function importFoods() {
  const file = path.join(usdaDir, "food.csv");
  const foods = await readCSV(file);
  const columns = ["fdc_id", "data_type", "name", "description", "publication_date"];
  const values = foods.map(food => [
    safeInt(food.fdc_id),
    food.data_type,
    food.description, // name (USDA Foundation) is in description
    food.description,
    food.publication_date
  ]);
  await batchInsert("Foods", columns, values);
  console.log(`Imported ${foods.length} foods.`);
}

async function importNutrients() {
  const file = path.join(usdaDir, "nutrient.csv");
  const nutrients = await readCSV(file);
  const columns = ["nutrient_id", "name", "unit", "nutrient_nbr", "description"];
  const values = nutrients.map(nutrient => [
    safeInt(nutrient.id),
    nutrient.name,
    nutrient.unit_name,
    nutrient.nutrient_nbr,
    nutrient.description || null
  ]);
  await batchInsert("Nutrients", columns, values);
  console.log(`Imported ${nutrients.length} nutrients.`);
}

async function importFoodNutrients() {
  const file = path.join(usdaDir, "food_nutrient.csv");
  const rows = await readCSV(file);

  // Step 1: Map fdc_id → food_id from the Foods table
  const { data: foodRows, error: foodError } = await supabase
    .from("Foods")
    .select("food_id, fdc_id");
  if (foodError) throw foodError;
  const fdcToFoodId = new Map<number, number>();
  for (const row of foodRows as any[]) {
    fdcToFoodId.set(row.fdc_id, row.food_id);
  }

  // Step 2: Transform CSV rows to match table schema
  const columns = [
    "id",
    "food_id",
    "fdc_id",
    "nutrient_id",
    "amount",
    "data_points",
    "derivation_id",
    "min",
    "max",
    "median",
    "footnote",
    "min_year_acquired"
  ];
  const values = rows
    .map(fn => {
      const fdcId = safeInt(fn.fdc_id);
      if (fdcId == null) return null;
      const foodId = fdcToFoodId.get(fdcId);
      if (!foodId) return null;

      return [
        safeInt(fn.id),
        foodId,
        fdcId,
        safeInt(fn.nutrient_id),
        safeFloat(fn.amount),
        safeInt(fn.data_points),
        fn.derivation_id || null,
        safeFloat(fn.min),
        safeFloat(fn.max),
        safeFloat(fn.median),
        fn.footnote || null,
        fn.min_year_acquired || null
      ];
    })
    .filter((row): row is any[] => row !== null); // remove nulls and ensure type is any[][]

  await batchInsert("Food_Nutrient", columns, values);
  console.log(`✅ Imported ${values.length} food_nutrients.`);
}

async function importPortions() {
  const file = path.join(usdaDir, "food_portion.csv");
  const rows = await readCSV(file);
  const columns = [
    "portion_id",
    "food_id",
    "fdc_id",
    "seq_num",
    "amount",
    "measure_unit_id",
    "portion_description",
    "modifier",
    "weight_in_grams",
    "data_points",
    "footnote",
    "min_year_acquired"
  ];
  const values = rows.map(row => [
    safeInt(row.id),
    safeInt(row.fdc_id), // food_id (references Foods.food_id)
    safeInt(row.fdc_id), // fdc_id (for reference)
    row.seq_num || null,
    safeFloat(row.amount),
    safeInt(row.measure_unit_id),
    row.portion_description || null,
    row.modifier || null,
    safeFloat(row.gram_weight),
    safeInt(row.data_points),
    row.footnote || null,
    row.min_year_acquired || null
  ]);
  await batchInsert("Portions", columns, values);
  console.log(`Imported ${rows.length} portions.`);
}

async function importMeasureUnits() {
  const file = path.join(usdaDir, "measure_unit.csv");
  const rows = await readCSV(file);
  const columns = ["id", "name"];
  const values = rows.map(unit => [safeInt(unit.id), unit.name]);
  await batchInsert("Measure_Unit", columns, values);
  console.log(`Imported ${rows.length} measure units.`);
}

async function importFoodCalorieConversionFactors() {
  const file = path.join(usdaDir, "food_calorie_conversion_factor.csv");
  const rows = await readCSV(file);
  const columns = [
    "food_nutrient_conversion_factor_id",
    "protein_value",
    "fat_value",
    "carbohydrate_value"
  ];
  const values = rows.map(r => [
    safeInt(r.food_nutrient_conversion_factor_id),
    safeFloat(r.protein_value),
    safeFloat(r.fat_value),
    safeFloat(r.carbohydrate_value)
  ]);
  await batchInsert("Food_Calorie_Conversion_Factor", columns, values);
  console.log(`Imported ${rows.length} calorie conversion factors.`);
}

async function importFoodProteinConversionFactors() {
  const file = path.join(usdaDir, "food_protein_conversion_factor.csv");
  const rows = await readCSV(file);
  const columns = [
    "food_nutrient_conversion_factor_id",
    "value"
  ];
  const values = rows.map(r => [
    safeInt(r.food_nutrient_conversion_factor_id),
    safeFloat(r.value)
  ]);
  await batchInsert("Food_Protein_Conversion_Factor", columns, values);
  console.log(`Imported ${rows.length} protein conversion factors.`);
}

async function importFoodNutrientConversionFactors() {
  const file = path.join(usdaDir, "food_nutrient_conversion_factor.csv");
  const rows = await readCSV(file);
  const columns = ["id", "fdc_id"];
  const values = rows.map(r => [safeInt(r.id), safeInt(r.fdc_id)]);
  await batchInsert("Food_Nutrient_Conversion_Factor", columns, values);
  console.log(`Imported ${rows.length} nutrient conversion factors.`);
}

async function main() {
  try {
    await importFoods();
    await importNutrients();
    await importFoodNutrients();
    await importPortions();
    await importMeasureUnits();
    await importFoodCalorieConversionFactors();
    await importFoodProteinConversionFactors();
    await importFoodNutrientConversionFactors();
    console.log("USDA import complete.");
  } catch (err) {
    console.error("Import failed:", err);
  } finally {
    process.exit(0);
  }
}

main();