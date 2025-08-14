// Utility functions for Edamam nutrition integration
import { supabase } from './supabase';

export interface EdamamNutritionResponse {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  servings: number;
  parsedCount: number;
  totalCount: number;
  failedIngredients?: Array<{
    ingredient: string;
    error: string;
  }>;
}

export interface IngredientInput {
  name: string;
  quantity: string;
  unit: string;
}

/**
 * Formats ingredients from the app format to the format expected by Edamam
 * Combines quantity, unit, and name into a single string
 */
export const formatIngredientsForEdamam = (ingredients: IngredientInput[]): string[] => {
  return ingredients
    .filter(ing => ing.name?.trim() && ing.quantity?.trim())
    .map(ing => {
      const quantity = ing.quantity.trim();
      const unit = ing.unit?.trim() || '';
      const name = ing.name.trim();
      
      // Format: "quantity unit name" (e.g., "2 cups flour", "1 tsp salt")
      return `${quantity} ${unit} ${name}`.replace(/\s+/g, ' ').trim();
    });
};

/**
 * Calls the Edamam nutrition Edge Function to calculate macros and save to database
 * Now passes meal_id to handle per-serving calculations and direct database updates
 */
export const calculateEdamamNutrition = async (
  mealId: string,
  ingredients: IngredientInput[]
): Promise<EdamamNutritionResponse> => {
  try {
    console.log('🥗 Calculating nutrition with Edamam for meal:', mealId, 'ingredients:', ingredients);
    
    // Format ingredients for Edamam
    const formattedIngredients = formatIngredientsForEdamam(ingredients);
    
    if (formattedIngredients.length === 0) {
      throw new Error('No valid ingredients found for nutrition calculation');
    }
    
    console.log('📋 Formatted ingredients for Edamam:', formattedIngredients);
    
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call the Edamam nutrition Edge Function with meal_id
    const { data: nutritionData, error: nutritionError } = await supabase.functions.invoke('edamam-nutrition', {
      body: { 
        ingredients: formattedIngredients,
        meal_id: mealId 
      },
      headers: session?.access_token ? {
        Authorization: `Bearer ${session.access_token}`
      } : undefined
    });
    
    if (nutritionError) {
      console.error('❌ Edamam nutrition calculation failed:', nutritionError);
      throw new Error(nutritionError.message || 'Failed to calculate nutrition with Edamam');
    }
    
    if (!nutritionData) {
      throw new Error('No nutrition data returned from Edamam');
    }
    
    console.log('✅ Edamam nutrition calculation successful:', nutritionData);
    
    return nutritionData as EdamamNutritionResponse;
    
  } catch (error) {
    console.error('🚫 Error in calculateEdamamNutrition:', error);
    throw error;
  }
};

/**
 * Updates a meal's nutrition information in the database (DEPRECATED - now handled by Edge Function)
 * This function is kept for backward compatibility but the Edge Function handles updates directly
 */
export const updateMealNutrition = async (
  mealId: string, 
  nutrition: EdamamNutritionResponse
): Promise<void> => {
  console.log('⚠️ updateMealNutrition is deprecated - nutrition is now saved directly by the Edge Function');
  console.log(`📊 Nutrition for meal ${mealId}:`, nutrition);
  // The Edge Function now handles database updates directly
  return Promise.resolve();
};

/**
 * Calculates and saves nutrition for a meal using Edamam
 * This is the main function to use in your meal creation flow
 * The Edge Function now handles per-serving calculations and database updates
 */
export const calculateAndSaveMealNutrition = async (
  mealId: string,
  ingredients: IngredientInput[]
): Promise<EdamamNutritionResponse> => {
  try {
    // The Edge Function now handles both calculation AND database saving
    const nutrition = await calculateEdamamNutrition(mealId, ingredients);
    
    console.log('✅ Nutrition calculated and saved by Edge Function:', nutrition);
    
    return nutrition;
    
  } catch (error) {
    console.error('🚫 Error in calculateAndSaveMealNutrition:', error);
    throw error;
  }
};

/**
 * Formats nutrition data for display in the UI
 */
export const formatNutritionDisplay = (nutrition: EdamamNutritionResponse): string => {
  const { calories, protein, fat, carbohydrates, servings, parsedCount, totalCount } = nutrition;
  
  let message = `🍽️ Nutrition per serving (${servings} total servings):\n`;
  message += `Calories: ${calories}\n`;
  message += `Protein: ${protein}g | Fat: ${fat}g | Carbs: ${carbohydrates}g`;
  
  if (parsedCount < totalCount) {
    const failed = totalCount - parsedCount;
    message += `\n\n📊 Analysis: ${parsedCount}/${totalCount} ingredients processed`;
    message += `\n(${failed} ingredient${failed > 1 ? 's' : ''} couldn't be analyzed - may affect accuracy)`;
  }
  
  return message;
};

/**
 * Formats nutrition data for a more detailed breakdown (simplified for basic schema)
 */
export const formatDetailedNutritionDisplay = (nutrition: EdamamNutritionResponse): string => {
  const { calories, protein, fat, carbohydrates, servings } = nutrition;
  
  let message = `🍽️ Detailed Nutrition Analysis:\n\n`;
  
  // Macronutrients per serving
  message += `📊 Per Serving (${servings} total servings):\n`;
  message += `• Calories: ${calories}\n`;
  message += `• Protein: ${protein}g\n`;
  message += `• Total Fat: ${fat}g\n`;
  message += `• Carbohydrates: ${carbohydrates}g\n`;
  
  // Total recipe nutrition
  message += `\n📊 Total Recipe:\n`;
  message += `• Calories: ${calories * servings}\n`;
  message += `• Protein: ${protein * servings}g\n`;
  message += `• Total Fat: ${fat * servings}g\n`;
  message += `• Carbohydrates: ${carbohydrates * servings}g\n`;
  
  return message;
};

/**
 * Gets suggestions for failed ingredients
 */
export const getIngredientSuggestions = (failedIngredients?: Array<{ ingredient: string; error: string }>): string => {
  if (!failedIngredients || failedIngredients.length === 0) {
    return '';
  }
  
  const suggestions = failedIngredients.map(failed => {
    const { ingredient, error } = failed;
    
    if (error.includes('No food match')) {
      return `• "${ingredient}" - Try being more specific (e.g., "whole wheat flour" instead of "flour")`;
    }
    
    if (error.includes('No measurement unit')) {
      return `• "${ingredient}" - Try including a measurement (e.g., "1 cup ${ingredient}")`;
    }
    
    return `• "${ingredient}" - ${error}`;
  });
  
  return `\nIngredients that couldn't be analyzed:\n${suggestions.join('\n')}`;
};
