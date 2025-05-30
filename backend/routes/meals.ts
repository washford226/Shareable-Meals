import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware';
import multer from 'multer';
import { calculateAndStoreMealNutrition } from './usda_linking';

const upload = multer();

const router = Router();
const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
};

async function findBestFoodMatch(db: any, rawName: string) {
  const rawWords = rawName.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return null;

  const likeClauses = rawWords.map(() => `f.name LIKE ?`).join(' AND ');
  const likeParams = rawWords.map(word => `%${word}%`);

  const sql = `
    SELECT 
      f.food_id,
      COUNT(CASE 
          WHEN fn.amount IS NOT NULL AND fn.nutrient_id IN (?, ?, ?, ?) 
          THEN 1 END) AS macro_count
    FROM Foods f
    JOIN Food_Nutrient fn ON f.food_id = fn.food_id
    WHERE ${likeClauses}
    GROUP BY f.food_id
    ORDER BY macro_count DESC
    LIMIT 1
  `;

  const [foodRows]: any[] = await db.query(sql, [
    NUTRIENT_IDS.calories,
    NUTRIENT_IDS.protein,
    NUTRIENT_IDS.fat,
    NUTRIENT_IDS.carbs,
    ...likeParams,
  ]);

  return foodRows.length > 0 ? foodRows[0] : null;
}


// Create an AI-generated meal
router.post('/meal-ai', authMiddleware, upload.none(), async (req: any, res: any) => {
  const { name, description, ingredients, instructions, servings } = req.body; // <-- add servings
  const user_id = req.user?.id;
  const db = (req as any).db;

  if (!user_id) return res.status(401).json({ error: 'User is not authenticated' });
  if (!name || !description || !ingredients || !instructions) {
    return res.status(400).json({ error: 'Missing required fields: name, description, ingredients, or instructions' });
  }

  let parsedIngredients;
  try {
    parsedIngredients = typeof ingredients === "string" ? JSON.parse(ingredients) : ingredients;
    if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) throw new Error();
    parsedIngredients = parsedIngredients.map(ing => ({ ...ing, raw_name: ing.raw_name ?? ing.name }));
  } catch {
    return res.status(400).json({ error: 'Ingredients must be a valid JSON array' });
  }

  try {
    const [result]: any = await db.query(
      `INSERT INTO meals (name, description, ingredients, visibility, user_id, instructions, created_by_ai, servings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, JSON.stringify(parsedIngredients), false, user_id, instructions, true, servings ? Number(servings) : 1] // <-- add servings here
    );

    const mealId = result.insertId;

    for (const ing of parsedIngredients) {
      console.log("name: ",ing.name,"quantity: ", ing.quantity,"unit: ", ing.unit);
      if (!ing.name || !ing.quantity || !ing.unit) continue;

      try {
        const foodMatch = await findBestFoodMatch(db, ing.raw_name ?? ing.name);
        if (!foodMatch) {
          console.warn(`No matching food found for ingredient: ${ing.raw_name}`);
          continue;
        }

        const quantityNum = Number(ing.quantity);
        if (isNaN(quantityNum)) {
          console.warn(`Invalid quantity for ingredient: ${ing.raw_name}`);
          continue;
        }
        
        await db.query(
          `INSERT INTO meal_ingredients (meal_id, food_id, quantity, unit, raw_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [mealId, foodMatch.food_id, quantityNum, ing.unit.toLowerCase(), ing.raw_name]
        );
      } catch (err) {
        console.error(`Error inserting ingredient "${ing.raw_name}":`, err);
      }
    }
    await calculateAndStoreMealNutrition(mealId, db);

    res.status(201).json({ message: 'AI-generated meal added successfully' });
  } catch (err) {
    console.error('Error adding AI-generated meal:', err);
    res.status(500).json({ error: 'Error adding AI-generated meal' });
  }
});

