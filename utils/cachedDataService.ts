import { supabase } from './supabase';
import { sqliteCache } from './sqliteCache';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';

export interface CachedDataService {
  getUserProfile(userId: string, forceRefresh?: boolean): Promise<any>;
  getUserMeals(userId: string, forceRefresh?: boolean): Promise<any[]>;
  getMealPlanForWeek(userId: string, date: Date, forceRefresh?: boolean): Promise<any[]>;
  getMacroMealsForWeek(userId: string, date: Date, forceRefresh?: boolean): Promise<any[]>;
  getMealsForDate(userId: string, date: string, forceRefresh?: boolean): Promise<any[]>;
  getMealIngredients(mealIds: number[], forceRefresh?: boolean): Promise<any[]>;
  invalidateUserCache(userId: string): Promise<void>;
  invalidateMealPlanCache(userId: string): Promise<void>;
  preloadWeekData(userId: string, date: Date): Promise<void>;
}

class CachedDataServiceImpl implements CachedDataService {
  // Request deduplication: Track in-flight requests to prevent duplicate calls
  private inFlightRequests = new Map<string, Promise<any>>();

  /**
   * Helper method to deduplicate requests
   */
  private async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if request is already in flight
    if (this.inFlightRequests.has(key)) {
      console.log(`🔄 Deduplicating request for: ${key}`);
      return this.inFlightRequests.get(key) as Promise<T>;
    }

    // Start new request and track it
    const requestPromise = requestFn().finally(() => {
      // Clean up completed request
      this.inFlightRequests.delete(key);
    });

