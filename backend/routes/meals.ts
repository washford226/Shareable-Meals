import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const upload = multer();
const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Create an AI-generated meal
router.post('/meal-ai', authMiddleware, upload.none(), async (req: any, res: any) => {
  const { name, description, ingredients, instructions, servings } = req.body;
  const user_id = req.user?.id;

  if (!user_id) return res.status(401).json({ error: 'User is not authenticated' });
  if (!name || !description || !ingredients || !instructions) {
    return res.status(400).json({ error: 'Missing required fields: name, description, ingredients, or instructions' });
  }

  let parsedIngredients;
  try {
    parsedIngredients = typeof ingredients === "string" ? JSON.parse(ingredients) : ingredients;
    if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) throw new Error();
    parsedIngredients = parsedIngredients.map((ing: any) => ({ ...ing, raw_name: ing.raw_name ?? ing.name }));
  } catch {
    return res.status(400).json({ error: 'Ingredients must be a valid JSON array' });
  }

  try {
    const { data, error } = await supabase
      .from("meals")
      .insert([{
        name,
        description,
        ingredients: parsedIngredients,
        visibility: false,
        user_id,
        instructions,
        created_by_ai: true,
        servings: servings ? Number(servings) : 1
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'AI-generated meal added successfully', meal: data });
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
    parsedIngredients = parsedIngredients.map((ing: any) => ({ ...ing, raw_name: ing.raw_name ?? ing.name }));
  } catch {
    res.status(400).send('Ingredients must be a valid JSON array');
    return;
  }

  try {
    let pictureUrl = null;
    if (picture) {
      const fileName = `meal_${Date.now()}_${user_id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("meal-pictures")
        .upload(fileName, picture, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("meal-pictures").getPublicUrl(fileName);
      pictureUrl = urlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("meals")
      .insert([{
        name,
        description,
        ingredients: parsedIngredients,
        visibility: visibility ?? true,
        user_id,
        picture: pictureUrl,
        instructions,
        recipeLink,
        created_by: created_by || 'User',
        dietary_restrictions: dietary_restrictions || null,
        servings: servings ? Number(servings) : 1,
        cuisine: cuisine || null
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Meal added successfully', meal: data });
  } catch (err) {
    console.error('Error adding meal:', err);
    res.status(500).send('Error adding meal');
  }
});

// Upload/update a meal image
router.put('/meals/:meal_id/image', authMiddleware, upload.single('picture'), async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const user = (req as any).user;
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
    const fileName = `meal_${meal_id}_${user.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("meal-pictures")
      .upload(fileName, picture, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from("meal-pictures").getPublicUrl(fileName);
    const pictureUrl = urlData.publicUrl;

    const { error } = await supabase
      .from("meals")
      .update({ picture: pictureUrl })
      .eq("id", meal_id)
      .eq("user_id", user.id);

    if (error) throw error;

    res.status(200).send('Meal image updated successfully');
  } catch (err) {
    console.error('Error updating meal image:', err);
    res.status(500).send('Error updating meal image');
  }
});

// Get all meals (with filters and search)
router.get('/meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { search, filters, created_by_ai, dietary_restrictions, cuisine } = req.query;

  let query = supabase
    .from("meals")
    .select(`
      id, name, description, ingredients, calories, protein, carbohydrates, fat, instructions,
      recipeLink, visibility, created_at, picture, created_by_ai, created_by, dietary_restrictions, cuisine,
      user_id,
      users (username),
      reviews (rating, review_id)
    `)
    .eq("visibility", true);

  // Search filter
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Nutrition filters
  if (filters) {
    const parsedFilters = JSON.parse(filters as string);
    parsedFilters.forEach((filter: { type: string; greaterThan: string; lessThan: string }) => {
      if (filter.type) {
        if (filter.greaterThan) {
          query = query.gt(filter.type, Number(filter.greaterThan));
        }
        if (filter.lessThan) {
          query = query.lt(filter.type, Number(filter.lessThan));
        }
      }
    });
  }

  // AI filter
  if (typeof created_by_ai !== "undefined") {
    query = query.eq("created_by_ai", created_by_ai === "true");
  }

  // Dietary restriction filter
  if (dietary_restrictions) {
    const restrictions = (dietary_restrictions as string).split(",").map(r => r.trim()).filter(Boolean);
    if (restrictions.length === 1) {
      query = query.eq("dietary_restrictions", restrictions[0]);
    } else if (restrictions.length > 1) {
      query = query.in("dietary_restrictions", restrictions);
    }
  }

  // Cuisine filter
  if (cuisine) {
    query = query.eq("cuisine", cuisine);
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    // Calculate averageRating and reviewCount
    const mealsWithRatings = (data || []).map((meal: any) => ({
      ...meal,
      averageRating: meal.reviews && meal.reviews.length > 0
        ? meal.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / meal.reviews.length
        : 0,
      reviewCount: meal.reviews ? meal.reviews.length : 0,
      userName: meal.users?.username || null,
    }));

    res.status(200).json(mealsWithRatings);
  } catch (err) {
    console.error('Error fetching meals:', err);
    res.status(500).send('Error fetching meals');
  }
});

// Copy a meal
router.post('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const user = (req as any).user;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  try {
    // Fetch the meal to be copied
    const { data: meal, error: mealError } = await supabase
      .from("meals")
      .select("*")
      .eq("id", meal_id)
      .single();

    if (mealError || !meal) {
      res.status(404).send('Meal not found');
      return;
    }

    // Insert a new meal with the same data but a new ID, user_id, and visibility set to false
    const { data: newMeal, error: insertError } = await supabase
      .from("meals")
      .insert([{
        ...meal,
        id: undefined,
        user_id: user.id,
        visibility: false,
        favorite: false,
        created_at: undefined
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({ message: 'Meal copied successfully', meal: newMeal });
  } catch (err) {
    console.error('Error copying meal:', err);
    res.status(500).send('Error copying meal');
  }
});

// Get meals for the current user (with filters and search)
router.get('/my-meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { search, filters, created_by_ai, dietary_restrictions, cuisine } = req.query;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  let query = supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id);

  // Add search filtering if the search query is provided
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Add filtering logic for nutritional values
  if (filters) {
    const parsedFilters = JSON.parse(filters as string);
    parsedFilters.forEach((filter: { type: string; greaterThan: string; lessThan: string }) => {
      if (filter.type) {
        if (filter.greaterThan) {
          query = query.gt(filter.type, Number(filter.greaterThan));
        }
        if (filter.lessThan) {
          query = query.lt(filter.type, Number(filter.lessThan));
        }
      }
    });
  }

  // Filter for AI-created meals if requested
  if (typeof created_by_ai !== "undefined") {
    query = query.eq("created_by_ai", created_by_ai === "true");
  }

  // Filter for dietary restrictions if provided
  if (dietary_restrictions) {
    const restrictions = (dietary_restrictions as string).split(",").map(r => r.trim()).filter(Boolean);
    if (restrictions.length === 1) {
      query = query.eq("dietary_restrictions", restrictions[0]);
    } else if (restrictions.length > 1) {
      query = query.in("dietary_restrictions", restrictions);
    }
  }

  // Filter for cuisine if provided
  if (cuisine) {
    query = query.eq("cuisine", cuisine);
  }

  try {
    const { data, error } = await query.order("favorite", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;

    res.status(200).json(data);
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
    ingredients,
    calories,
    protein,
    carbohydrates,
    fat,
    visibility,
    instructions,
    recipeLink,
    dietary_restrictions,
    servings,
    cuisine
  } = req.body;
  const user = (req as any).user;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  if (!name || !description || !ingredients) {
    res.status(400).send('Name, description, and ingredients are required');
    return;
  }

  let parsedIngredients;
  try {
    parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) throw new Error();
    parsedIngredients = parsedIngredients.map((ing: any) => ({
      ...ing,
      raw_name: ing.raw_name ?? ing.name
    }));
  } catch {
    res.status(400).send('Ingredients must be a valid JSON array');
    return;
  }

  try {
    const { error } = await supabase
      .from("meals")
      .update({
        name,
        description,
        ingredients: parsedIngredients,
        calories,
        protein,
        carbohydrates,
        fat,
        visibility: visibility ?? true,
        instructions,
        recipeLink,
        dietary_restrictions: dietary_restrictions || null,
        servings: servings ? Number(servings) : 1,
        cuisine: cuisine || null
      })
      .eq("id", meal_id)
      .eq("user_id", user.id);

    if (error) throw error;

    res.status(200).send('Meal updated successfully');
  } catch (err) {
    console.error('Error updating meal:', err);
    res.status(500).send('Error updating meal');
  }
});

// Get a specific meal by ID
router.get('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("meals")
      .select(`
        id, name, description, ingredients, calories, protein, carbohydrates, fat, instructions,
        recipeLink, visibility, created_at, picture, created_by_ai, created_by, dietary_restrictions, cuisine,
        user_id,
        users (username)
      `)
      .eq("id", meal_id)
      .single();

    if (error || !data) {
      res.status(404).send('Meal not found');
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching meal:', err);
    res.status(500).send('Error fetching meal');
  }
});

// Delete a meal
router.delete('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const user = (req as any).user;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  try {
    const { error } = await supabase
      .from("meals")
      .delete()
      .eq("id", meal_id)
      .eq("user_id", user.id);

    if (error) throw error;

    res.status(200).send('Meal deleted successfully');
  } catch (err) {
    console.error('Error deleting meal:', err);
    res.status(500).send('Error deleting meal');
  }
});

// Toggle favorite status
router.put('/meals/:meal_id/favorite', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params;
  const user = (req as any).user;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  try {
    // Get current favorite status
    const { data, error: fetchError } = await supabase
      .from("meals")
      .select("favorite")
      .eq("id", meal_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !data) {
      res.status(404).send('Meal not found or you are not authorized to update this meal');
      return;
    }

    const newFavoriteStatus = !data.favorite;

    const { error } = await supabase
      .from("meals")
      .update({ favorite: newFavoriteStatus })
      .eq("id", meal_id)
      .eq("user_id", user.id);

    if (error) throw error;

    res.status(200).json({ message: 'Favorite status updated successfully', favorite: newFavoriteStatus });
  } catch (err) {
    console.error('Error toggling favorite status:', err);
    res.status(500).send('Error toggling favorite status');
  }
});

export default router;