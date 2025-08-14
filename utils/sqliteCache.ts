import * as SQLite from 'expo-sqlite';

// Database name and version
const DATABASE_NAME = 'mealplan_cache.db';
const DATABASE_VERSION = 1;

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  USER_PROFILE: 30 * 60 * 1000, // 30 minutes
  MEALS: 15 * 60 * 1000, // 15 minutes
  MEAL_PLAN: 10 * 60 * 1000, // 10 minutes
  MACRO_MEALS: 10 * 60 * 1000, // 10 minutes
  MEAL_INGREDIENTS: 60 * 60 * 1000, // 1 hour
};

interface CacheEntry {
  id: string;
  data: string; // JSON stringified data
  timestamp: number;
  expiry: number;
  table_name: string;
}

interface UserProfile {
  id: string;
  username: string;
  profile_picture?: string;
  calories_goal?: number;
  protein_goal?: number;
  carbohydrates_goal?: number;
  fat_goal?: number;
  dietary_restrictions?: string;
  allergies?: string;
  is_admin: boolean;
  created_at?: string;
}

interface Meal {
  id: number;
  user_id: string;
  name: string;
  description: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  instructions?: string;
  recipeLink?: string;
  created_by_ai: boolean;
  created_by?: string;
  favorite: boolean;
  dietary_restrictions?: string;
  servings?: number;
  cuisine?: string;
  picture?: string;
  visibility: boolean;
  created_at?: string;
}

interface MealPlan {
  meal_plan_id: number;
  meal_id: number;
  user_id: string;
  date: string;
  meal_type: string;
  meal?: Meal; // Joined meal data (cached format)
  meals?: Meal; // Joined meal data (from Supabase format)
}

interface MacroMeal {
  id: number;
  user_id: string;
  meal_name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  created_at?: string;
}

interface MealIngredient {
  meal_ingredient_id: number;
  meal_id: number;
  raw_name?: string;
  quantity?: number;
  unit?: string;
}

class SQLiteCache {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  private async performInitialization(): Promise<void> {

