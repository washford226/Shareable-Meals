import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const router = Router();

// Add a meal to the meal plan
router.post('/meal-plan', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id, date, meal_type } = req.body;
  const user_id = (req as any).user?.id;

  if (!meal_id || !date || !meal_type) {
    res.status(400).send('Meal ID, date, and meal type are required');
    return;
  }

  try {
    const { error } = await supabase
      .from("Meal_Plan")
      .insert([{ meal_id, user_id, date, meal_type }]);

    if (error) throw error;

    res.status(201).send('Meal added to the meal plan successfully');
  } catch (err) {
    console.error('Error adding meal to the meal plan:', err);
    res.status(500).send('Error adding meal to the meal plan');
  }
});

// Get meals for a specific date
router.get('/meal-plan', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { date } = req.query;
  const user_id = (req as any).user?.id;

  if (!date) {
    res.status(400).send('Date is required');
    return;
  }

  try {
    const { data, error } = await supabase
      .from("Meal_Plan")
      .select(`
        *,
        meals (
          id,
          name,
          description,
          ingredients,
          calories,
          protein,
          carbohydrates,
          fat,
          instructions,
          recipeLink,
          picture,
          visibility
        )
      `)
      .eq("date", date)
      .eq("user_id", user_id);

    if (error) throw error;

    // Sort by meal_type order
    const mealTypeOrder = ['Breakfast', 'Lunch', 'Dinner', 'Other'];
    const sorted = (data || []).sort(
      (a, b) => mealTypeOrder.indexOf(a.meal_type) - mealTypeOrder.indexOf(b.meal_type)
    );

    res.status(200).json(sorted);
  } catch (err) {
    console.error('Error fetching meals for the date:', err);
    res.status(500).send('Error fetching meals for the date');
  }
});

// Update a meal plan entry
router.put('/meal-plan/:meal_plan_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_plan_id } = req.params;
  const { date, meal_type } = req.body;

  if (!date || !meal_type) {
    res.status(400).send('Date and meal type are required');
    return;
  }

  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Other'];
  if (!validMealTypes.includes(meal_type)) {
    res.status(400).send(`Invalid meal type. Valid types are: ${validMealTypes.join(', ')}`);
    return;
  }

  try {
    const { error } = await supabase
      .from("Meal_Plan")
      .update({ date, meal_type })
      .eq("meal_plan_id", meal_plan_id);

    if (error) throw error;

    res.status(200).send('Meal plan updated successfully');
  } catch (err) {
    console.error('Error updating meal plan:', err);
    res.status(500).send('Error updating meal plan');
  }
});

// Delete a meal from the meal plan
router.delete('/meal-plan/:meal_plan_id', authMiddleware, async (req: Request, res: Response) => {
  const { meal_plan_id } = req.params;

  try {
    const { error } = await supabase
      .from("Meal_Plan")
      .delete()
      .eq("meal_plan_id", meal_plan_id);

    if (error) throw error;

    res.status(200).send('Meal removed from the meal plan successfully');
  } catch (err) {
    console.error('Error removing meal from the meal plan:', err);
    res.status(500).send('Error removing meal from the meal plan');
  }
});

// Delete meal plan for a specific date
router.delete('/meal-plan-clear', authMiddleware, async (req: Request, res: Response) => {
  const { date } = req.body;
  const user_id = (req as any).user?.id;

  if (!date) {
    res.status(400).send('Date is required');
    return;
  }

  if (!user_id) {
    res.status(401).send('User is not authenticated');
    return;
  }

  try {
    const { error } = await supabase
      .from("Meal_Plan")
      .delete()
      .eq("date", date)
      .eq("user_id", user_id);

    if (error) throw error;

    res.status(200).send('Meal plan cleared for the date');
  } catch (err) {
    console.error('Error clearing meal plan:', err);
    res.status(500).send('Error clearing meal plan');
  }
});

// Get a specific meal plan by ID
router.get('/meal-plan/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("Meal_Plan")
      .select(`
        meal_plan_id,
        date,
        meal_type,
        meals (
          id,
          name,
          description,
          ingredients,
          calories,
          protein,
          carbohydrates,
          fat,
          instructions,
          recipeLink,
          picture,
          visibility
        )
      `)
      .eq("meal_plan_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        res.status(404).send({ message: 'Meal plan not found' });
      } else {
        throw error;
      }
      return;
    }

    const mealPlan = data;

    // Convert the picture BLOB to Base64 for frontend display if needed
    if (Array.isArray(mealPlan?.meals)) {
      mealPlan.meals = mealPlan.meals.map((meal: any) => {
        if (meal.picture && Buffer.isBuffer(meal.picture)) {
          return {
            ...meal,
            picture: `data:image/jpeg;base64,${meal.picture.toString('base64')}`
          };
        } else if (!meal.picture) {
          return {
            ...meal,
            picture: null
          };
        }
        return meal;
      });
    }

    res.status(200).json(mealPlan);
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).send({ message: 'Error fetching meal plan' });
  }
});

export default router;