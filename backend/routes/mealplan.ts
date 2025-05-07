import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware'; // Adjust the path as needed

const router = Router();

// Add a meal to the meal plan
router.post('/meal-plan', authMiddleware, (req: Request, res: Response): void => {
    const { meal_id, date, meal_type } = req.body; // Extract data from the request body
    const user_id = (req as any).user.id; // Get the user ID from the authenticated user (assumes authMiddleware sets req.user)
  
    const db = (req as any).db; // Get the database instance
  
    // Validate input
    if (!meal_id || !date || !meal_type) {
      res.status(400).send('Meal ID, date, and meal type are required');
      return;
    }
  
    const query = `
      INSERT INTO Meal_Plan (meal_id, user_id, date, meal_type)
      VALUES (?, ?, ?, ?)
    `;
  
    db.query(query, [meal_id, user_id, date, meal_type])
      .then(() => {
        res.status(201).send('Meal added to the meal plan successfully');
      })
      .catch((err: Error) => {
        console.error('Error adding meal to the meal plan:', err);
        res.status(500).send('Error adding meal to the meal plan');
      });
  });
  
  //Get meals for a specific date
  router.get('/meal-plan', authMiddleware, (req: Request, res: Response): void => {
    const { date } = req.query; // Extract the date from the query parameters
    const db = (req as any).db; // Get the database instance
  
    if (!date) {
      res.status(400).send('Date is required');
      return;
    }
  
    const query = `
      SELECT *
      FROM Meal_Plan mp
      INNER JOIN meals m ON mp.meal_id = m.id
      WHERE mp.date = ?
      ORDER BY FIELD(mp.meal_type, 'Breakfast', 'Lunch', 'Dinner', 'Other')
    `;
  
    db.query(query, [date])
      .then(([rows]: [any[], any]) => {
        res.status(200).json(rows);
      })
      .catch((err: Error) => {
        console.error('Error fetching meals for the date:', err);
        res.status(500).send('Error fetching meals for the date');
      });
  });
  
  router.put('/meal-plan/:meal_plan_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { meal_plan_id } = req.params; // Extract the meal_plan_id from the URL
    const { date, meal_type } = req.body; // Extract the updated fields from the request body
    const db = (req as any).db; // Get the database instance
  
    if (!date || !meal_type) {
      res.status(400).send('Date and meal type are required');
      return;
    }
  
    const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Other'];
    if (!validMealTypes.includes(meal_type)) {
      res.status(400).send(`Invalid meal type. Valid types are: ${validMealTypes.join(', ')}`);
      return;
    }
  
    const query = `
      UPDATE Meal_Plan
      SET date = ?, meal_type = ?
      WHERE meal_plan_id = ?
    `;
  
    try {
      await db.query(query, [date, meal_type, meal_plan_id]);
      res.status(200).send('Meal plan updated successfully');
    } catch (err) {
      console.error('Error updating meal plan:', err);
      res.status(500).send('Error updating meal plan');
    }
  });
  
  router.delete('/meal-plan/:meal_plan_id', authMiddleware, (req: Request, res: Response) => {
    const { meal_plan_id } = req.params; // Extract the meal_plan_id from the URL
    const db = (req as any).db; // Get the database instance
  
    const query = `
      DELETE FROM Meal_Plan
      WHERE meal_plan_id = ?
    `;
  
    db.query(query, [meal_plan_id])
      .then(() => {
        res.status(200).send('Meal removed from the meal plan successfully');
      })
      .catch((err: Error) => {
        console.error('Error removing meal from the meal plan:', err);
        res.status(500).send('Error removing meal from the meal plan');
      });
  });
  
  //Delete meal plan for a specific date
  router.delete('/meal-plan-clear', authMiddleware, (req: Request, res: Response) => {
    const { date } = req.body; // Extract the date from the request body
    const user_id = req.user?.id; // Get the authenticated user's ID
    const db = (req as any).db; // Get the database instance
  
    if (!date) {
      res.status(400).send('Date is required');
      return;
    }
  
    if (!user_id) {
      res.status(401).send('User is not authenticated');
      return;
    }
  
    const query = `
      DELETE FROM Meal_Plan
      WHERE date = ? AND user_id = ?
    `;
  
    db.query(query, [date, user_id])
      .then(() => {
        res.status(200).send('Meal plan cleared for the date');
      })
      .catch((err: Error) => {
        console.error('Error clearing meal plan:', err);
        res.status(500).send('Error clearing meal plan');
      });
  });

  // Get a specific meal plan by ID
router.get('/meal-plan/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // Extract the meal plan ID from the URL
  const db = (req as any).db; // Get the database instance

  try {
    const query = `
      SELECT 
        mp.meal_plan_id, 
        mp.date, 
        mp.meal_type, 
        m.id AS meal_id, 
        m.name, 
        m.description, 
        m.ingredients, 
        m.calories, 
        m.protein, 
        m.carbohydrates, 
        m.fat, 
        m.instructions, 
        m.recipeLink, 
        m.picture, 
        m.visibility
      FROM Meal_Plan mp
      INNER JOIN meals m ON mp.meal_id = m.id
      WHERE mp.meal_plan_id = ?
    `;

    const [rows]: [any[], any] = await db.query(query, [id]);

    if (rows.length === 0) {
      res.status(404).send({ message: 'Meal plan not found' });
      return;
    }

    const mealPlan = rows[0];

    // Convert the picture BLOB to Base64 for frontend display
    if (mealPlan.picture) {
      mealPlan.picture = `data:image/jpeg;base64,${mealPlan.picture.toString('base64')}`;
    } else {
      mealPlan.picture = null; // Set to null if no picture exists
    }

    res.status(200).json(mealPlan);
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).send({ message: 'Error fetching meal plan' });
  }
});

export default router;