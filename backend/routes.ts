import { Router, Request, Response } from 'express';

// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string };
    }
  }
}
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import authMiddleware from './authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  profile_picture: string | Blob;
}

router.get('/', (req: Request, res: Response) => {
  res.send('Welcome to the Meal API');
});

// Signup user
router.post('/signup', upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, calories_goal, dietary_restrictions } = req.body;
  const profilePicture = req.file?.buffer;
  const db = (req as any).db;

  // Validate file type
  if (req.file && !['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
    res.status(400).send({ message: 'Invalid file type. Only JPEG and PNG are allowed.' });
  }

  // Validate file size
  if (req.file && req.file.size > 5 * 1024 * 1024) { // 5 MB limit
    res.status(400).send({ message: 'File size exceeds the limit of 5 MB.' });
    return;
  }

  db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email])
    .then(async ([rows]: [User[], any]) => {
      if (rows.length > 0) {
        return res.status(400).send({ message: 'Username or email already exists' });
      }

      return bcrypt.hash(password, 10);
    })
    .then(async (hashedPassword: string) => {
      const query = 'INSERT INTO users (username, email, password, calories_goal, dietary_restrictions, profile_picture) VALUES (?, ?, ?, ?, ?, ?)';
      return db.query(query, [username, email, hashedPassword, calories_goal, dietary_restrictions, profilePicture]);
    })
    .then(() => {
      res.status(200).send('User signed up successfully');
    })
    .catch((err: Error) => {
      console.error('Error inserting data:', err);
      res.status(500).send('Error inserting data');
    });
});

// Login user
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const db = (req as any).db;

  db.query('SELECT * FROM users WHERE username = ?', [username])
    .then(([rows]: [User[], any]) => {
      if (rows.length === 0) {
        return res.status(404).send('User does not exist');
      }

      const user = rows[0];
      return bcrypt.compare(password, user.password)
        .then((isPasswordValid: boolean) => {
          if (!isPasswordValid) {
            return res.status(400).send('Password incorrect');
          }

          const secret: string | undefined = process.env.JWT_SECRET;
          if (!secret) {
            return res.status(500).send('JWT secret is not defined');
          }

          const token: string = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '1h' });
          res.status(200).json({ message: 'User logged in successfully', token });
        });
    })
    .catch((err: Error) => {
      console.error('Error logging in:', err);
      res.status(500).send('Error logging in');
    });
});

// Forgot Password or username
router.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  const db = (req as any).db;

  (async () => {
    try {
      const [rows]: [User[], any] = await db.query('SELECT username, password FROM users WHERE email = ?', [email]);

      if (rows.length === 0) {
        return res.status(404).send('No user found with this email');
      }

      const user = rows[0];

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Account Information',
        text: `Hello ${user.username},\n\nHere is your account information:\n\nUsername: ${user.username}\nPassword: ${user.password}\n\nIf you did not request this email, please ignore it.\n\nThank you!`,
      };

      await transporter.sendMail(mailOptions);

      res.status(200).send('An email with your account information has been sent');
    } catch (err) {
      console.error('Error sending forgot password email:', err);
      res.status(500).send('Error sending email');
    }
  })();
});

// Update user information
router.put('/user/:username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { email, password, calories_goal, dietary_restrictions } = req.body;
  const user = (req as any).user;
  const db = (req as any).db;

  if (username !== user.username) {
    res.status(403).send('You are not authorized to update this user');
    return;
  }

  const fields = { email, password, calories_goal, dietary_restrictions };
  const { query, values } = buildUpdateQuery(fields);

  if (!query) {
    res.status(400).send('No fields provided to update');
    return;
  }

  try {
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const passwordIndex = Object.keys(fields).indexOf('password');
      if (passwordIndex !== -1) {
        values[passwordIndex] = hashedPassword;
      }
    }

    const sql = `UPDATE users SET ${query} WHERE username = ?`;
    values.push(username);

    await db.query(sql, values);
    res.status(200).send('User updated successfully');
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).send('Error updating user');
  }
});

// Delete user
router.delete('/userdelete', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const db = (req as any).db;

  const query = 'DELETE FROM users WHERE id = ?';
  db.query(query, [user.id])
    .then(() => {
      res.status(200).send('User deleted successfully');
    })
    .catch((err: Error) => {
      console.error('Error deleting user:', err);
      res.status(500).send('Error deleting user');
    });
});

