import { Router } from 'express';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import authMiddleware from '../authMiddleware';
import crypto from 'crypto';
import { Request, Response } from 'express';
import axios from 'axios';
import { calculateAndStoreMealNutrition } from './usda_linking';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

  const [rows]: any[] = await db.query(sql, [
    NUTRIENT_IDS.calories,
    NUTRIENT_IDS.protein,
    NUTRIENT_IDS.fat,
    NUTRIENT_IDS.carbs,
    ...likeParams
  ]);

  return rows.length > 0 ? rows[0] : null;
}


// Nutrient IDs for calories, protein, fat, and carbs (update these IDs as per your database schema)
const NUTRIENT_IDS = {
  calories: 1008, 
  protein: 1003,  
  fat: 1004,   
  carbs: 1005  
};

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  profile_picture: string | Blob;
}

// Example route
router.get('/', (req, res) => {
    res.send('Meal endpoint');
});

function parseAIIngredientLine(line: string) {
  let cleaned = line.replace(/^[\*\-\d\.\s]+/, '').trim();
  if (/ or /i.test(cleaned)) {
    cleaned = cleaned.split(/ or /i)[0].trim();
  }
  cleaned = cleaned.replace(/\(.*?\)/g, '').trim();
  if (/for the|optional|instructions?/i.test(cleaned)) {
    return null;
  }
  const match = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s+([a-zA-Z]+)\s+(.+)$/);
  if (match) {
    // If quantity is missing or not a number, default to 1
    const quantity = !isNaN(Number(match[1])) ? match[1] : "1";
    return {
      quantity,
      unit: match[2],
      name: match[3],
      raw_name: match[3],
    };
  }
  // Fallback: treat whole line as name, quantity 1
  return { quantity: "1", unit: "", name: cleaned, raw_name: cleaned };
}

// Function to generate AI meals
const generateAIMeals = async (dietary_restrictions?: string, allergies?: string): Promise<any[]> => {
  try {
    // Construct the AI prompt
    const prompt = `
      Generate 5 meal ideas based on the following criteria:
      - Dietary restrictions: ${dietary_restrictions || 'None'}
      - Allergies: ${allergies || 'None'}
      Each meal should include:
      - Name: [Meal Name]
      - Description: [Meal Description]
      - Ingredients: [List of Ingredients]
      - Instructions: [Cooking Instructions]
    `;

    // Send the request to the AI API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    // Extract the raw text response
    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      console.error("Gemini response did not include meal text:", response.data);
      throw new Error("Failed to generate meal text from Gemini API.");
    }

    // Parse the AI response into structured meals
    const meals = parseMultipleMealResponses(rawText);

    if (!meals || meals.length === 0) {
      console.error("Failed to parse meal response:", rawText);
      throw new Error("Failed to parse meal response from Gemini API.");
    }

    return meals;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Error from Gemini API:", error.response.data);
      throw new Error(error.response.data.error?.message || "Error from Gemini API");
    } else {
      console.error("Unexpected error generating meals:", error);
      throw new Error("An internal server error occurred.");
    }
  }
};

// Helper function to parse multiple meals from the AI response
function parseMultipleMealResponses(rawText: string): any[] {
  const meals: any[] = [];

  // Normalize the raw text to match the parser's expected format
  const normalizedText = rawText.replace(/\*\*\d+\.\s*Name:/g, '**Name:**'); // Replace "**[number]. Name:" with "**Name:**"

  // Split the normalized text by each meal section starting with "**Name:**"
  const mealSections = normalizedText.split(/\*\*Name:\*\*/g);

  for (const section of mealSections) {
    if (section.trim()) {
      const meal = parseMealResponse(`**Name:**${section.trim()}`); // Add back the "**Name:**" prefix for parsing
      if (meal.name && meal.description && meal.ingredients && meal.instructions) {
        meals.push(meal);
      }
    }
  }

  return meals;
}

// Helper function to parse a single meal response
function parseMealResponse(rawText: string) {
  const meal: {
    name?: string;
    description?: string;
    ingredients?: string[];
    instructions?: string[];
  } = {};

  const nameMatch = rawText.match(/\*\*Name:\*\*\s*(.+)/i);
  const descriptionMatch = rawText.match(/\*\*Description:\*\*\s*(.+)/i);
  const ingredientsMatch = rawText.match(/\*\*Ingredients:\*\*\s*([\s\S]*?)(?=\*\*Instructions:|$)/i);
  const instructionsMatch = rawText.match(/\*\*Instructions:\*\*\s*([\s\S]*)/i);

  meal.name = nameMatch ? nameMatch[1].trim() : undefined;
  meal.description = descriptionMatch ? descriptionMatch[1].trim() : undefined;

  // Process ingredients to ensure they are in an array format
  if (ingredientsMatch) {
    const ingredients = ingredientsMatch[1]
      .split(/\n|-/g) // Split by newlines or dashes
      .map((item) => item.trim()) // Trim whitespace
      .filter((item) => item); // Remove empty items
    meal.ingredients = ingredients;
  }

  // Process instructions to ensure they are in an array format
  if (instructionsMatch) {
    const instructions = instructionsMatch[1]
      .split(/\n|^\d+\.\s+/gm) // Split by newlines or numbered steps
      .map((step) => step.trim()) // Trim whitespace
      .filter((step) => step); // Remove empty steps
    meal.instructions = instructions;
  }

  return meal;
}

