import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware'; // Adjust the path as needed
import multer from 'multer';

// Configure multer for file uploads
const upload = multer();

const router = Router();

// Create a new meal
router.post('/meals', authMiddleware, upload.single('picture'), async (req: Request, res: Response): Promise<void> => {
    const { 
      name, 
      description, 
      ingredients, 
      calories, 
      protein, 
      carbohydrates, 
      fat, 
      visibility, // Include visibility from the request body
      instructions, 
      recipeLink,
      created_by // Include created_by from the request body
    } = req.body; // Extract additional fields from the request body
    const user_id = req.user?.id; // Get the authenticated user's ID
    const picture = req.file ? req.file.buffer : null; // Get the uploaded image as a buffer
    const db = (req as any).db; // Get the database instance
  
    if (!user_id) {
      res.status(401).send('User is not authenticated');
      return;
    }
  
    if (!name || !description || !ingredients) {
      res.status(400).send('Missing required fields');
      return;
    }
  
    try {
      const query = `
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
          created_by -- Include created_by in the query
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        name,
        description,
        ingredients, // Ensure ingredients are passed as a valid JSON string or array
        calories,
        protein,
        carbohydrates,
        fat,
        visibility ?? true, // Default to true if visibility is not provided
        user_id,
        picture,
        instructions,
        recipeLink,
        created_by || 'User' // Default to 'User' if created_by is not provided
      ];
  
      await db.query(query, values);
      res.status(201).send('Meal added successfully');
    } catch (err) {
      console.error('Error adding meal:', err);
      res.status(500).send('Error adding meal');
    }
});
  
  router.put('/meals/:meal_id/image', authMiddleware, upload.single('picture'), async (req: Request, res: Response): Promise<void> => {
    const { meal_id } = req.params; // Extract the meal ID from the URL
    const user = (req as any).user; // Get the authenticated user
    const db = (req as any).db; // Get the database instance
    const picture = req.file?.buffer; // Get the uploaded image as a buffer
  
    if (!user) {
      res.status(401).send('User not authenticated');
      return;
    }
  
    if (!picture) {
      res.status(400).send('No image file uploaded');
      return;
    }
  
    try {
      // Check if the meal exists and belongs to the authenticated user
      const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ? AND user_id = ?', [meal_id, user.id]);
      if (rows.length === 0) {
        res.status(404).send('Meal not found or you are not authorized to update this meal');
        return;
      }
  
      // Update the meal's picture
      const query = `
        UPDATE meals
        SET picture = ?
        WHERE id = ? AND user_id = ?
      `;
      await db.query(query, [picture, meal_id, user.id]);
  
      res.status(200).send('Meal image updated successfully');
    } catch (err) {
      console.error('Error updating meal image:', err);
      res.status(500).send('Error updating meal image');
    }
  });
  
  
  // Get all meals
  router.get('/meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const db = (req as any).db; // Get the database instance
    const { search, filters } = req.query; // Extract search and filters from query parameters
  
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
        meals.instructions, -- Include instructions
        meals.recipeLink, -- Include recipe link
        meals.visibility, 
        meals.created_at, 
        meals.picture, -- Include the picture column
        meals.created_by_ai, -- Include created_by_ai column
        meals.created_by,
        users.username AS userName,
        COALESCE(AVG(reviews.rating), 0) AS averageRating, -- Calculate the average rating
        COUNT(reviews.review_id) AS reviewCount -- Count the number of reviews
      FROM meals
      INNER JOIN users ON meals.user_id = users.id
      LEFT JOIN reviews ON meals.id = reviews.meal_id -- Join with the reviews table
      WHERE meals.visibility = TRUE
    `;
  
    const values: any[] = [];
  
    // Add search filtering if the search query is provided
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
  
    // Add filtering logic for nutritional values
    if (filters) {
      const parsedFilters = JSON.parse(filters as string); // Parse the filters from the query string
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
  
    query += `
      GROUP BY meals.id, users.username -- Group by meal ID and username
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
  
  
  //get all meals
  router.get('/meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const db = (req as any).db; // Get the database instance
    const { search, filters } = req.query; // Extract search and filters from query parameters
  
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
        meals.instructions, -- Include instructions
        meals.recipeLink, -- Include recipe link
        meals.visibility, 
        meals.created_at, 
        meals.picture, -- Include the picture column
        meals.created_by_ai, -- Include created_by_ai column
        meals.created_by,
        users.username AS userName,
        COALESCE(AVG(reviews.rating), 0) AS averageRating, -- Calculate the average rating
        COUNT(reviews.review_id) AS reviewCount -- Count the number of reviews
      FROM meals
      INNER JOIN users ON meals.user_id = users.id
      LEFT JOIN reviews ON meals.id = reviews.meal_id -- Join with the reviews table
      WHERE meals.visibility = TRUE
    `;
  
    const values: any[] = [];
  
    // Add search filtering if the search query is provided
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
  
    // Add filtering logic for nutritional values
    if (filters) {
      const parsedFilters = JSON.parse(filters as string); // Parse the filters from the query string
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
  
    query += `
      GROUP BY meals.id, users.username -- Group by meal ID and username
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
    const { meal_id } = req.params; // Extract the meal ID from the URL
    const user = (req as any).user; // Get the authenticated user
    const db = (req as any).db; // Get the database instance
  
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
      const query = `
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
          recipeLink
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        meal.name, // Keep the original name
        meal.description,
        meal.ingredients,
        meal.calories,
        meal.protein,
        meal.carbohydrates,
        meal.fat,
        0, // Set visibility to 0 (private)
        user.id, // Assign the copied meal to the current user
        meal.picture,
        meal.instructions,
        meal.recipeLink,
      ];
  
      await db.query(query, values);
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
    const { search, filters } = req.query; // Get the search and filters parameters
  
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
        meals.instructions, -- Include instructions
        meals.recipeLink, -- Include recipe link
        meals.visibility,
        meals.created_at,
        meals.picture, -- Include the picture column
        meals.created_by_ai, -- Include created_by_ai column
        meals.created_by
      FROM meals
      WHERE meals.user_id = ? -- Filter by the current user's ID
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
      const parsedFilters = JSON.parse(filters as string); // Parse the filters from the query string
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
  
    query += `
      ORDER BY meals.created_at DESC
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
      console.error('Error fetching user meals:', err);
      res.status(500).send('Error fetching user meals');
    }
  });
  
  // Edit a meal
  router.put('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { meal_id } = req.params; // Extract the meal ID from the URL
    const {
      name,
      description,
      ingredients,
      calories,
      protein,
      carbohydrates,
      fat,
      visibility,
      instructions,
      recipeLink,
    } = req.body; // Extract updated fields from the request body
    const user = (req as any).user; // Get the authenticated user
    const db = (req as any).db; // Get the database instance
  
    if (!user) {
      res.status(401).send('User not authenticated');
      return;
    }
  
    // Validate input
    if (!name || !description || !ingredients) {
      res.status(400).send('Name, description, and ingredients are required');
      return;
    }
  
    try {
      // Check if the meal exists and belongs to the authenticated user
      const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ? AND user_id = ?', [meal_id, user.id]);
      if (rows.length === 0) {
        res.status(404).send('Meal not found or you are not authorized to edit this meal');
        return;
      }
  
      // Update the meal
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
          recipeLink = ?
        WHERE id = ? AND user_id = ?
      `;
      const values = [
        name,
        description,
        JSON.stringify(ingredients), // Convert ingredients to JSON if it's an array
        calories,
        protein,
        carbohydrates,
        fat,
        visibility ?? true, // Default to true if visibility is not provided
        instructions,
        recipeLink,
        meal_id,
        user.id,
      ];
  
      await db.query(query, values);
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
          meals.instructions, -- Include instructions
          meals.recipeLink, -- Include recipe link
          meals.visibility, 
          meals.created_at, 
          meals.picture, -- Include the picture column
          meals.created_by_ai, -- Include created_by_ai column
          meals.created_by,
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
        meal.picture = null; // Set to null if no picture exists
      }
  
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

// Create an AI-generated meal
router.post('/meal-ai', authMiddleware, upload.none(), async (req: Request, res: Response): Promise<void> => {
  const { name, description, ingredients, instructions } = req.body;
  const user_id = req.user?.id;
  const db = (req as any).db;

  if (!user_id) {
    res.status(401).json({ error: 'User is not authenticated' });
    return;
  }

  if (!name || !description || !ingredients || !instructions) {
    res.status(400).json({ error: 'Missing required fields: name, description, ingredients, or instructions' });
    return;
  }

  try {
    const query = `
      INSERT INTO meals (
        name, 
        description, 
        ingredients, 
        visibility, 
        user_id, 
        instructions, 
        created_by_ai
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      name,
      description,
      typeof ingredients === 'string' ? ingredients : JSON.stringify(ingredients),
      false, // Default visibility to false
      user_id,
      instructions,
      true, // Mark as AI-generated
    ];

    await db.query(query, values);
    res.status(201).json({ message: 'AI-generated meal added successfully' });
  } catch (err) {
    console.error('Error adding AI-generated meal:', err);
    res.status(500).json({ error: 'Error adding AI-generated meal' });
  }
});

  export default router;