// Get user information
router.get('/user', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const db = (req as any).db;

  db.query('SELECT id, username, calories_goal, dietary_restrictions, profile_picture FROM users WHERE id = ?', [user.id])
    .then(([rows]: [User[], any]) => {
      if (rows.length === 0) {
        return res.status(404).send('User not found');
      }

      const userData = rows[0];

      // Convert the profile_picture BLOB to a Base64 string
      if (userData.profile_picture) {
        const buffer = Buffer.isBuffer(userData.profile_picture)
            ? userData.profile_picture
            : Buffer.from(userData.profile_picture as string);
        userData.profile_picture = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }

      res.status(200).json(userData);
    })
    .catch((err: Error) => {
      console.error('Error fetching user data:', err);
      res.status(500).send('Error fetching user data');
    });
});

// Upload profile picture
router.post('/upload-profile-picture', authMiddleware, upload.single('profile_picture'), (req: Request, res: Response): void => {
  const user = (req as any).user;
  const db = (req as any).db;
  const profilePicture = req.file?.buffer;

  if (!profilePicture) {
    res.status(400).send('No file uploaded');
    return;
  }

  const query = 'UPDATE users SET profile_picture = ? WHERE id = ?';
  db.query(query, [profilePicture, user.id])
    .then(() => {
      res.status(200).send('Profile picture uploaded successfully');
    })
    .catch((err: Error) => {
      console.error('Error uploading profile picture:', err);
      res.status(500).send('Error uploading profile picture');
    });
});

const buildUpdateQuery = (fields: Record<string, any>) => {
  const fieldsToUpdate = [];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      fieldsToUpdate.push(`${key} = ?`);
      values.push(value);
    }
  }

  return { query: fieldsToUpdate.join(', '), values };
};

