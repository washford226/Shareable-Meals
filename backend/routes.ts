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
import crypto from 'crypto';

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
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const db = (req as any).db;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    // Check if the user exists
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'User with this email does not exist' });
      return;
    }

    const userId = rows[0].id;

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 3600000); // Token valid for 1 hour

    // Save the token and expiration in the database
    await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [
      userId,
      token,
      tokenExpiration,
    ]);

    // Send the reset link via email
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // Or another email service
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password',
      },
    });

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    const mailOptions = {
      from: 'your-email@gmail.com',
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    console.error('Error sending password reset email:', err);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

//reset password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;
  const db = (req as any).db;

  if (!token || !password) {
    res.status(400).json({ error: 'Token and new password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long' });
    return;
  }

  try {
    // Validate the token
    const [rows] = await db.query('SELECT user_id, expires_at FROM password_resets WHERE token = ?', [token]);
    if (rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }

    const { user_id, expires_at } = rows[0];
    if (new Date() > new Date(expires_at)) {
      res.status(400).json({ error: 'Token has expired' });
      return;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user_id]);

    // Delete the token
    await db.query('DELETE FROM password_resets WHERE token = ?', [token]);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'An error occurred while resetting the password' });
  }
});

// Update user information
router.put('/user/:username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { calories_goal, dietary_restrictions } = req.body; // Only allow these fields to be updated
  const user = (req as any).user;
  const db = (req as any).db;

  if (username !== user.username) {
    res.status(403).send('You are not authorized to update this user');
    return;
  }

  // Only include fields that are allowed to be updated
  const fields = { calories_goal, dietary_restrictions };
  const { query, values } = buildUpdateQuery(fields);

  if (!query) {
    res.status(400).send('No fields provided to update');
    return;
  }

  try {
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

  db.query('SELECT * FROM users WHERE id = ?', [user.id])
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
router.post('/upload-profile-picture', authMiddleware, upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const db = (req as any).db;
  const profilePicture = req.file;

  try {
    // Validate file existence
    if (!profilePicture) {
      res.status(400).send({ message: 'No file uploaded' });
      return;
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(profilePicture.mimetype)) {
      res.status(400).send({ message: 'Invalid file type. Only JPEG and PNG are allowed.' });
      return;
    }

    // Validate file size (limit to 5 MB)
    const maxFileSize = 5 * 1024 * 1024; // 5 MB
    if (profilePicture.size > maxFileSize) {
      res.status(400).send({ message: 'File size exceeds the limit of 5 MB.' });
      return;
    }

    // Save the profile picture to the database
    const query = 'UPDATE users SET profile_picture = ? WHERE id = ?';
    await db.query(query, [profilePicture.buffer, user.id]);

    res.status(200).send({ message: 'Profile picture uploaded successfully' });
  } catch (err) {
    console.error('Error uploading profile picture:', err);
    res.status(500).send({ message: 'Error uploading profile picture' });
  }
});

//Change password
router.put('/user/:username/password', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { currentPassword, password } = req.body;
  const user = (req as any).user; // Authenticated user
  const db = (req as any).db;

  if (!currentPassword || !password) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long' });
    return;
  }

  if (username !== user.username) {
    res.status(403).json({ error: 'You are not authorized to update this user' });
    return;
  }

  try {
    // Fetch the user's current hashed password from the database
    const [rows] = await db.query('SELECT password FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const hashedPassword = rows[0].password;

    // Compare the current password with the hashed password
    const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash the new password
    const newHashedPassword = await bcrypt.hash(password, 10);

    // Update the password in the database
    await db.query('UPDATE users SET password = ? WHERE username = ?', [newHashedPassword, username]);

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ error: 'An error occurred while updating the password' });
  }
});

//Change email
router.put('/user/:username/email', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { currentPassword, email } = req.body;
  const user = (req as any).user; // Authenticated user
  const db = (req as any).db;

  if (!currentPassword || !email) {
    res.status(400).json({ error: 'Current password and new email are required' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (username !== user.username) {
    res.status(403).json({ error: 'You are not authorized to update this user' });
    return;
  }

  try {
    // Fetch the user's current hashed password from the database
    const [rows] = await db.query('SELECT password FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const hashedPassword = rows[0].password;

    // Compare the current password with the hashed password
    const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update the email in the database
    await db.query('UPDATE users SET email = ? WHERE username = ?', [email, username]);

    res.status(200).json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Error updating email:', err);
    res.status(500).json({ error: 'An error occurred while updating the email' });
  }
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
router.post('/meals', authMiddleware, upload.single('picture'), async (req: Request, res: Response): Promise<void> => {
  const { name, description, ingredients, calories, protein, carbohydrates, fat, visibility } = req.body;
  const user_id = req.user?.id;
  const picture = req.file ? req.file.buffer : null; // Get the uploaded image as a buffer
  const db = (req as any).db;

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
      INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, visibility, user_id, picture)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      name,
      description,
      JSON.stringify(ingredients),
      calories,
      protein,
      carbohydrates,
      fat,
      visibility ?? true,
      user_id,
      picture,
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
router.get('/meals', authMiddleware, (req: Request, res: Response) => {
  const db = (req as any).db;
  const { search, filters } = req.query; // Get the search and filters parameters

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
      meals.created_at, 
      meals.picture, -- Include the picture column
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
    ORDER BY meals.created_at DESC
  `;

  db.query(query, values)
    .then(([rows]: [any[], any]) => {
      // Convert the picture BLOB to Base64 for frontend display
      const mealsWithImages = rows.map((meal: any) => ({
        ...meal,
        picture: meal.picture ? `data:image/jpeg;base64,${meal.picture.toString('base64')}` : null,
      }));

      res.status(200).json(mealsWithImages);
    })
    .catch((err: Error) => {
      console.error('Error fetching meals:', err);
      res.status(500).send('Error fetching meals');
    });
});

//make a review
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
router.post('/add-meal', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user; // Get the authenticated user
  const db = (req as any).db; // Get the database instance
  const { meal_id } = req.body; // The ID of the meal to copy

  if (!user) {
    res.status(401).send('User not authenticated');
    return;
  }

  if (!meal_id) {
    res.status(400).send('Meal ID is required');
    return;
  }

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
      INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, visibility, user_id, picture)
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
      false, // Set visibility to false for copied meals
      user.id,
      meal.picture, // Copy the picture
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
      meals.visibility,
      meals.created_at,
      meals.picture -- Include the picture column
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
      SET name = ?, description = ?, ingredients = ?, calories = ?, protein = ?, carbohydrates = ?, fat = ?, visibility = ?
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

router.post('/report', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id, reason } = req.body;
  const user = (req as any).user; // Authenticated user
  const db = (req as any).db;

  if (!meal_id || !reason) {
    res.status(400).send('Meal ID and reason are required');
    return;
  }

  try {
    await db.query(
      'INSERT INTO REPORTS (user_id, meal_id, reason) VALUES (?, ?, ?)',
      [user.id, meal_id, reason]
    );
    res.status(201).send('Report submitted successfully');
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).send('Error submitting report');
  }
});


  router.get('/', authMiddleware, (req, res) => {
    // Example: Fetch and return food data
    const foods = [
      { id: 1, name: 'Apple', category: 'Fruits' },
      { id: 2, name: 'Carrot', category: 'Vegetables' },
      { id: 3, name: 'Chicken', category: 'Proteins' },
    ];
    res.json(foods);
  });


export default router;