// Create a new meal
router.post('/meals', authMiddleware, upload.single('picture'), async (req: any, res: any): Promise<void> => {
  const { name, description, ingredients, visibility, instructions, recipeLink, created_by, dietary_restrictions, servings, cuisine } = req.body;
  const user_id = req.user?.id;
  const picture = req.file ? req.file.buffer : null;
  const db = (req as any).db;

  if (!user_id) {
    res.status(401).send('User is not authenticated');
    return;
  }
  if (!name || !description || !ingredients) {
    res.status(400).send('Missing required fields');
    return;
  }

  let parsedIngredients;
  try {
    parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) throw new Error();
    parsedIngredients = parsedIngredients.map(ing => ({ ...ing, raw_name: ing.raw_name ?? ing.name }));
  } catch {
    res.status(400).send('Ingredients must be a valid JSON array');
    return;
  }

  try {
    const [result]: any = await db.query(
      `INSERT INTO meals (name, description, ingredients, visibility, user_id, picture, instructions, recipeLink, created_by, dietary_restrictions, servings, cuisine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        JSON.stringify(parsedIngredients),
        visibility ?? true,
        user_id,
        picture,
        instructions,
        recipeLink,
        created_by || 'User',
        dietary_restrictions || null,
        servings ? Number(servings) : 1,
        cuisine || null // <-- Add cuisine here
      ]
    );

    const mealId = result.insertId;

    for (const ing of parsedIngredients) {
      if (!ing.name || !ing.quantity || !ing.unit) continue;

      try {
        const foodMatch = await findBestFoodMatch(db, ing.raw_name ?? ing.name);
        if (!foodMatch) {
          console.warn(`No matching food found for ingredient: ${ing.raw_name}`);
          continue;
        }

        const quantityNum = Number(ing.quantity);
        if (isNaN(quantityNum)) {
          console.warn(`Invalid quantity for ingredient: ${ing.raw_name}`);
          continue;
        }
        await db.query(
          `INSERT INTO meal_ingredients (meal_id, food_id, quantity, unit, raw_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [mealId, foodMatch.food_id, quantityNum, ing.unit.toLowerCase(), ing.raw_name]
        );
      } catch (err) {
        console.error(`Error inserting ingredient "${ing.raw_name}":`, err);
      }
    }

    await calculateAndStoreMealNutrition(mealId, db);

    res.status(201).send('Meal added successfully');
  } catch (err) {
    console.error('Error adding meal:', err);
    res.status(500).send('Error adding meal');
  }
});


// Upload/update a meal image
router.put('/meals/:meal_id/image', authMiddleware, upload.single('picture'), async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const user = (req as any).user;
  const db = (req as any).db;
  const picture = req.file?.buffer;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  if (!picture) {
    res.status(400).send('No image file uploaded');
    return;
  }

  try {
    const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ? AND user_id = ?', [meal_id, user.id]);
    if (rows.length === 0) {
      res.status(404).send('Meal not found or you are not authorized to update this meal');
      return;
    }

    await db.query(
      `UPDATE meals SET picture = ? WHERE id = ? AND user_id = ?`,
      [picture, meal_id, user.id]
    );

    res.status(200).send('Meal image updated successfully');
  } catch (err) {
    console.error('Error updating meal image:', err);
    res.status(500).send('Error updating meal image');
  }
});
  
  // Get all meals (with filters and search)
  router.get('/meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const db = (req as any).db;
  const { search, filters, created_by_ai, dietary_restrictions, cuisine } = req.query;

  let query = `
    SELECT 
      meals.id, 
      meals.name, 
      meals.description, 
      meals.ingredients, 
      meals.calories, 
      meals.protein, 
      meals.carbohydrates, 
      meals.fat, 
      meals.instructions,
      meals.recipeLink,
      meals.visibility, 
      meals.created_at, 
      meals.picture, 
      meals.created_by_ai, 
      meals.created_by,
      users.username AS userName,
      COALESCE(AVG(reviews.rating), 0) AS averageRating,
      COUNT(reviews.review_id) AS reviewCount,
      meals.dietary_restrictions,
      meals.cuisine
    FROM meals
    INNER JOIN users ON meals.user_id = users.id
    LEFT JOIN reviews ON meals.id = reviews.meal_id
    WHERE meals.visibility = TRUE
  `;

  const values: any[] = [];

  // Search filter
  if (search) {
    query += `
      AND (
        meals.name LIKE ? OR
        meals.description LIKE ? OR
        users.username LIKE ?
      )
    `;
    const searchTerm = `%${search}%`;
    values.push(searchTerm, searchTerm, searchTerm);
  }

  // Nutrition filters
  if (filters) {
    const parsedFilters = JSON.parse(filters as string);
    parsedFilters.forEach((filter: { type: string; greaterThan: string; lessThan: string }) => {
      if (filter.type) {
        if (filter.greaterThan) {
          query += ` AND meals.${filter.type} > ?`;
          values.push(Number(filter.greaterThan));
        }
        if (filter.lessThan) {
          query += ` AND meals.${filter.type} < ?`;
          values.push(Number(filter.lessThan));
        }
      }
    });
  }

  // AI filter
  if (typeof created_by_ai !== "undefined") {
    query += ` AND meals.created_by_ai = ?`;
    values.push(created_by_ai === "true" ? 1 : 0);
  }

  // Dietary restriction filter
  if (dietary_restrictions) {
    const restrictions = (dietary_restrictions as string).split(",").map(r => r.trim()).filter(Boolean);
    if (restrictions.length === 1) {
      query += ` AND meals.dietary_restrictions = ?`;
      values.push(restrictions[0]);
    } else if (restrictions.length > 1) {
      query += ` AND meals.dietary_restrictions IN (${restrictions.map(() => "?").join(",")})`;
      values.push(...restrictions);
    }
  }

  // Cuisine filter
  if (cuisine) {
    query += ` AND meals.cuisine = ?`;
    values.push(cuisine);
  }

  query += `
    GROUP BY meals.id, users.username
    ORDER BY reviewCount DESC
  `;

  try {
    const [rows]: [any[], any] = await db.query(query, values);

    // Convert the picture BLOB to Base64 for frontend display
    const mealsWithImages = rows.map((meal: any) => ({
      ...meal,
      picture: meal.picture ? `data:image/jpeg;base64,${meal.picture.toString('base64')}` : null,
    }));

    res.status(200).json(mealsWithImages);
  } catch (err) {
    console.error('Error fetching meals:', err);
    res.status(500).send('Error fetching meals');
  }
});

  // Copy a meal