// Create a new meal
<<<<<<< Updated upstream
router.post("/meals", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { name, description, ingredients, calories, protein, carbohydrates, fat, visibility } = req.body.meal || {};
=======
router.post('/meals', authMiddleware, upload.single('picture'), async (req: Request, res: Response): Promise<void> => {
  const { name, description, ingredients, calories, protein, carbohydrates, fat, instructions,recipeLink, visibility } = req.body;
>>>>>>> Stashed changes
  const user_id = req.user?.id;
  const db = (req as any).db;

  if (!user_id) {
    res.status(401).send("User is not authenticated");
    return;
  }

  if (!name || !description || !ingredients) {
    res.status(400).send("Missing required fields");
    return;
  }

  try {
    const query = `
<<<<<<< Updated upstream
      INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, visibility, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
=======
      INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, instructions, recipeLink, visibility, user_id, picture)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>>>>>>> Stashed changes
    `;
    const values = [
      name,
      description,
      JSON.stringify(ingredients),
      calories,
      protein,
      carbohydrates,
      fat,
      JSON.stringify(instructions),
      recipeLink,
      visibility ?? true,
      user_id,
    ];
    await db.query(query, values);
    res.status(201).send("Meal added successfully");
  } catch (err) {
    console.error("Error adding meal:", err);
    res.status(500).send("Error adding meal");
  }
});


// Get all meals
router.get('/meals', authMiddleware, (req: Request, res: Response) => {
  const db = (req as any).db;
  const { search } = req.query; // Get the search query parameter

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
      meals.created_at, 
      users.username AS userName,
      COALESCE(AVG(reviews.rating), 0) AS averageRating -- Calculate the average rating
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

  query += `
    GROUP BY meals.id, users.username -- Group by meal ID and username
    ORDER BY meals.created_at DESC
  `;

  db.query(query, values)
    .then(([rows]: [any[], any]) => {
      res.status(200).json(rows);
    })
    .catch((err: Error) => {
      console.error('Error fetching meals:', err);
      res.status(500).send('Error fetching meals');
    });
});

router.post('/reviews', authMiddleware, (req: Request, res: Response) => {
  const { meal_id, rating, comment } = req.body;
  const user_id = req.user?.id ?? (() => { throw new Error('User is not authenticated'); })(); // Ensure user is defined
  const db = (req as any).db; // Retrieve the db instance from the request object

  const query = `
    INSERT INTO Reviews (meal_id, user_id, rating, comment)
    VALUES (?, ?, ?, ?)
  `;

  db.query(query, [meal_id, user_id, rating, comment])
    .then(() => res.status(201).send('Review created successfully'))
    .catch((err: Error) => {
      console.error('Error creating review:', err);
      res.status(500).send('Error creating review');
    });
});

// Get reviews for a meal
router.get('/reviews', authMiddleware, (req: Request, res: Response) => {
  const { meal_id } = req.query;
  const db = (req as any).db; // Retrieve the db instance from the request object

  const query = `
    SELECT r.review_id AS id, r.rating, r.comment, r.created_at, u.username AS userName
    FROM Reviews r
    INNER JOIN users u ON r.user_id = u.id
    WHERE r.meal_id = ?
    ORDER BY r.created_at DESC
  `;

  db.query(query, [meal_id])
    .then(([rows]: [any[], any]) => res.status(200).json(rows))
    .catch((err: Error) => {
      console.error('Error fetching reviews:', err);
      res.status(500).send('Error fetching reviews');
    });
});

//Copy meal
router.post('/add-meal', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user; // Get the authenticated user
  const db = (req as any).db; // Get the database instance
  const { name, description, ingredients, calories, protein, carbohydrates, fat, visibility } = req.body;

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  const query = `
    INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, visibility, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [name, description, ingredients, calories, protein, carbohydrates, fat, visibility ?? false, user.id])
    .then(() => {
      res.status(201).send('Meal added successfully');
    })
    .catch((err: Error) => {
      console.error('Error adding meal:', err);
      res.status(500).send('Error adding meal');
    });
});


// Add a meal to the meal plan
router.post('/meal-plan', authMiddleware, (req: Request, res: Response): void => {
  const { meal_id, date, meal_type } = req.body; // Extract data from the request body
  const db = (req as any).db; // Get the database instance

  // Validate the input
  if (!meal_id || !date || !meal_type) {
    res.status(400).send('Meal ID, date, and meal type are required');
    return;
  }

<<<<<<< Updated upstream
  // Ensure the meal_type is valid
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Other'];
  if (!validMealTypes.includes(meal_type)) {
    res.status(400).send(`Invalid meal type. Valid types are: ${validMealTypes.join(', ')}`);
    return;
=======
  try {
    // Fetch the meal to copy
    const [rows]: [any[], any] = await db.query('SELECT * FROM meals WHERE id = ?', [meal_id]);
    if (rows.length === 0) {
      res.status(404).send('Meal not found');
      return;
    }

    const meal = rows[0];

    // Insert the copied meal for the current user
    const query = `
      INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, instructions, recipeLink, visibility, user_id, picture)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      meal.name,
      meal.description,
      meal.ingredients,
      meal.calories,
      meal.protein,
      meal.carbohydrates,
      meal.fat,
      meal.instructions,
      meal.recipeLink,
      false, // Set visibility to false for copied meals
      user.id,
      meal.picture, // Copy the picture
    ];

    await db.query(query, values);
    res.status(201).send('Meal copied successfully');
  } catch (err) {
    console.error('Error copying meal:', err);
    res.status(500).send('Error copying meal');
>>>>>>> Stashed changes
  }

  const query = `
    INSERT INTO meal_plans (meal_id, date, meal_type)
    VALUES (?, ?, ?)
  `;

  db.query(query, [meal_id, date, meal_type])
    .then(() => {
      res.status(201).send('Meal added to the meal plan successfully');
    })
    .catch((err: Error) => {
      console.error('Error adding meal to the meal plan:', err);
      res.status(500).send('Error adding meal to the meal plan');
    });
});

// Get meals for the current user (without reviews)
router.get('/my-meals', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user; // Get the authenticated user
  const db = (req as any).db; // Get the database instance
  const { search } = req.query; // Get the search query parameter

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
<<<<<<< Updated upstream
      meals.created_at
=======
      meals.instructions,
      meals.recipeLink,
      meals.visibility,
      meals.created_at,
      meals.picture -- Include the picture column
>>>>>>> Stashed changes
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

  query += `
    ORDER BY meals.created_at DESC
  `;

  try {
    const [rows]: [any[], any] = await db.query(query, values);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching user meals:', err);
    res.status(500).send('Error fetching user meals');
  }
});

