import { Router } from 'express';
import meal from './meals'; // Meal routes (should use Supabase in meals.ts)
import reviews from './reviews'; // Review routes (should use Supabase in reviews.ts)
import users from './users'; // User routes (should use Supabase in users.ts)
import mealplan from './mealplan'; // Meal plan routes (should use Supabase in mealplan.ts)
import report from './report'; // Report routes (should use Supabase in report.ts)
import AI from './AI'; // AI routes (should use Supabase in AI.ts)
import urlmeals from './urlmeals'; // URL meals routes (should use Supabase in urlmeals.ts)
import pantry from './pantry'; // Pantry routes (should use Supabase in pantry.ts)
import comp from './competition'; // Competition routes (should use Supabase in competition.ts)

// All imported route files should be updated to use Supabase as their database layer.

const router = Router();

// Routes for meal-related operations
router.use('/meal', meal);

// Routes for review-related operations
router.use('/reviews', reviews);

// Routes for user-related operations
router.use('/users', users);

// Routes for meal plan-related operations
router.use('/mealplan', mealplan);

// Routes for reporting issues
router.use('/report', report);

// Routes for AI-related operations
router.use('/AI', AI);

// Routes for URL meals
router.use('/urlmeals', urlmeals);

// Routes for pantry items
router.use('/pantry', pantry);

// Routes for competitions
router.use('/comp', comp);

export default router;