import { Router } from 'express';
import meal from './meals'; // Import the meal route
import reviews from './reviews'; // Import the reviews route
import users from './users'; // Import the users route
import mealplan from './mealplan'; // Import the meal plan route
import report from './report'; // Import the report route
import AI from './AI'; // Import the AI route
import urlmeals from './urlmeals'; // Import the URL meals route
import pantry from './pantry'; // Import the pantry route


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

router.use('/urlmeals', urlmeals); // Routes for URL meals

router.use('/pantry', pantry); // Routes for pantry items

export default router;