// Updated signup route
router.post('/signup', upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
  const { 
    username, 
    email, 
    password, 
    dietary_restrictions, 
    allergies 
  } = req.body as { 
    username: string; 
    email: string; 
    password: string; 
    dietary_restrictions?: string; 
    allergies?: string; 
  };
  const profilePicture = req.file?.buffer;
  const db = (req as any).db;

  try {
    // Check if the username or email already exists
    const [existingUsers]: [User[], any] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      res.status(400).send({ message: 'Username or email already exists' });
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const query = `
      INSERT INTO users (username, email, password, dietary_restrictions, allergies, profile_picture)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result]: any = await db.query(query, [
      username, 
      email, 
      hashedPassword, 
      dietary_restrictions, 
      allergies, 
      profilePicture
    ]);

    // Get the newly created user's ID
    const userId = result.insertId;

    // Use AI to generate meals
    const aiMeals = await generateAIMeals(dietary_restrictions, allergies);

    // Insert AI-generated meals into the database
    for (const meal of aiMeals) {
      // Parse ingredients from string array to object array with quantity/unit placeholders
      interface ParsedIngredient {
        quantity: string;
        unit: string;
        name: string;
        raw_name: string;
      }

      const parsedIngredients: ParsedIngredient[] = meal.ingredients
      .map((ingText: string) => parseAIIngredientLine(ingText))
      .filter((ing: ParsedIngredient | null): ing is ParsedIngredient =>
        !!ing && typeof ing.name === 'string' && ing.name.length > 0 && !isNaN(Number(ing.quantity)) ? true : false
      );

      const ingredientsJson = JSON.stringify(parsedIngredients);

      const mealInsertQuery = `
        INSERT INTO meals (name, description, ingredients, visibility, user_id, instructions)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const [mealResult]: any = await db.query(mealInsertQuery, [
        meal.name,
        meal.description,
        ingredientsJson,
        0, // private by default
        userId,
        Array.isArray(meal.instructions) ? meal.instructions.join('\n') : meal.instructions
      ]);
      const mealId = mealResult.insertId;

      // Insert each ingredient into meal_ingredients with best matching food_id
      for (const ing of parsedIngredients) {
        console.log("name", ing.name, "quantity", ing.quantity, "unit", ing.unit);
        if (!ing.name || !ing.quantity || !ing.unit) continue;

        try {
          const bestMatch = await findBestFoodMatch(db, ing.raw_name ?? ing.name ?? '');
          if (!bestMatch) {
            console.warn(`No matching food found for ingredient: ${ing.raw_name}`);
            continue;
          }

          const foodId = bestMatch.food_id;

          await db.query(
            `INSERT INTO meal_ingredients (meal_id, food_id, quantity, unit, raw_name) 
             VALUES (?, ?, ?, ?, ?)`,
            [mealId, foodId, Number(ing.quantity), ing.unit, ing.raw_name]
          );
        } catch (err) {
          console.error(`Error inserting meal ingredient "${ing.raw_name}":`, err);
          continue;
        }
      }

      // Calculate nutrition for this meal after ingredients inserted
      await calculateAndStoreMealNutrition(mealId, db);
    }

    res.status(200).send('User signed up successfully with AI-generated meals added');
  } catch (err) {
    console.error('Error during signup:', err);
    res.status(500).send('Error during signup');
  }
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
  // Include all goal fields and other updatable fields from the users table
  const {
    calories_goal,
    protein_goal,
    carbohydrates_goal,
    fat_goal,
    dietary_restrictions,
    allergies
  } = req.body;
  const user = (req as any).user;
  const db = (req as any).db;

  if (username !== user.username) {
    res.status(403).send('You are not authorized to update this user');
    return;
  }

  // Only include fields that are allowed to be updated
  const fields = {
    calories_goal,
    protein_goal,
    carbohydrates_goal,
    fat_goal,
    dietary_restrictions,
    allergies
  };

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
  
    if (username !== user.username) {
      res.status(403).json({ error: 'You are not authorized to update this user' });
      return;
    }
  
    try {
      const [rows] = await db.query('SELECT password FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
  
      const hashedPassword = rows[0].password;
      const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
      if (!isMatch) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
  
      const newHashedPassword = await bcrypt.hash(password, 10);
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

  // Check if a username is already taken
router.get('/check-username', async (req: Request, res: Response) => {
  const db = (req as any).db;
  const { username } = req.query;

  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  try {
    const [rows]: [any[], any] = await db.query(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (rows.length > 0) {
      res.json({ taken: true });
    } else {
      res.json({ taken: false });
    }
  } catch (err) {
    console.error("Error checking username:", err);
    res.status(500).json({ error: "Error checking username" });
  }
});

  export default router;