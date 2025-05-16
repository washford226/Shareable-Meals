import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Password",
  database: process.env.DB_NAME || "balance_bytes",
};

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

async function batchInsert(connection: mysql.Connection, sql: string, data: any[][], batchSize = 1000) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await connection.query(sql, [batch]);
    console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(data.length / batchSize)}`);
  }
}

async function importFoods(connection: mysql.Connection) {
  const file = path.join(usdaDir, "food.csv");
  const foods = await readCSV(file);
  const values = foods.map(food => [
    // food_id is AUTO_INCREMENT, do not insert
    safeInt(food.fdc_id),
    food.data_type,
    food.description, // name (USDA Foundation) is in description
    food.description,
    food.publication_date
  ]);

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Foods (fdc_id, data_type, name, description, publication_date) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${foods.length} foods.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function importNutrients(connection: mysql.Connection) {
  const file = path.join(usdaDir, "nutrient.csv");
  const nutrients = await readCSV(file);
  const values = nutrients.map(nutrient => [
    safeInt(nutrient.id),
    nutrient.name,
    nutrient.unit_name,
    nutrient.nutrient_nbr,
    nutrient.description || null
  ]);

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Nutrients (nutrient_id, name, unit, nutrient_nbr, description) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${nutrients.length} nutrients.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function importFoodNutrients(connection: mysql.Connection) {
  const file = path.join(usdaDir, "food_nutrient.csv");
  const rows = await readCSV(file);

  // Step 1: Map fdc_id → food_id from the Foods table
  const [foodRows] = await connection.query(
    `SELECT food_id, fdc_id FROM Foods`
  );
  const fdcToFoodId = new Map<number, number>();
  for (const row of foodRows as any[]) {
    fdcToFoodId.set(row.fdc_id, row.food_id);
  }

  // Step 2: Transform CSV rows to match table schema
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

  // Step 3: Insert data in transaction
  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Food_Nutrient 
      (id, food_id, fdc_id, nutrient_id, amount, data_points, derivation_id, min, max, median, footnote, min_year_acquired) 
      VALUES ?`,
      values
    );
    await connection.commit();
    console.log(`✅ Imported ${values.length} food_nutrients.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}


async function importPortions(connection: mysql.Connection) {
  const file = path.join(usdaDir, "food_portion.csv");
  const rows = await readCSV(file);
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

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Portions (portion_id, food_id, fdc_id, seq_num, amount, measure_unit_id, portion_description, modifier, weight_in_grams, data_points, footnote, min_year_acquired) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${rows.length} portions.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function importMeasureUnits(connection: mysql.Connection) {
  const file = path.join(usdaDir, "measure_unit.csv");
  const rows = await readCSV(file);
  const values = rows.map(unit => [safeInt(unit.id), unit.name]);

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Measure_Unit (id, name) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${rows.length} measure units.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function importFoodCalorieConversionFactors(connection: mysql.Connection) {
  const file = path.join(usdaDir, "food_calorie_conversion_factor.csv");
  const rows = await readCSV(file);
  const values = rows.map(r => [
    safeInt(r.food_nutrient_conversion_factor_id),
    safeFloat(r.protein_value),
    safeFloat(r.fat_value),
    safeFloat(r.carbohydrate_value)
  ]);

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Food_Calorie_Conversion_Factor (food_nutrient_conversion_factor_id, protein_value, fat_value, carbohydrate_value) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${rows.length} calorie conversion factors.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function importFoodProteinConversionFactors(connection: mysql.Connection) {
  const file = path.join(usdaDir, "food_protein_conversion_factor.csv");
  const rows = await readCSV(file);
  const values = rows.map(r => [
    safeInt(r.food_nutrient_conversion_factor_id),
    safeFloat(r.value)
  ]);

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Food_Protein_Conversion_Factor (food_nutrient_conversion_factor_id, value) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${rows.length} protein conversion factors.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function importFoodNutrientConversionFactors(connection: mysql.Connection) {
  const file = path.join(usdaDir, "food_nutrient_conversion_factor.csv");
  const rows = await readCSV(file);
  const values = rows.map(r => [safeInt(r.id), safeInt(r.fdc_id)]);

  await connection.beginTransaction();
  try {
    await batchInsert(connection,
      `INSERT IGNORE INTO Food_Nutrient_Conversion_Factor (id, fdc_id) VALUES ?`,
      values);
    await connection.commit();
    console.log(`Imported ${rows.length} nutrient conversion factors.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    await importFoods(connection);
    await importNutrients(connection);
    await importFoodNutrients(connection);
    await importPortions(connection);
    await importMeasureUnits(connection);
    await importFoodCalorieConversionFactors(connection);
    await importFoodProteinConversionFactors(connection);
    await importFoodNutrientConversionFactors(connection);
    console.log("USDA import complete.");
  } catch (err) {
    console.error("Import failed:", err);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

main();