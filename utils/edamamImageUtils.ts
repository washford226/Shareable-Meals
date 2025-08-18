import { supabase } from './supabase';

export interface ImageNutritionData {
  calories: number;
  protein: number;
  carbohydrates: number; // Note: OpenAI returns 'carbs', but we'll map it to 'carbohydrates'
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servings: number; // Will default to 1 for OpenAI
  weight: number; // Will default to 0 for OpenAI (not provided)
  foodLabel: string; // Maps to meal_name from OpenAI
  ingredients: string[]; // Will be empty for OpenAI (not provided)
  dietLabels: string[]; // Will be empty for OpenAI (not provided)
  healthLabels: string[]; // Will be empty for OpenAI (not provided)
  cautions: string[]; // Will be empty for OpenAI (not provided)
}

export interface ImageNutritionResponse {
  success: boolean;
  nutrition: ImageNutritionData;
  raw_response?: any;
}

export interface ImageNutritionError {
  error: string;
  details: string;
}

/**
 * Analyze food image using OpenAI GPT-4 Vision API
 * @param imageUri - Base64 encoded image string (without data URI prefix)
 * @param isUrl - Legacy parameter, kept for compatibility but not used with OpenAI
 * @param dateString - Optional date string (YYYY-MM-DD) to assign the meal to a specific date
 * @returns Promise with nutrition data or error
 * @note This now uses OpenAI GPT-4 Vision via the Meal_Scanner Supabase Edge Function
 */
export async function analyzeImageNutrition(
  imageUri: string, 
  isUrl: boolean = false,
  dateString?: string
): Promise<ImageNutritionResponse | ImageNutritionError> {
  try {
    console.log('Starting OpenAI image nutrition analysis...');
    
    // For OpenAI, we only support base64 images, not URLs
    if (isUrl) {
      return {
        error: 'URL analysis not supported',
        details: 'OpenAI integration only supports base64 encoded images'
      };
    }

    // Prepare request body for OpenAI Meal_Scanner
    // Remove data URI prefix if present (OpenAI function expects just base64)
    let base64Image = imageUri;
    if (imageUri.startsWith('data:image/')) {
      base64Image = imageUri.split(',')[1];
    }

    const requestBody = { 
      image: base64Image,
      ...(dateString && { meal_date: dateString })
    };

    console.log('Calling Meal_Scanner Edge Function...');
    
    // Call Supabase Edge Function (Meal_Scanner)
    const { data, error } = await supabase.functions.invoke('Meal_Scanner', {
      body: requestBody,
    });

    if (error) {
      console.error('Supabase function error:', error);
      return {
        error: 'Analysis failed',
        details: error.message || 'Unknown error occurred during image analysis'
      };
    }

    if (!data?.success) {
      console.error('Image analysis failed:', data);
      return {
        error: data?.error || 'Analysis failed',
        details: 'Could not analyze the image with OpenAI'
      };
    }

    console.log('OpenAI image nutrition analysis successful:', data.data);

    // Convert OpenAI response to our expected format
    const openAIData = data.data;
    const nutritionData: ImageNutritionData = {
      calories: openAIData.calories || 0,
      protein: openAIData.protein || 0,
      carbohydrates: openAIData.carbs || 0, // Map 'carbs' to 'carbohydrates'
      fat: openAIData.fat || 0,
      fiber: undefined, // Not provided by OpenAI
      sugar: undefined, // Not provided by OpenAI
      sodium: undefined, // Not provided by OpenAI
      servings: 1, // Default to 1 serving for OpenAI
      weight: 0, // Not provided by OpenAI
      foodLabel: openAIData.meal_name || 'Unknown Food',
      ingredients: [], // Not provided by OpenAI
      dietLabels: [], // Not provided by OpenAI
      healthLabels: [], // Not provided by OpenAI
      cautions: [] // Not provided by OpenAI
    };

    return {
      success: true,
      nutrition: nutritionData,
      raw_response: data.data
    };

  } catch (error) {
    console.error('OpenAI image nutrition analysis error:', error);
    return {
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Convert image analysis results to macro meal format for database storage
 * @param nutritionData - Results from analyzeImageNutrition
 * @param customName - Optional custom name for the meal (overrides detected food label)
 * @returns Macro meal object ready for macro_meals table insertion
 */
export function convertImageNutritionToMeal(
  nutritionData: ImageNutritionData,
  customName?: string
) {
  return {
    meal_name: customName || nutritionData.foodLabel || 'Food from Image',
    calories: nutritionData.calories,
    protein: nutritionData.protein,
    carbs: nutritionData.carbohydrates, // Note: macro_meals uses 'carbs', not 'carbohydrates'
    fat: nutritionData.fat
    // Note: user_id and created_at are handled by the calling code/database
  };
}

/**
 * Format nutrition data for display in UI
 * @param nutritionData - Results from analyzeImageNutrition
 * @returns Formatted strings for UI display
 */
export function formatImageNutritionDisplay(nutritionData: ImageNutritionData) {
  return {
    title: nutritionData.foodLabel,
    calories: `${nutritionData.calories} kcal`,
    protein: `${nutritionData.protein}g protein`,
    carbs: `${nutritionData.carbohydrates}g carbs`,
    fat: `${nutritionData.fat}g fat`,
    servings: `${nutritionData.servings} serving${nutritionData.servings !== 1 ? 's' : ''}`,
    weight: nutritionData.weight > 0 ? `${nutritionData.weight}g` : '',
    summary: `${nutritionData.calories} kcal • ${nutritionData.protein}g protein • ${nutritionData.carbohydrates}g carbs • ${nutritionData.fat}g fat`,
    dietInfo: nutritionData.dietLabels.length > 0 ? nutritionData.dietLabels.join(', ') : 'Not specified',
    healthInfo: nutritionData.healthLabels.length > 0 ? nutritionData.healthLabels.join(', ') : 'Not specified',
    cautions: nutritionData.cautions.length > 0 ? nutritionData.cautions.join(', ') : 'None detected',
    ingredients: nutritionData.ingredients.length > 0 ? nutritionData.ingredients : ['Not specified by OpenAI']
  };
}

/**
 * Validate that nutrition data meets minimum requirements
 * @param nutritionData - Results from analyzeImageNutrition
 * @returns Boolean indicating if data is valid for meal creation
 */
export function validateImageNutritionData(nutritionData: ImageNutritionData): boolean {
  return (
    nutritionData.calories > 0 &&
    nutritionData.servings > 0 &&
    Boolean(nutritionData.foodLabel) &&
    nutritionData.foodLabel.trim() !== '' &&
    nutritionData.foodLabel !== 'Unknown Food'
  );
}