    try {
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      
      // Create cache table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS cache (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          expiry INTEGER NOT NULL,
          table_name TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cache_table_name ON cache(table_name);
        CREATE INDEX IF NOT EXISTS idx_cache_expiry ON cache(expiry);
      `);

      // Create database metadata table for versioning
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS db_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Check and handle database migrations
      await this.ensureColumnsExist();

      // Create specific tables for better performance
      await this.createUserProfileTable();
      await this.createMealsTable();
      await this.createMealPlanTable();
      await this.createMacroMealsTable();
      await this.createMealIngredientsTable();

      // Clean expired entries (with error handling)
      await this.cleanExpiredEntries();

      this.isInitialized = true;
      console.log('SQLite cache initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite cache:', error);
      throw error;
    }
  }

  private async createUserProfileTable(): Promise<void> {
    await this.db?.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profiles_cache (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        profile_picture TEXT,
        calories_goal INTEGER,
        protein_goal INTEGER,
        carbohydrates_goal INTEGER,
        fat_goal INTEGER,
        dietary_restrictions TEXT,
        allergies TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TEXT,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  private async createMealsTable(): Promise<void> {
    await this.db?.execAsync(`
      CREATE TABLE IF NOT EXISTS meals_cache (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        calories INTEGER,
        protein INTEGER,
        carbohydrates INTEGER,
        fat INTEGER,
        instructions TEXT,
        recipeLink TEXT,
        created_by_ai BOOLEAN DEFAULT FALSE,
        created_by TEXT,
        favorite BOOLEAN DEFAULT FALSE,
        dietary_restrictions TEXT,
        servings INTEGER DEFAULT 1,
        cuisine TEXT,
        picture TEXT,
        visibility BOOLEAN DEFAULT TRUE,
        created_at TEXT,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_meals_cache_user_id ON meals_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_meals_cache_expires_at ON meals_cache(expires_at);
    `);
  }

  private async createMealPlanTable(): Promise<void> {
    await this.db?.execAsync(`
      CREATE TABLE IF NOT EXISTS meal_plan_cache (
        meal_plan_id INTEGER PRIMARY KEY,
        meal_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        meal_data TEXT, -- JSON stringified meal data
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_meal_plan_cache_user_id ON meal_plan_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_meal_plan_cache_date ON meal_plan_cache(date);
      CREATE INDEX IF NOT EXISTS idx_meal_plan_cache_expires_at ON meal_plan_cache(expires_at);
    `);
  }

  private async createMacroMealsTable(): Promise<void> {
    await this.db?.execAsync(`
      CREATE TABLE IF NOT EXISTS macro_meals_cache (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL,
        meal_name TEXT,
        calories REAL,
        protein REAL,
        carbs REAL,
        fat REAL,
        created_at TEXT,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_macro_meals_cache_user_id ON macro_meals_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_macro_meals_cache_expires_at ON macro_meals_cache(expires_at);
    `);
  }

  private async createMealIngredientsTable(): Promise<void> {
    await this.db?.execAsync(`
      CREATE TABLE IF NOT EXISTS meal_ingredients_cache (
        meal_ingredient_id INTEGER PRIMARY KEY,
        meal_id INTEGER NOT NULL,
        raw_name TEXT,
        quantity REAL,
        unit TEXT,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_meal_ingredients_cache_meal_id ON meal_ingredients_cache(meal_id);
      CREATE INDEX IF NOT EXISTS idx_meal_ingredients_cache_expires_at ON meal_ingredients_cache(expires_at);
    `);
  }

  private async cleanExpiredEntries(): Promise<void> {
    const now = Date.now();
    const tables = [
      'cache',
      'user_profiles_cache',
      'meals_cache',
      'meal_plan_cache',
      'macro_meals_cache',
      'meal_ingredients_cache'
    ];

    for (const table of tables) {
      try {
        // Check if the table has expires_at column before trying to clean
        const columns = await this.db?.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        const hasExpiresAt = columns?.some(col => col.name === 'expires_at');
        
        if (hasExpiresAt) {
          await this.db?.runAsync(`DELETE FROM ${table} WHERE expires_at < ?`, [now]);
        } else {
          console.warn(`Table ${table} missing expires_at column, skipping cleanup`);
        }
      } catch (error) {
        console.warn(`Failed to clean expired entries from ${table}:`, error);
      }
    }
  }

  private async ensureColumnsExist(): Promise<void> {
    try {
      // Set database version if not set
      const CURRENT_VERSION = '1.0.0';
      await this.db?.runAsync(`
        INSERT OR IGNORE INTO db_metadata (key, value) VALUES ('version', ?)
      `, [CURRENT_VERSION]);
      
      console.log('Database schema check completed');
    } catch (error) {
      console.warn('Schema check failed:', error);
    }
  }

  private async handleMigrations(): Promise<void> {
    const CURRENT_VERSION = '1.0.0';
    
    try {
      // Check current database version
      const result = await this.db?.getFirstAsync<{ value: string }>(`
        SELECT value FROM db_metadata WHERE key = 'version'
      `);
      
      const currentVersion = result?.value;
      
      if (!currentVersion) {
        // First time setup - mark as current version
        await this.db?.runAsync(`
          INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', ?)
        `, [CURRENT_VERSION]);
        console.log('Database initialized with version:', CURRENT_VERSION);
      } else if (currentVersion !== CURRENT_VERSION) {
        console.log(`Migrating database from ${currentVersion} to ${CURRENT_VERSION}`);
        await this.migrateDatabase(currentVersion, CURRENT_VERSION);
      }
    } catch (error) {
      console.warn('Migration check failed, will recreate tables:', error);
      await this.recreateTables();
    }
  }

  private async migrateDatabase(fromVersion: string, toVersion: string): Promise<void> {
    // Add migration logic here for future versions
    // For now, just recreate tables if there's a version mismatch
    console.log('Recreating tables for clean migration');
    await this.recreateTables();
    
    // Update version
    await this.db?.runAsync(`
      INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', ?)
    `, [toVersion]);
  }

  private async recreateTables(): Promise<void> {
    console.log('Recreating all cache tables...');
    
    // Drop all cache tables
    const tables = [
      'user_profiles_cache',
      'meals_cache',
      'meal_plan_cache',
      'macro_meals_cache',
      'meal_ingredients_cache'
    ];

    for (const table of tables) {
      try {
        await this.db?.runAsync(`DROP TABLE IF EXISTS ${table}`);
      } catch (error) {
        console.warn(`Failed to drop table ${table}:`, error);
      }
    }

    // Recreate all tables
    await this.createUserProfileTable();
    await this.createMealsTable();
    await this.createMealPlanTable();
    await this.createMacroMealsTable();
    await this.createMealIngredientsTable();
    
    console.log('All cache tables recreated successfully');
  }

  // User Profile Methods
  async cacheUserProfile(userProfile: UserProfile): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const expiresAt = now + CACHE_EXPIRATION.USER_PROFILE;

    await this.db?.runAsync(`
      INSERT OR REPLACE INTO user_profiles_cache (
        id, username, profile_picture, calories_goal, protein_goal,
        carbohydrates_goal, fat_goal, dietary_restrictions, allergies,
        is_admin, created_at, cached_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userProfile.id,
      userProfile.username,
      userProfile.profile_picture || null,
      userProfile.calories_goal || null,
      userProfile.protein_goal || null,
      userProfile.carbohydrates_goal || null,
      userProfile.fat_goal || null,
      userProfile.dietary_restrictions || null,
      userProfile.allergies || null,
      userProfile.is_admin ? 1 : 0,
      userProfile.created_at || null,
      now,
      expiresAt
    ]);
  }

  async getCachedUserProfile(userId: string): Promise<UserProfile | null> {
    await this.initialize();
    const now = Date.now();

    const result = await this.db?.getFirstAsync<any>(`
      SELECT * FROM user_profiles_cache 
      WHERE id = ? AND expires_at > ?
    `, [userId, now]);

    if (!result) return null;

    return {
      id: result.id,
      username: result.username,
      profile_picture: result.profile_picture,
      calories_goal: result.calories_goal,
      protein_goal: result.protein_goal,
      carbohydrates_goal: result.carbohydrates_goal,
      fat_goal: result.fat_goal,
      dietary_restrictions: result.dietary_restrictions,
      allergies: result.allergies,
      is_admin: result.is_admin === 1,
      created_at: result.created_at,
    };
  }

  // Meals Methods
  async cacheMeals(meals: Meal[], userId: string): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const expiresAt = now + CACHE_EXPIRATION.MEALS;

    // Clear existing meals for this user
    await this.db?.runAsync(`DELETE FROM meals_cache WHERE user_id = ?`, [userId]);

    // Insert new meals (using INSERT OR REPLACE to handle duplicates)
    for (const meal of meals) {
      await this.db?.runAsync(`
        INSERT OR REPLACE INTO meals_cache (
          id, user_id, name, description, calories, protein, carbohydrates,
          fat, instructions, recipeLink, created_by_ai, created_by, favorite,
          dietary_restrictions, servings, cuisine, picture, visibility,
          created_at, cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        meal.id,
        meal.user_id,
        meal.name,
        meal.description,
        meal.calories || null,
        meal.protein || null,
        meal.carbohydrates || null,
        meal.fat || null,
        meal.instructions || null,
        meal.recipeLink || null,
        meal.created_by_ai ? 1 : 0,
        meal.created_by || null,
        meal.favorite ? 1 : 0,
        meal.dietary_restrictions || null,
        meal.servings || 1,
        meal.cuisine || null,
        meal.picture || null,
        meal.visibility ? 1 : 0,
        meal.created_at || null,
        now,
        expiresAt
      ]);
    }
  }

  async getCachedMeals(userId: string): Promise<Meal[] | null> {
    await this.initialize();
    const now = Date.now();

    const results = await this.db?.getAllAsync<any>(`
      SELECT * FROM meals_cache 
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC
    `, [userId, now]);

    if (!results || results.length === 0) return null;

    return results.map(result => ({
      id: result.id,
      user_id: result.user_id,
      name: result.name,
      description: result.description,
      calories: result.calories,
      protein: result.protein,
      carbohydrates: result.carbohydrates,
      fat: result.fat,
      instructions: result.instructions,
      recipeLink: result.recipeLink,
      created_by_ai: result.created_by_ai === 1,
      created_by: result.created_by,
      favorite: result.favorite === 1,
      dietary_restrictions: result.dietary_restrictions,
      servings: result.servings,
      cuisine: result.cuisine,
      picture: result.picture,
      visibility: result.visibility === 1,
      created_at: result.created_at,
    }));
  }

  // Meal Plan Methods
  async cacheMealPlan(mealPlan: MealPlan[], userId: string, startDate: string, endDate: string): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const expiresAt = now + CACHE_EXPIRATION.MEAL_PLAN;

    // Clear existing meal plan for this user and date range
    await this.db?.runAsync(`
      DELETE FROM meal_plan_cache 
      WHERE user_id = ? AND date >= ? AND date <= ?
    `, [userId, startDate, endDate]);

    // Insert new meal plan (using INSERT OR REPLACE to handle duplicates)
    for (const plan of mealPlan) {
      // Handle both 'meals' (from Supabase) and 'meal' (from other sources)
      const mealData = plan.meals || plan.meal;
      
      await this.db?.runAsync(`
        INSERT OR REPLACE INTO meal_plan_cache (
          meal_plan_id, meal_id, user_id, date, meal_type, meal_data,
          cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        plan.meal_plan_id,
        plan.meal_id,
        plan.user_id,
        plan.date,
        plan.meal_type,
        mealData ? JSON.stringify(mealData) : null,
        now,
        expiresAt
      ]);
    }
  }

  async getCachedMealPlan(userId: string, startDate: string, endDate: string): Promise<MealPlan[] | null> {
    await this.initialize();
    const now = Date.now();

    const results = await this.db?.getAllAsync<any>(`
      SELECT * FROM meal_plan_cache 
      WHERE user_id = ? AND date >= ? AND date <= ? AND expires_at > ?
      ORDER BY date, meal_type
    `, [userId, startDate, endDate, now]);

    if (!results || results.length === 0) return null;

    return results.map(result => ({
      meal_plan_id: result.meal_plan_id,
      meal_id: result.meal_id,
      user_id: result.user_id,
      date: result.date,
      meal_type: result.meal_type,
      meal: result.meal_data ? JSON.parse(result.meal_data) : undefined,
    }));
  }

  // Macro Meals Methods
  async cacheMacroMeals(macroMeals: MacroMeal[], userId: string, startDate: string, endDate: string): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const expiresAt = now + CACHE_EXPIRATION.MACRO_MEALS;

    // Clear existing macro meals for this user and date range
    await this.db?.runAsync(`
      DELETE FROM macro_meals_cache 
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    `, [userId, startDate, endDate]);

    // Insert new macro meals (using INSERT OR REPLACE to handle duplicates)
    for (const macroMeal of macroMeals) {
      await this.db?.runAsync(`
        INSERT OR REPLACE INTO macro_meals_cache (
          id, user_id, meal_name, calories, protein, carbs, fat,
          created_at, cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        macroMeal.id,
        macroMeal.user_id,
        macroMeal.meal_name || null,
        macroMeal.calories || null,
        macroMeal.protein || null,
        macroMeal.carbs || null,
        macroMeal.fat || null,
        macroMeal.created_at || null,
        now,
        expiresAt
      ]);
    }
  }

  async getCachedMacroMeals(userId: string, startDate: string, endDate: string): Promise<MacroMeal[] | null> {
    await this.initialize();
    const now = Date.now();

    const results = await this.db?.getAllAsync<any>(`
      SELECT * FROM macro_meals_cache 
      WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND expires_at > ?
      ORDER BY created_at DESC
    `, [userId, startDate, endDate, now]);

    if (!results || results.length === 0) return null;

    return results.map(result => ({
      id: result.id,
      user_id: result.user_id,
      meal_name: result.meal_name,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      created_at: result.created_at,
    }));
  }

  // Meal Ingredients Methods
  async cacheMealIngredients(ingredients: MealIngredient[], mealIds: number[]): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const expiresAt = now + CACHE_EXPIRATION.MEAL_INGREDIENTS;

    // Clear existing ingredients for these meals
    if (mealIds.length > 0) {
      const placeholders = mealIds.map(() => '?').join(',');
      await this.db?.runAsync(`
        DELETE FROM meal_ingredients_cache 
        WHERE meal_id IN (${placeholders})
      `, mealIds);
    }

    // Insert new ingredients (using INSERT OR REPLACE to handle duplicates)
    for (const ingredient of ingredients) {
      await this.db?.runAsync(`
        INSERT OR REPLACE INTO meal_ingredients_cache (
          meal_ingredient_id, meal_id, raw_name, quantity, unit,
          cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        ingredient.meal_ingredient_id,
        ingredient.meal_id,
        ingredient.raw_name || null,
        ingredient.quantity || null,
        ingredient.unit || null,
        now,
        expiresAt
      ]);
    }
  }

  async getCachedMealIngredients(mealIds: number[]): Promise<MealIngredient[] | null> {
    await this.initialize();
    const now = Date.now();

    if (mealIds.length === 0) return [];

    const placeholders = mealIds.map(() => '?').join(',');
    const results = await this.db?.getAllAsync<any>(`
      SELECT * FROM meal_ingredients_cache 
      WHERE meal_id IN (${placeholders}) AND expires_at > ?
      ORDER BY meal_id, meal_ingredient_id
    `, [...mealIds, now]);

    if (!results || results.length === 0) return null;

    return results.map(result => ({
      meal_ingredient_id: result.meal_ingredient_id,
      meal_id: result.meal_id,
      raw_name: result.raw_name,
      quantity: result.quantity,
      unit: result.unit,
    }));
  }

  // Utility Methods
  async clearCache(): Promise<void> {
    await this.initialize();
    const tables = [
      'cache',
      'user_profiles_cache',
      'meals_cache',
      'meal_plan_cache',
      'macro_meals_cache',
      'meal_ingredients_cache'
    ];

    for (const table of tables) {
      try {
        await this.db?.runAsync(`DELETE FROM ${table}`);
      } catch (error) {
        console.warn(`Failed to clear ${table}:`, error);
      }
    }
  }

  async clearUserCache(userId: string): Promise<void> {
    await this.initialize();
    await this.db?.runAsync(`DELETE FROM user_profiles_cache WHERE id = ?`, [userId]);
    await this.db?.runAsync(`DELETE FROM meals_cache WHERE user_id = ?`, [userId]);
    await this.db?.runAsync(`DELETE FROM meal_plan_cache WHERE user_id = ?`, [userId]);
    await this.db?.runAsync(`DELETE FROM macro_meals_cache WHERE user_id = ?`, [userId]);
  }

  async clearMealPlanCache(userId: string): Promise<void> {
    await this.initialize();
    await this.db?.runAsync(`DELETE FROM meal_plan_cache WHERE user_id = ?`, [userId]);
  }

  async clearMacroMealsCache(userId: string): Promise<void> {
    await this.initialize();
    await this.db?.runAsync(`DELETE FROM macro_meals_cache WHERE user_id = ?`, [userId]);
  }

  async getCacheStats(): Promise<Record<string, number>> {
    await this.initialize();
    const stats: Record<string, number> = {};

    const tables = [
      'user_profiles_cache',
      'meals_cache', 
      'meal_plan_cache',
      'macro_meals_cache',
      'meal_ingredients_cache'
    ];

    for (const table of tables) {
      try {
        const result = await this.db?.getFirstAsync<{ count: number }>(`
          SELECT COUNT(*) as count FROM ${table}
        `);
        stats[table] = result?.count || 0;
      } catch (error) {
        stats[table] = 0;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const sqliteCache = new SQLiteCache();
