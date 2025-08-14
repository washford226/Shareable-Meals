import { supabase } from './supabase';

export interface ImageNutritionData {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servings: number;
  weight: number;
  foodLabel: string;
  ingredients: string[];
  dietLabels: string[];
  healthLabels: string[];
  cautions: string[];
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
 * Analyze food image using Edamam Food Vision API
 * @param imageUri - Either a base64 encoded image string or a URL to an image
 * @param isUrl - Whether the imageUri is a URL (true) or base64 data (false)
 * @returns Promise with nutrition data or error
 */
export async function analyzeImageNutrition(
  imageUri: string, 
  isUrl: boolean = false
): Promise<ImageNutritionResponse | ImageNutritionError> {
  try {
    console.log('Starting image nutrition analysis...');
    
    // Prepare request body
    const requestBody = isUrl 
      ? { image_url: imageUri }
      : { image: imageUri };

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('edamam-image-nutrition', {
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
        details: data?.details || 'Could not analyze the image'
      };
    }

    console.log('Image nutrition analysis successful:', {
      foodLabel: data.nutrition.foodLabel,
      calories: data.nutrition.calories,
      servings: data.nutrition.servings
    });

    return data as ImageNutritionResponse;

  } catch (error) {
    console.error('Image nutrition analysis error:', error);
    return {
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Convert image analysis results to meal format for database storage
 * @param nutritionData - Results from analyzeImageNutrition
 * @param customName - Optional custom name for the meal (overrides detected food label)
 * @returns Meal object ready for database insertion
 */
export function convertImageNutritionToMeal(
  nutritionData: ImageNutritionData,
  customName?: string
) {
  // Generate a description from detected ingredients and labels
  const description = [
    nutritionData.ingredients.length > 0 
      ? `Detected ingredients: ${nutritionData.ingredients.slice(0, 3).join(', ')}${nutritionData.ingredients.length > 3 ? '...' : ''}`
      : '',
    nutritionData.dietLabels.length > 0 
      ? `Diet: ${nutritionData.dietLabels.join(', ')}`
      : '',
    nutritionData.healthLabels.length > 0 
      ? `Health: ${nutritionData.healthLabels.slice(0, 3).join(', ')}${nutritionData.healthLabels.length > 3 ? '...' : ''}`
      : '',
    nutritionData.cautions.length > 0 
      ? `Cautions: ${nutritionData.cautions.join(', ')}`
      : ''
  ].filter(Boolean).join('\n\n');

  return {
    name: customName || nutritionData.foodLabel || 'Food from Image',
    description: description || 'Meal created from image analysis using Edamam Food Vision',
    calories: nutritionData.calories,
    protein: nutritionData.protein,
    carbohydrates: nutritionData.carbohydrates,
    fat: nutritionData.fat,
    servings: nutritionData.servings,
    instructions: nutritionData.ingredients.length > 0 
      ? `Ingredients detected:\n${nutritionData.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}`
      : 'No specific instructions available.',
    dietary_restrictions: [
      ...nutritionData.dietLabels,
      ...nutritionData.healthLabels,
      ...nutritionData.cautions.map(c => `Caution: ${c}`)
    ].join(', ') || undefined,
    created_by_ai: false, // This is Edamam analysis, not AI
    Edamam_macros: true, // Using Edamam for macro calculation
    Edamam_Calculation: true, // Indicate this uses Edamam
    visibility: true,
    forever_invis: false
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
    dietInfo: nutritionData.dietLabels.length > 0 ? nutritionData.dietLabels.join(', ') : undefined,
    healthInfo: nutritionData.healthLabels.length > 0 ? nutritionData.healthLabels.join(', ') : undefined,
    cautions: nutritionData.cautions.length > 0 ? nutritionData.cautions.join(', ') : undefined,
    ingredients: nutritionData.ingredients
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