router.post('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const user = (req as any).user;
  const db = (req as any).db;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  try {
    // Fetch the meal to be copied
    const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ?', [meal_id]);
    if (rows.length === 0) {
      res.status(404).send('Meal not found');
      return;
    }

    const meal = rows[0];

    // Insert a new meal with the same data but a new ID, user_id, and visibility set to 0
    const insertMealQuery = `
      INSERT INTO meals (
        name, 
        description, 
        ingredients, 
        calories, 
        protein, 
        carbohydrates, 
        fat, 
        visibility, 
        user_id, 
        picture, 
        instructions, 
        recipeLink,
        created_by_ai,
        created_by,
        favorite,
        dietary_restrictions,
        servings,
        cuisine           -- <-- Add cuisine here
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const mealValues = [
      meal.name,
      meal.description,
      meal.ingredients,
      meal.calories,
      meal.protein,
      meal.carbohydrates,
      meal.fat,
      0, // Set visibility to 0 (private)
      user.id,
      meal.picture,
      meal.instructions,
      meal.recipeLink,
      meal.created_by_ai,
      meal.created_by,
      false, // favorite should be false for a copied meal
      meal.dietary_restrictions,
      meal.servings,
      meal.cuisine      // <-- Add cuisine here
    ];

    const [insertResult]: any = await db.query(insertMealQuery, mealValues);
    const newMealId = insertResult.insertId;

    // Copy meal_ingredients
    const [ingredients]: [any[], any] = await db.query(
      'SELECT raw_name, food_id, quantity, unit FROM meal_ingredients WHERE meal_id = ?',
      [meal_id]
    );

    for (const ing of ingredients) {
      await db.query(
        `INSERT INTO meal_ingredients (meal_id, raw_name, food_id, quantity, unit)
         VALUES (?, ?, ?, ?, ?)`,
        [newMealId, ing.raw_name, ing.food_id, ing.quantity, ing.unit]
      );
    }

    res.status(201).send('Meal copied successfully');
  } catch (err) {
    console.error('Error copying meal:', err);
    res.status(500).send('Error copying meal');
  }
});
  
  // Get meals for the current user (with filters and search)
router.get('/my-meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user; // Get the authenticated user
  const db = (req as any).db; // Get the database instance
  const { search, filters, created_by_ai, dietary_restrictions, cuisine } = req.query; // Add cuisine

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  let query = `
    SELECT 
      meals.id, 
      meals.name, 
      meals.description, 
      meals.ingredients, 
      meals.calories, 
      meals.protein, 
      meals.carbohydrates, 
      meals.fat, 
      meals.instructions,
      meals.recipeLink,
      meals.visibility,
      meals.created_at,
      meals.picture,
      meals.created_by_ai,
      meals.favorite,
      meals.created_by,
      meals.dietary_restrictions,
      meals.cuisine       
    FROM meals
    WHERE meals.user_id = ?
  `;

  const values: any[] = [user.id];

  // Add search filtering if the search query is provided
  if (search) {
    query += `
      AND (
        meals.name LIKE ? OR
        meals.description LIKE ?
      )
    `;
    const searchTerm = `%${search}%`;
    values.push(searchTerm, searchTerm);
  }

  // Add filtering logic for nutritional values
  if (filters) {
    const parsedFilters = JSON.parse(filters as string);
    parsedFilters.forEach((filter: { type: string; greaterThan: string; lessThan: string }) => {
      if (filter.type) {
        if (filter.greaterThan) {
          query += ` AND meals.${filter.type} > ?`;
          values.push(Number(filter.greaterThan));
        }
        if (filter.lessThan) {
          query += ` AND meals.${filter.type} < ?`;
          values.push(Number(filter.lessThan));
        }
      }
    });
  }

  // Filter for AI-created meals if requested
  if (typeof created_by_ai !== "undefined") {
    query += ` AND meals.created_by_ai = ?`;
    values.push(created_by_ai === "true" ? 1 : 0);
  }

  // Filter for dietary restrictions if provided (supports comma-separated or single value)
  if (dietary_restrictions) {
    const restrictions = (dietary_restrictions as string).split(",").map(r => r.trim()).filter(Boolean);
    if (restrictions.length === 1) {
      query += ` AND meals.dietary_restrictions = ?`;
      values.push(restrictions[0]);
    } else if (restrictions.length > 1) {
      query += ` AND meals.dietary_restrictions IN (${restrictions.map(() => "?").join(",")})`;
      values.push(...restrictions);
    }
  }

  // Filter for cuisine if provided
  if (cuisine) {
    query += ` AND meals.cuisine = ?`;
    values.push(cuisine);
  }

  query += `
    ORDER BY meals.favorite DESC, meals.created_at DESC
  `;

  try {
    const [rows]: [any[], any] = await db.query(query, values);

    // Convert the picture BLOB to Base64 for frontend display
    const mealsWithImages = Array.isArray(rows)
      ? rows.map((meal: any) => ({
          ...meal,
          picture: meal.picture ? `data:image/jpeg;base64,${meal.picture.toString('base64')}` : null,
        }))
      : [];

    res.status(200).json(mealsWithImages);
  } catch (err) {
    console.error('Error fetching user meals:', err);
    res.status(500).send('Error fetching user meals');
  }
});
  
  // Edit a meal
router.put('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const {
    name,
    description,
    ingredients, // Expecting an array of { name, quantity, unit, ... }
    calories,
    protein,
    carbohydrates,
    fat,
    visibility,
    instructions,
    recipeLink,
    dietary_restrictions,
    servings,
    cuisine // <-- Add cuisine here
  } = req.body;
  const user = (req as any).user;
  const db = (req as any).db;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  // Validate input
  if (!name || !description || !ingredients) {
    res.status(400).send('Name, description, and ingredients are required');
    return;
  }

  let parsedIngredients;
  try {
    parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) throw new Error();
    parsedIngredients = parsedIngredients.map(ing => ({
      ...ing,
      raw_name: ing.raw_name ?? ing.name
    }));
  } catch {
    res.status(400).send('Ingredients must be a valid JSON array');
    return;
  }

  try {
    // Check if the meal exists and belongs to the authenticated user
    const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ? AND user_id = ?', [meal_id, user.id]);
    if (rows.length === 0) {
      res.status(404).send('Meal not found or you are not authorized to edit this meal');
      return;
    }

    // Update the meal (including the ingredients JSON/text column)
    const query = `
      UPDATE meals
      SET 
        name = ?, 
        description = ?, 
        ingredients = ?, 
        calories = ?, 
        protein = ?, 
        carbohydrates = ?, 
        fat = ?, 
        visibility = ?, 
        instructions = ?, 
        recipeLink = ?,
        dietary_restrictions = ?,
        servings = ?,
        cuisine = ?         -- <-- Add cuisine here
      WHERE id = ? AND user_id = ?
    `;
    const values = [
      name,
      description,
      JSON.stringify(parsedIngredients),
      calories,
      protein,
      carbohydrates,
      fat,
      visibility ?? true,
      instructions,
      recipeLink,
      dietary_restrictions || null,
      servings ? Number(servings) : 1,
      cuisine || null,      // <-- Add cuisine here
      meal_id,
      user.id,
    ];

    await db.query(query, values);

    // --- Update meal_ingredients table ---
    await db.query('DELETE FROM meal_ingredients WHERE meal_id = ?', [meal_id]);

    for (const ing of parsedIngredients) {
      if (!ing.name || !ing.quantity || !ing.unit) continue;

      let food_id = ing.food_id;
      if (!food_id) {
        const foodMatch = await findBestFoodMatch(db, ing.raw_name ?? ing.name);
        food_id = foodMatch ? foodMatch.food_id : null;
      }
      if (!food_id) continue;

      await db.query(
        `INSERT INTO meal_ingredients (meal_id, food_id, quantity, unit, raw_name)
         VALUES (?, ?, ?, ?, ?)`,
        [meal_id, food_id, Number(ing.quantity), ing.unit.toLowerCase(), ing.raw_name]
      );
    }

    res.status(200).send('Meal updated successfully');
  } catch (err) {
    console.error('Error updating meal:', err);
    res.status(500).send('Error updating meal');
  }
});
  
  // Get a specific meal by ID
router.get('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params; // Extract the meal ID from the URL
  const db = (req as any).db; // Get the database instance

  try {
    const [rows]: [any[], any] = await db.query(
      `
      SELECT 
        meals.id, 
        meals.name, 
        meals.description, 
        meals.ingredients, 
        meals.calories, 
        meals.protein, 
        meals.carbohydrates, 
        meals.fat, 
        meals.instructions,
        meals.recipeLink,
        meals.visibility, 
        meals.created_at, 
        meals.picture,
        meals.created_by_ai,
        meals.created_by,
        meals.dietary_restrictions,
        meals.cuisine,                -- <-- Add this line
        users.username AS userName
      FROM meals
      INNER JOIN users ON meals.user_id = users.id
      WHERE meals.id = ?
      `,
      [meal_id]
    );

    if (rows.length === 0) {
      res.status(404).send('Meal not found');
      return;
    }

    const meal = rows[0];

    // Convert the picture BLOB to Base64 for frontend display
    if (meal.picture) {
      meal.picture = `data:image/jpeg;base64,${meal.picture.toString('base64')}`;
    } else {
      meal.picture = null;
    }

    // Fetch meal ingredients with name, quantity, and unit
    const [ingredients]: [any[], any] = await db.query(
      `SELECT mi.raw_name AS name, mi.quantity, mi.unit
       FROM meal_ingredients mi
       WHERE mi.meal_id = ?`,
      [meal_id]
    );
    meal.ingredients = ingredients;

    res.status(200).json(meal);
  } catch (err) {
    console.error('Error fetching meal:', err);
    res.status(500).send('Error fetching meal');
  }
});
  
  // Delete a meal
  router.delete('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { meal_id } = req.params; // Extract the meal ID from the URL
    const user = (req as any).user; // Get the authenticated user
    const db = (req as any).db; // Get the database instance
  
    if (!user) {
      res.status(401).send('User not authenticated');
      return;
    }
  
    try {
      // Check if the meal exists and belongs to the authenticated user
      const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ? AND user_id = ?', [meal_id, user.id]);
      if (rows.length === 0) {
        res.status(404).send('Meal not found or you are not authorized to delete this meal');
        return;
      }
  
      // Delete the meal
      const query = 'DELETE FROM meals WHERE id = ? AND user_id = ?';
      await db.query(query, [meal_id, user.id]);
  
      res.status(200).send('Meal deleted successfully');
    } catch (err) {
      console.error('Error deleting meal:', err);
      res.status(500).send('Error deleting meal');
    }
  });

router.put('/meals/:meal_id/favorite', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params; // Extract the meal ID from the URL
  const user = (req as any).user; // Get the authenticated user
  const db = (req as any).db; // Get the database instance

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  try {
    // Check if the meal exists and belongs to the authenticated user
    const [rows]: [any[], any] = await db.query('SELECT favorite FROM meals WHERE id = ? AND user_id = ?', [meal_id, user.id]);
    if (rows.length === 0) {
      res.status(404).send('Meal not found or you are not authorized to update this meal');
      return;
    }

    const currentFavoriteStatus = rows[0].favorite;

    // Toggle the favorite status
    const newFavoriteStatus = !currentFavoriteStatus;

    // Update the favorite column in the database
    const query = `
      UPDATE meals
      SET favorite = ?
      WHERE id = ? AND user_id = ?
    `;
    await db.query(query, [newFavoriteStatus, meal_id, user.id]);

    res.status(200).json({ message: 'Favorite status updated successfully', favorite: newFavoriteStatus });
  } catch (err) {
    console.error('Error toggling favorite status:', err);
    res.status(500).send('Error toggling favorite status');
  }
});

  export default router;