<<<<<<< Updated upstream
=======
// Edit a meal
router.put('/meals/:meal_id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.params; // Extract the meal ID from the URL
  const { name, description, ingredients, calories, protein, carbohydrates, fat, visibility } = req.body; // Extract updated fields from the request body
  const user = (req as any).user; // Get the authenticated user
  const db = (req as any).db; // Get the database instance

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  // Validate input
  if (!name || !description || !ingredients || calories === undefined || protein === undefined || carbohydrates === undefined || fat === undefined) {
    res.status(400).send('All fields are required');
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
      SET name = ?, description = ?, ingredients = ?, calories = ?, protein = ?, carbohydrates = ?, fat = ?, instructions = ?, recipeLink = ?, visibility = ?
      WHERE id = ? AND user_id = ?
    `;
    const values = [name, description, ingredients, calories, protein, carbohydrates, fat, visibility ?? false, meal_id, user.id];

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
        meals.instructions,
        meals.recipeLink,
        meals.visibility, 
        meals.created_at, 
        meals.picture, -- Include the picture column
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

>>>>>>> Stashed changes
// Add a meal to the meal plan
router.post('/meal-plan', authMiddleware, (req: Request, res: Response): void => {
  const { meal_id, date, meal_type } = req.body; // Extract data from the request body
  const db = (req as any).db; // Get the database instance

  // Validate the input
  if (!meal_id || !date || !meal_type) {
    res.status(400).send('Meal ID, date, and meal type are required');
    return;
  }

  // Ensure the meal_type is valid
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Other'];
  if (!validMealTypes.includes(meal_type)) {
    res.status(400).send(`Invalid meal type. Valid types are: ${validMealTypes.join(', ')}`);
    return;
  }

  const query = `
    INSERT INTO Meal_Plan (meal_id, date, meal_type)
    VALUES (?, ?, ?)
  `;

  db.query(query, [meal_id, date, meal_type])
    .then(() => {
      res.status(201).send('Meal added to the meal plan successfully');
    })
    .catch((err: Error) => {
      console.error('Error adding meal to the meal plan:', err);
      res.status(500).send('Error adding meal to the meal plan');
    });
});

router.get('/meal-plan', authMiddleware, (req: Request, res: Response): void => {
  const { date } = req.query; // Extract the date from the query parameters
  const db = (req as any).db; // Get the database instance

  if (!date) {
    res.status(400).send('Date is required');
    return;
  }

  const query = `
    SELECT mp.meal_plan_id, mp.date, mp.meal_type, m.name, m.description, m.calories, m.protein, m.carbohydrates, m.fat
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

router.get('/meal-plan-range', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query; // Extract the date range from the query parameters
  const db = (req as any).db; // Get the database instance

  if (!startDate || !endDate) {
    res.status(400).send('Start date and end date are required');
    return;
  }

  const query = `
    SELECT mp.meal_plan_id, mp.date, mp.meal_type, m.name, m.description, m.calories, m.protein, m.carbohydrates, m.fat
    FROM Meal_Plan mp
    INNER JOIN meals m ON mp.meal_id = m.id
    WHERE mp.date BETWEEN ? AND ?
    ORDER BY mp.date ASC, FIELD(mp.meal_type, 'Breakfast', 'Lunch', 'Dinner', 'Other')
  `;

  try {
    const [rows]: [any[], any] = await db.query(query, [startDate, endDate]);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching meals for the date range:', err);
    res.status(500).send('Error fetching meals for the date range');
  }
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

router.delete('/meal-plan-clear', authMiddleware, (req: Request, res: Response) => {
  const { date } = req.body; // Extract the date from the request body
  const db = (req as any).db; // Get the database instance

  if (!date) {
    res.status(400).send('Date is required');
    return;
  }

  const query = `
    DELETE FROM Meal_Plan
    WHERE date = ?
  `;

  db.query(query, [date])
    .then(() => {
      res.status(200).send('Meal plan cleared for the date');
    })
    .catch((err: Error) => {
      console.error('Error clearing meal plan:', err);
      res.status(500).send('Error clearing meal plan');
    });
});

// Define the foodData object with nutritional information
const foodData: Record<string, any> = {
  apple: {
    calories: 52,
    protein: 0.3,
    carbohydrates: 14,
    fat: 0.2,
  },
  banana: {
    calories: 96,
    protein: 1.3,
    carbohydrates: 27,
    fat: 0.3,
  },
  chicken: {
    calories: 239,
    protein: 27,
    carbohydrates: 0,
    fat: 14,
  },
  // Add more foods as needed
};

// API Endpoint to retrieve nutritional information for foods via query parameters
router.get('/v1/foods', (req: Request, res: Response): void => {
  const foodName = req.query.food?.toString().toLowerCase();

  if (foodName && foodData[foodName]) {
    res.status(200).json({
      food: foodName,
      nutrition: foodData[foodName],
    });
  } else {
    res.status(404).json({
      error: 'Food not found. Please provide a valid food name.',
    });
  }
});

export default router;