    this.inFlightRequests.set(key, requestPromise);
    return requestPromise;
  }
  
  /**
   * Get user profile with SQLite caching
   */
  async getUserProfile(userId: string, forceRefresh: boolean = false): Promise<any> {
    try {
      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cached = await sqliteCache.getCachedUserProfile(userId);
        if (cached) {
          console.log('📱 Using cached user profile');
          return cached;
        }
      }

      console.log('🌐 Fetching user profile from Supabase');
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for user profile
      
      try {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(`Failed to fetch user profile: ${error.message}`);
        }

        if (data) {
          // Cache the result
          await sqliteCache.cacheUserProfile(data);
          console.log('💾 Cached user profile');
        }

        return data;
      } catch (innerError) {
        clearTimeout(timeoutId);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      
      // Fallback to cache if available
      const cached = await sqliteCache.getCachedUserProfile(userId);
      if (cached) {
        console.log('📱 Using fallback cached user profile');
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Get user meals with SQLite caching
   */
  async getUserMeals(userId: string, forceRefresh: boolean = false): Promise<any[]> {
    const cacheKey = `user-meals-${userId}-${forceRefresh}`;
    
    return this.deduplicateRequest(cacheKey, async () => {
      try {
      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cached = await sqliteCache.getCachedMeals(userId);
        if (cached) {
          console.log(`📱 Using cached meals (${cached.length} meals)`);
          return cached;
        }
      }

      console.log('🌐 Fetching meals from Supabase');
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        // Fetch from Supabase with pagination for better performance
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .eq('user_id', userId)
          .eq('visibility', true)
          .order('created_at', { ascending: false })
          .limit(100) // Limit to most recent 100 meals
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(`Failed to fetch meals: ${error.message}`);
        }

        const meals = data || [];
        
        if (meals.length > 0) {
          // Cache the results
          await sqliteCache.cacheMeals(meals, userId);
          console.log(`💾 Cached ${meals.length} meals`);
        }

        return meals;
      } catch (innerError) {
        clearTimeout(timeoutId);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in getUserMeals:', error);
      
      // Fallback to cache if available
      const cached = await sqliteCache.getCachedMeals(userId);
      if (cached) {
        console.log(`📱 Using fallback cached meals (${cached.length} meals)`);
        return cached;
      }
      
      throw error;
      } // Close catch block
    }); // Close deduplicateRequest
  }

  /**
   * Get meal plan for current week with SQLite caching
   */
  async getMealPlanForWeek(userId: string, date: Date, forceRefresh: boolean = false): Promise<any[]> {
    const startDate = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const endDate = format(endOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const cacheKey = `meal-plan-week-${userId}-${startDate}-${endDate}-${forceRefresh}`;

    return this.deduplicateRequest(cacheKey, async () => {
      console.log(`📱 Trying cached data for week...`);
      try {

      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cached = await sqliteCache.getCachedMealPlan(userId, startDate, endDate);
        if (cached) {
          console.log(`📱 Using cached meal plan (${cached.length} entries)`);
          return cached;
        }
      }

      console.log('🌐 Fetching meal plan from Supabase');
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for meal plan
      
      try {
        // Fetch from Supabase with joined meal data
        const { data, error } = await supabase
          .from('meal_plan')
          .select(`
            *,
            meals (
              id,
              name,
              description,
              calories,
              protein,
              carbohydrates,
              fat,
              instructions,
              recipeLink,
              created_by_ai,
              created_by,
              favorite,
              dietary_restrictions,
              servings,
              cuisine,
              picture,
              visibility,
              created_at
            )
          `)
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('meal_type')
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(`Failed to fetch meal plan: ${error.message}`);
        }

        const mealPlan = data || [];
        
        if (mealPlan.length > 0) {
          // Cache the results
          await sqliteCache.cacheMealPlan(mealPlan, userId, startDate, endDate);
          console.log(`💾 Cached meal plan (${mealPlan.length} entries)`);
        }

        return mealPlan;
      } catch (innerError) {
        clearTimeout(timeoutId);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in getMealPlanForWeek:', error);
      
      // Fallback to cache if available
      const startDate = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const cached = await sqliteCache.getCachedMealPlan(userId, startDate, endDate);
      if (cached) {
        console.log(`📱 Using fallback cached meal plan (${cached.length} entries)`);
        return cached;
      }
      
      throw error;
      } // Close catch block
    }); // Close deduplicateRequest
  }

  /**
   * Get macro meals for current week with SQLite caching
   */
  async getMacroMealsForWeek(userId: string, date: Date, forceRefresh: boolean = false): Promise<any[]> {
    const startDate = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const endDate = format(endOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const cacheKey = `macro-meals-week-${userId}-${startDate}-${endDate}-${forceRefresh}`;

    return this.deduplicateRequest(cacheKey, async () => {
      try {

      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cached = await sqliteCache.getCachedMacroMeals(userId, startDate, endDate);
        if (cached) {
          console.log(`📱 Using cached macro meals (${cached.length} entries)`);
          return cached;
        }
      }

      console.log('🌐 Fetching macro meals from Supabase');
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from('macro_meals')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59.999Z')
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(`Failed to fetch macro meals: ${error.message}`);
        }

        const macroMeals = data || [];
        
        if (macroMeals.length > 0) {
          // Cache the results
          await sqliteCache.cacheMacroMeals(macroMeals, userId, startDate, endDate);
          console.log(`💾 Cached macro meals (${macroMeals.length} entries)`);
        }

        return macroMeals;
      } catch (innerError) {
        clearTimeout(timeoutId);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in getMacroMealsForWeek:', error);
      
      // Fallback to cache if available
      const startDate = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const cached = await sqliteCache.getCachedMacroMeals(userId, startDate, endDate);
      if (cached) {
        console.log(`📱 Using fallback cached macro meals (${cached.length} entries)`);
        return cached;
      }
      
      throw error;
      } // Close catch block
    }); // Close deduplicateRequest
  }

  /**
   * Get all meals for a specific date (combines meal_plan and macro_meals)
   */
  async getMealsForDate(userId: string, date: string, forceRefresh: boolean = false): Promise<any[]> {
    const cacheKey = `meals-for-date-${userId}-${date}-${forceRefresh}`;

    return this.deduplicateRequest(cacheKey, async () => {
      try {
      // For cached approach, we'll fetch meal plans and macro meals separately
      // since they have different expiration policies
      const [mealPlanData, macroMealsData] = await Promise.all([
        this.getMealPlanForDate(userId, date, forceRefresh),
        this.getMacroMealsForDate(userId, date, forceRefresh)
      ]);

      console.log(`📊 Processing ${mealPlanData.length} meal plan entries for ${date}`);

      // Transform meal plan data to include full meal details
      const transformedMeals = mealPlanData.map(entry => {
        // Handle both fresh data (meals) and cached data (meal)
        const meal = entry.meals || entry.meal;
        
        if (!meal) {
          console.warn(`⚠️ Missing meal data for entry:`, entry);
          return {
            id: entry.meal_id || 0,
            name: "Unknown Meal",
            description: "No description available",
            calories: 0,
            protein: 0,
            carbohydrates: 0,
            fat: 0,
            picture: null,
            meal_type: entry.meal_type || "Other",
            userName: "",
            visibility: false,
            averageRating: 0,
            reviewCount: 0,
            meal_plan_id: entry.meal_plan_id,
            instructions: "",
            recipeLink: "",
            created_at: "",
            created_by_ai: false,
            favorite: false,
            dietary_restrictions: "",
            servings: 1,
            cuisine: "",
            isMacroMeal: false
          };
        }
        
        // Handle profile picture - convert hex bytes to string if needed
        let pictureUri = meal.picture || null;
        if (pictureUri && typeof pictureUri === 'string' && pictureUri.startsWith('\\x')) {
          const hexString = pictureUri.slice(2);
          const bytes = hexString.match(/.{1,2}/g) || [];
          pictureUri = bytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
        }

        console.log(`✅ Processing meal: ${meal.name} (ID: ${meal.id})`);

        return {
          id: meal.id || entry.meal_id,
          name: meal.name || "Unknown Meal",
          description: meal.description || "No description available",
          calories: meal.calories || 0,
          protein: meal.protein || 0,
          carbohydrates: meal.carbohydrates || 0,
          fat: meal.fat || 0,
          picture: pictureUri,
          meal_type: entry.meal_type || "Other",
          userName: meal.created_by || "",
          visibility: meal.visibility || false,
          averageRating: 0,
          reviewCount: 0,
          meal_plan_id: entry.meal_plan_id,
          instructions: meal.instructions || "",
          recipeLink: meal.recipeLink || "",
          created_at: meal.created_at || "",
          created_by_ai: meal.created_by_ai || false,
          favorite: meal.favorite || false,
          dietary_restrictions: meal.dietary_restrictions || "",
          servings: meal.servings || 1,
          cuisine: meal.cuisine || "",
          isMacroMeal: false
        };
      });

      // Transform macro meals data
      const transformedMacroMeals = macroMealsData.map(macroMeal => ({
        id: `macro_${macroMeal.id}`,
        name: macroMeal.meal_name || "Scanned Meal",
        description: "AI-analyzed meal nutrition",
        calories: macroMeal.calories || 0,
        protein: macroMeal.protein || 0,
        carbohydrates: macroMeal.carbs || 0,
        fat: macroMeal.fat || 0,
        picture: null,
        meal_type: "Scanned",
        userName: "Edamam Food Scanner",
        visibility: false,
        averageRating: 0,
        reviewCount: 0,
        meal_plan_id: null,
        instructions: "",
        recipeLink: "",
        created_at: macroMeal.created_at || "",
        created_by_ai: true,
        favorite: false,
        dietary_restrictions: "",
        servings: 1,
        cuisine: "",
        isMacroMeal: true
      }));

      console.log(`📱 Returning ${transformedMeals.length} regular meals + ${transformedMacroMeals.length} macro meals for ${date}`);

      // Combine both types of meals
      return [...transformedMeals, ...transformedMacroMeals];
      } catch (error) {
        console.error('Error in getMealsForDate:', error);
        throw error;
      } // Close catch block
    }); // Close deduplicateRequest
  }

  /**
   * Helper method to get meal plan for a single date
   */
  private async getMealPlanForDate(userId: string, date: string, forceRefresh: boolean = false): Promise<any[]> {
    // Convert date to Date object for week calculation
    const dateObj = new Date(date);
    const weekData = await this.getMealPlanForWeek(userId, dateObj, forceRefresh);
    return weekData.filter(entry => entry.date === date);
  }

  /**
   * Helper method to get macro meals for a single date
   */
  private async getMacroMealsForDate(userId: string, date: string, forceRefresh: boolean = false): Promise<any[]> {
    // Convert date to Date object for week calculation
    const dateObj = new Date(date);
    const weekData = await this.getMacroMealsForWeek(userId, dateObj, forceRefresh);
    return weekData.filter(entry => {
      const entryDate = format(new Date(entry.created_at), 'yyyy-MM-dd');
      return entryDate === date;
    });
  }

  /**
   * Get meal ingredients with SQLite caching
   */
  async getMealIngredients(mealIds: number[], forceRefresh: boolean = false): Promise<any[]> {
    const cacheKey = `meal-ingredients-${mealIds.sort().join(',')}-${forceRefresh}`;
    
    return this.deduplicateRequest(cacheKey, async () => {
      try {
      if (mealIds.length === 0) return [];

      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cached = await sqliteCache.getCachedMealIngredients(mealIds);
        if (cached) {
          console.log(`📱 Using cached meal ingredients (${cached.length} ingredients)`);
          return cached;
        }
      }

      console.log('🌐 Fetching meal ingredients from Supabase');
      
      // Fetch from Supabase
      const { data, error } = await supabase
        .from('meal_ingredients')
        .select('*')
        .in('meal_id', mealIds);

      if (error) {
        throw new Error(`Failed to fetch meal ingredients: ${error.message}`);
      }

      const ingredients = data || [];
      
      if (ingredients.length > 0) {
        // Cache the results
        await sqliteCache.cacheMealIngredients(ingredients, mealIds);
        console.log(`💾 Cached meal ingredients (${ingredients.length} ingredients)`);
      }

      return ingredients;
    } catch (error) {
      console.error('Error in getMealIngredients:', error);
      
      // Fallback to cache if available
      const cached = await sqliteCache.getCachedMealIngredients(mealIds);
      if (cached) {
        console.log(`📱 Using fallback cached meal ingredients (${cached.length} ingredients)`);
        return cached;
      }
      
      throw error;
      } // Close catch block
    }); // Close deduplicateRequest
  }

  /**
   * Invalidate all cache for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await sqliteCache.clearUserCache(userId);
      console.log('🗑️ Cleared user cache');
    } catch (error) {
      console.error('Error clearing user cache:', error);
    }
  }

  /**
   * Invalidate meal plan and macro meals cache for a user
   */
  async invalidateMealPlanCache(userId: string): Promise<void> {
    try {
      // Clear meal plan and macro meals cache
      await Promise.all([
        sqliteCache.clearMealPlanCache(userId),
        sqliteCache.clearMacroMealsCache(userId)
      ]);
      console.log('🗑️ Cleared meal plan cache');
    } catch (error) {
      console.error('Error clearing meal plan cache:', error);
    }
  }

  /**
   * Preload all data for a week to improve performance
   */
  async preloadWeekData(userId: string, date: Date): Promise<void> {
    try {
      console.log('🚀 Preloading week data...');
      
      // Load data in parallel for better performance
      const promises = [
        this.getUserProfile(userId),
        this.getUserMeals(userId),
        this.getMealPlanForWeek(userId, date),
        this.getMacroMealsForWeek(userId, date),
      ];

      const [userProfile, meals, mealPlan, macroMeals] = await Promise.all(promises);
      
      // Get meal IDs from meal plan to fetch ingredients
      const mealIds = mealPlan.map((plan: any) => plan.meal_id).filter((id: number) => id);
      if (mealIds.length > 0) {
        await this.getMealIngredients(mealIds);
      }
      
      console.log('✅ Week data preloaded successfully');
    } catch (error) {
      console.error('Error preloading week data:', error);
      // Don't throw - preloading is optimization, not critical
    }
  }

  /**
   * Background sync - update cache when app is idle
   */
  async backgroundSync(userId: string): Promise<void> {
    try {
      console.log('🔄 Background sync started');
      const today = new Date();
      
      // Sync current week data
      await Promise.all([
        this.getUserProfile(userId, true),
        this.getUserMeals(userId, true),
        this.getMealPlanForWeek(userId, today, true),
        this.getMacroMealsForWeek(userId, today, true),
      ]);
      
      console.log('✅ Background sync completed');
    } catch (error) {
      console.error('Background sync error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheInfo(): Promise<any> {
    try {
      const stats = await sqliteCache.getCacheStats();
      return {
        ...stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting cache info:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const cachedDataService = new CachedDataServiceImpl();
