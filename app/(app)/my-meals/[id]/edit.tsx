import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";
import { calculateAndSaveMealNutrition } from "../../../../utils/edamamUtils";
import { dietaryCreateOptionsEnhanced, cuisineOptionsEnhanced } from "../../../../constants/dietaryOptions";
import { isSmallScreen, isExtraSmallScreen, responsiveFontSizes, scaleFont } from "../../../../utils/responsiveUtils";

export default function EditMealScreen() {
  const { id: mealId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const [cuisine, setCuisine] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [picture, setPicture] = useState<string>("");
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string }[]>([]);
  const [instructions, setInstructions] = useState<string>("");
  const [recipeLink, setRecipeLink] = useState<string>("");
  const [visibility, setVisibility] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [dietaryRestriction, setDietaryRestriction] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [useAIMacros, setUseAIMacros] = useState<boolean>(true);
  const [manualMacros, setManualMacros] = useState({
    calories: "",
    protein: "",
    fat: "",
    carbohydrates: ""
  });
  const [currentMacros, setCurrentMacros] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0
  });
  const [updatingMacros, setUpdatingMacros] = useState<boolean>(false);

  // Modal state for enhanced pickers
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);

  // Fetch meal details from Supabase with retry logic and enhanced error handling
  const fetchMealDetails = useCallback(async (isRetry = false) => {
    setError(null);
    if (!isRetry) {
      setLoading(true);
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        if (!mealId) {
          throw new Error("Meal ID is missing. Cannot fetch meal details.");
        }
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error(`[EditMeal] User authentication error:`, userError);
          throw new Error("User not authenticated. Please log in.");
        }
        const userId = userData.user.id;

        // Fetch both meal data and ingredients
        const [mealResponse, ingredientsResponse] = await Promise.all([
          supabase
            .from("meals")
            .select("*")
            .eq("id", mealId)
            .eq("user_id", userId)
            .single(),
          supabase
            .from("meal_ingredients")
            .select("raw_name, quantity, unit")
            .eq("meal_id", mealId)
        ]);

        if (mealResponse.error || !mealResponse.data) {
          if (mealResponse.error?.code === 'PGRST116') {
            console.error(`[EditMeal] Meal not found or no permission`);
            throw new Error("Meal not found or you don't have permission to edit it.");
          }
          console.error(`[EditMeal] Meal fetch error:`, mealResponse.error);
          throw mealResponse.error || new Error("Failed to fetch meal details.");
        }

        if (ingredientsResponse.error) {
          console.warn("Error fetching ingredients:", ingredientsResponse.error);
          // Continue without ingredients rather than failing
        }

        const mealData = mealResponse.data;
        const ingredientsData = ingredientsResponse.data || [];

        // Set form data
        setName(mealData.name || "");
        setDescription(mealData.description || "");
        // Handle picture with hex conversion
        if (mealData.picture) {
          const pictureUri = typeof mealData.picture === "string" 
            ? mealData.picture.startsWith('\\x') 
              ? mealData.picture.slice(2).match(/.{2}/g)?.map((hex: string) => String.fromCharCode(parseInt(hex, 16))).join('') || ''
              : mealData.picture
            : "";
          setPicture(pictureUri);
        } else {
          setPicture("");
        }
        setIngredients(
          ingredientsData.length > 0 
            ? ingredientsData.map(ing => ({
                name: ing.raw_name || "",
                quantity: ing.quantity?.toString() || "",
                unit: ing.unit || ""
              }))
            : [{ name: "", quantity: "", unit: "" }]
        );
        setInstructions(mealData.instructions || "");
        setRecipeLink(mealData.recipeLink || "");
        setVisibility(mealData.visibility ?? true);
        setDietaryRestriction(mealData.dietary_restrictions || "");
        setCuisine(mealData.cuisine || "");
        
        // Set macro data
        const edamamMacros = mealData.Edamam_macros ?? false;
        setUseAIMacros(edamamMacros);
        
        const macroData = {
          calories: mealData.calories || 0,
          protein: mealData.protein || 0,
          fat: mealData.fat || 0,
          carbohydrates: mealData.carbohydrates || 0
        };
        setCurrentMacros(macroData);
        
        if (!edamamMacros) {
          // If manual macros, populate the manual input fields
          setManualMacros({
            calories: macroData.calories.toString(),
            protein: macroData.protein.toString(),
            fat: macroData.fat.toString(),
            carbohydrates: macroData.carbohydrates.toString()
          });
        }
        
        setRetryCount(0);
        setHasUnsavedChanges(false);
        success = true;

      } catch (error) {
        attempt++;
        console.error(`[EditMeal] Error fetching meal details (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch meal details.";
          console.error(`[EditMeal] Max retries reached. Final error:`, errorMessage);
          setError(errorMessage);
          
          if (errorMessage.includes("not found") || errorMessage.includes("permission")) {
            Alert.alert("Error", errorMessage, [
              { text: "Go Back", onPress: () => router.push("/(app)/my-meals/meals") }
            ]);
          }
        } else {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          setRetryCount(attempt);
        }
      }
    }

    // Always set loading to false at the end
    setLoading(false);
  }, [mealId, router]);

  // Validation function
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    if (!name.trim()) errors.push("Meal name is required");
    if (!description.trim()) errors.push("Meal description is required");
    
    // Filter valid ingredients for validation
    const validIngredients = ingredients.filter(ingredient => 
      ingredient.name.trim() && 
      ingredient.quantity.trim() && 
      ingredient.unit.trim()
    );
    
    if (validIngredients.length === 0) errors.push("At least one complete ingredient is required");
    
    // Check for invalid quantities in valid ingredients
    const invalidQuantities = validIngredients.some(i => {
      const qty = parseFloat(i.quantity);
      return isNaN(qty) || qty <= 0;
    });
    if (invalidQuantities) errors.push("All ingredient quantities must be positive numbers");
    
    // Check for incomplete ingredients (partially filled)
    const incompleteIngredients = ingredients.some(i => {
      const hasName = i.name.trim();
      const hasQuantity = i.quantity.trim();
      const hasUnit = i.unit.trim();
      
      // If any field is filled, all fields must be filled
      if (hasName || hasQuantity || hasUnit) {
        return !hasName || !hasQuantity || !hasUnit;
      }
      return false;
    });
    if (incompleteIngredients) errors.push("Please complete all ingredient fields or remove incomplete ingredients");
    
    // Validate manual macros if manual entry is selected
    if (!useAIMacros) {
      const macroValues = {
        calories: parseFloat(manualMacros.calories) || 0,
        protein: parseFloat(manualMacros.protein) || 0,
        fat: parseFloat(manualMacros.fat) || 0,
        carbohydrates: parseFloat(manualMacros.carbohydrates) || 0
      };
      
      if (macroValues.calories < 0) errors.push("Calories must be a positive number");
      if (macroValues.protein < 0) errors.push("Protein must be a positive number");
      if (macroValues.fat < 0) errors.push("Fat must be a positive number");
      if (macroValues.carbohydrates < 0) errors.push("Carbohydrates must be a positive number");
    }
    
    return errors;
  }, [name, description, ingredients, useAIMacros, manualMacros]);

  // Function to update nutrition using Edamam
  const updateAIMacros = async () => {
    // Filter valid ingredients before checking
    const validIngredients = ingredients.filter(ingredient => 
      ingredient.name.trim() && 
      ingredient.quantity.trim() && 
      ingredient.unit.trim()
    );

    if (!name.trim() || !description.trim() || validIngredients.length === 0) {
      Alert.alert("Missing Information", "Please ensure meal name, description, and at least one complete ingredient are filled before updating nutrition.");
      return;
    }

    setUpdatingMacros(true);
    try {
      // Format ingredients for Edamam
      const edamamIngredients = validIngredients.map(ingredient => ({
        name: ingredient.name.trim(),
        quantity: ingredient.quantity.toString(),
        unit: ingredient.unit.trim()
      }));

      console.log("🔄 Calculating nutrition with Edamam for meal:", mealId);
      
      // Use Edamam to calculate and save nutrition
      const nutritionData = await calculateAndSaveMealNutrition(mealId, edamamIngredients);
      
      console.log("✅ Edamam nutrition calculation successful:", nutritionData);
      
      // Update the current macros state with the new values
      setCurrentMacros({
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        fat: nutritionData.fat,
        carbohydrates: nutritionData.carbohydrates
      });

      // Create detailed success message
      let successMessage = `Nutrition updated successfully!\n\n`;
      successMessage += `📊 Per Serving:\n`;
      successMessage += `🔥 ${nutritionData.calories} calories\n`;
      successMessage += `🥩 ${nutritionData.protein}g protein\n`;
      successMessage += `🥑 ${nutritionData.fat}g fat\n`;
      successMessage += `🍞 ${nutritionData.carbohydrates}g carbs\n`;
      
      if (nutritionData.parsedCount !== nutritionData.totalCount) {
        successMessage += `\n⚠️ Note: ${nutritionData.parsedCount} of ${nutritionData.totalCount} ingredients were successfully analyzed.`;
      }

      Alert.alert("Success", successMessage);
      
    } catch (error) {
      console.error('❌ Error updating nutrition with Edamam:', error);
      Alert.alert(
        "Nutrition Calculation Error", 
        "Failed to calculate nutrition using Edamam. Please check your ingredients for clarity (e.g., '1 cup diced tomatoes' instead of just 'tomatoes') and try again."
      );
    } finally {
      setUpdatingMacros(false);
    }
  };

  // Add refresh functionality
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setRetryCount(0);
    
    try {
      await fetchMealDetails(true);
    } catch (error) {
      console.error("Error refreshing meal data:", error);
      setError("Failed to refresh meal data");
    } finally {
      setRefreshing(false);
    }
  }, [fetchMealDetails]);

  // Helper function to clean up empty ingredients
  const cleanupEmptyIngredients = useCallback(() => {
    setIngredients(prev => {
      // Only remove completely empty ingredients (all fields empty)
      const cleaned = prev.filter(ingredient => 
        ingredient.name.trim() || ingredient.quantity.trim() || ingredient.unit.trim()
      );
      
      // Always ensure at least one empty ingredient row for adding new ones
      if (cleaned.length === 0) {
        cleaned.push({ name: "", quantity: "", unit: "" });
      } else {
        // Only add a new empty row if the last row is complete
        const lastIngredient = cleaned[cleaned.length - 1];
        if (lastIngredient.name.trim() && lastIngredient.quantity.trim() && lastIngredient.unit.trim()) {
          cleaned.push({ name: "", quantity: "", unit: "" });
        }
      }
      
      return cleaned;
    });
  }, []);

  // Save meal changes to Supabase with enhanced error handling and retry logic
  const handleSave = useCallback(async () => {
    setError(null);
    
    // Validate form first
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.join(", ");
      setError(errorMessage);
      Alert.alert("Validation Error", errorMessage);
      return;
    }

    if (!mealId) {
      const errorMessage = "Meal ID is missing. Cannot save changes.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
      return;
    }

    setSaving(true);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error("User not authenticated. Please log in.");
        }
        const userId = userData.user.id;

        // First, check if meal exists and belongs to user
        const { data: mealCheck, error: checkError } = await supabase
          .from("meals")
          .select("id")
          .eq("id", mealId)
          .eq("user_id", userId)
          .single();

        if (checkError || !mealCheck) {
          throw new Error("Meal not found or you don't have permission to edit it.");
        }

        // Prepare macro data
        const macroData = useAIMacros ? currentMacros : {
          calories: parseFloat(manualMacros.calories) || 0,
          protein: parseFloat(manualMacros.protein) || 0,
          fat: parseFloat(manualMacros.fat) || 0,
          carbohydrates: parseFloat(manualMacros.carbohydrates) || 0
        };

        // Update meal data
        const { error: mealError } = await supabase
          .from("meals")
          .update({
            name: name.trim(),
            description: description.trim(),
            instructions: instructions.trim() || null,
            recipeLink: recipeLink.trim() || null,
            visibility,
            dietary_restrictions: dietaryRestriction || null,
            cuisine: cuisine || null,
            picture: picture || null,
            // Preserve existing Edamam_macros and AI_Macros values - don't change them during edit
            calories: macroData.calories,
            protein: macroData.protein,
            fat: macroData.fat,
            carbohydrates: macroData.carbohydrates,
          })
          .eq("id", mealId)
          .eq("user_id", userId);

        if (mealError) {
          console.error("Error updating meal:", mealError);
          throw mealError;
        }

        console.log(`[EditMeal] Successfully updated meal data for meal ${mealId}`);

        // Update ingredients separately with enhanced error handling
        console.log(`[EditMeal] Starting ingredient update for meal ${mealId}`);
        
        // First delete existing ingredients with retry logic
        let deleteSuccess = false;
        let deleteAttempts = 0;
        const maxDeleteAttempts = 3;
        
        while (!deleteSuccess && deleteAttempts < maxDeleteAttempts) {
          deleteAttempts++;
          console.log(`[EditMeal] Delete attempt ${deleteAttempts}/${maxDeleteAttempts}`);
          
          // First check how many ingredients exist before deletion
          const { data: beforeDelete, error: beforeError } = await supabase
            .from("meal_ingredients")
            .select("meal_ingredient_id, raw_name")
            .eq("meal_id", mealId);
          
          if (!beforeError) {
            console.log(`[EditMeal] Before deletion: ${beforeDelete?.length || 0} ingredients exist`);
          }
          
          const { error: deleteError } = await supabase
            .from("meal_ingredients")
            .delete()
            .eq("meal_id", mealId);

          if (deleteError) {
            console.error(`Delete attempt ${deleteAttempts} failed:`, deleteError);
            if (deleteAttempts >= maxDeleteAttempts) {
              throw new Error(`Failed to delete existing ingredients after ${maxDeleteAttempts} attempts: ${deleteError.message}`);
            }
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log(`[EditMeal] Delete operation completed (attempt ${deleteAttempts})`);
            
            // Wait a moment for the database to process the deletion
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Now verify the deletion worked
            const { data: remainingIngredients, error: verifyError } = await supabase
              .from("meal_ingredients")
              .select("meal_ingredient_id, raw_name")
              .eq("meal_id", mealId);

            if (verifyError) {
              console.error("Error verifying deletion:", verifyError);
              if (deleteAttempts >= maxDeleteAttempts) {
                throw new Error(`Failed to verify deletion after ${maxDeleteAttempts} attempts: ${verifyError.message}`);
              }
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 500));
            } else if (remainingIngredients && remainingIngredients.length > 0) {
              console.error(`[EditMeal] CRITICAL: ${remainingIngredients.length} ingredients still exist after deletion!`);
              console.error("Remaining ingredients:", remainingIngredients);
              
              if (deleteAttempts >= maxDeleteAttempts) {
                throw new Error(`Ingredient deletion verification failed after ${maxDeleteAttempts} attempts. ${remainingIngredients.length} ingredients still exist.`);
              }
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              console.log(`[EditMeal] Verified: All ingredients successfully deleted`);
              deleteSuccess = true;
            }
          }
        }

        // Filter out empty ingredients and prepare valid ingredient rows
        const validIngredients = ingredients.filter(ingredient => 
          ingredient.name.trim() && 
          ingredient.quantity.trim() && 
          ingredient.unit.trim() &&
          !isNaN(parseFloat(ingredient.quantity)) &&
          parseFloat(ingredient.quantity) > 0
        );

        console.log(`[EditMeal] Found ${validIngredients.length} valid ingredients to insert:`, validIngredients);

        // Insert new ingredients only if there are valid ones
        if (validIngredients.length > 0) {
          const ingredientRows = validIngredients.map(ingredient => ({
            meal_id: mealId,
            raw_name: ingredient.name.trim(),
            quantity: parseFloat(ingredient.quantity),
            unit: ingredient.unit.trim(),
          }));

          console.log(`[EditMeal] Inserting ${ingredientRows.length} ingredient rows:`, ingredientRows);

          const { data: insertedData, error: ingredientsError } = await supabase
            .from("meal_ingredients")
            .insert(ingredientRows)
            .select();

          if (ingredientsError) {
            console.error("Error inserting ingredients:", ingredientsError);
            throw new Error(`Failed to insert new ingredients: ${ingredientsError.message}`);
          }

          console.log(`[EditMeal] Successfully inserted ${insertedData?.length || 0} ingredients:`, insertedData);

          // Verify insertion
          const { data: verifyInserted, error: verifyInsertError } = await supabase
            .from("meal_ingredients")
            .select("meal_ingredient_id, raw_name")
            .eq("meal_id", mealId);

          if (verifyInsertError) {
            console.warn("Error verifying insertion:", verifyInsertError);
          } else {
            console.log(`[EditMeal] Verified: ${verifyInserted?.length || 0} ingredients now exist in database`);
          }
        } else {
          console.log(`[EditMeal] No valid ingredients to insert - meal will have no ingredients`);
        }

        // Try to recalculate nutrition
        try {
          // Get the current session to include in the function call
          const { data: { session } } = await supabase.auth.getSession();
          
          const { error: nutritionError } = await supabase.functions.invoke('calculate-nutrition', {
            body: { meal_id: mealId },
            headers: session?.access_token ? {
              Authorization: `Bearer ${session.access_token}`
            } : undefined
          });
          
          if (nutritionError) {
            console.warn("Failed to recalculate nutrition:", nutritionError);
            // Don't fail the whole save process
          }
        } catch (nutritionErr) {
          console.warn("Nutrition calculation error:", nutritionErr);
          // Continue even if nutrition calculation fails
        }

        Alert.alert("Success", "Meal updated successfully!");
        setHasUnsavedChanges(false);
        router.push(`/my-meals/${mealId}/info`);
        return; // Success, exit retry loop

      } catch (error) {
        attempt++;
        console.error(`Error updating meal (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : "Failed to update meal. Please try again.";
          setError(errorMessage);
          Alert.alert("Error", errorMessage);
        } else {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    setSaving(false);
  }, [
    validateForm,
    mealId,
    name,
    description,
    picture,
    ingredients,
    instructions,
    recipeLink,
    visibility,
    dietaryRestriction,
    cuisine,
    useAIMacros,
    currentMacros,
    manualMacros,
    router
  ]);

  // Enhanced ingredient management
  const addIngredient = useCallback(() => {
    setIngredients(prev => {
      // Clean up completely empty ingredients before adding new one
      const cleaned = prev.filter(ingredient => 
        ingredient.name.trim() || ingredient.quantity.trim() || ingredient.unit.trim()
      );
      // Add new empty ingredient
      return [...cleaned, { name: "", quantity: "", unit: "" }];
    });
    setHasUnsavedChanges(true);
  }, []);

  const removeIngredient = useCallback((index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }, []);

  const updateIngredient = useCallback((index: number, field: "name" | "quantity" | "unit", value: string) => {
    setIngredients(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
    setHasUnsavedChanges(true);
  }, []);

  // Track unsaved changes for form fields
  const handleFieldChange = useCallback((setter: (value: any) => void, value: any) => {
    setter(value);
    setHasUnsavedChanges(true);
    setError(null); // Clear errors when user makes changes
  }, []);

  // Handle back navigation with unsaved changes warning
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Stay", style: "cancel" },
          { text: "Discard Changes", style: "destructive", onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  }, [hasUnsavedChanges, router]);

  // Handle image selection
  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6, // Reduce quality to manage file size
        base64: true, // Get base64 for storing in database
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (!asset.base64) {
          throw new Error('Failed to get image data');
        }
        
        // Create data URI from base64
        const dataUri = `data:image/jpeg;base64,${asset.base64}`;
        handleFieldChange(setPicture, dataUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Handle image removal
  const handleRemoveImage = useCallback(() => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove the current image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => handleFieldChange(setPicture, '') }
      ]
    );
  }, [handleFieldChange]);

  useEffect(() => {
    if (!mealId) {
      console.error(`[EditMeal] No mealId provided, redirecting to meals list`);
      Alert.alert("Error", "Meal ID is missing. Returning to the previous screen.");
      router.push("/(app)/my-meals/meals");
      return;
    }
    fetchMealDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <View style={[styles.loadingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading meal details...
            </Text>
            <Text style={[styles.retryText, { color: theme.textSecondary }]}>
              Please wait while we fetch your meal information
            </Text>
          </View>
          
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: theme.card, borderColor: theme.danger }]}>
              <Ionicons name="alert-circle" size={48} color={theme.danger} />
              <Text style={[styles.errorTitle, { color: theme.danger }]}>
                Loading Failed
              </Text>
              <Text style={[styles.errorText, { color: theme.text }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={() => fetchMealDetails()}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="refresh" size={16} color={theme.buttonText} />
                  <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                    Try Again
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.backButton, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => router.back()}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="arrow-back" size={16} color={theme.text} />
                  <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                    Go Back
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          {retryCount > 0 && (
            <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.warning }]}>
              <Text style={[styles.retryBannerText, { color: theme.warning }]}>
                Retry attempt {retryCount}/3...
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <>
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Ionicons name="warning" size={20} color={theme.danger} />
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={() => setError(null)}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {retryCount > 0 && (
        <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.warning }]}>
          <Ionicons name="refresh-circle" size={20} color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3...
          </Text>
        </View>
      )}

      {hasUnsavedChanges && (
        <View style={[styles.unsavedBanner, { backgroundColor: theme.card, borderColor: theme.warning }]}>
          <Ionicons name="create" size={20} color={theme.warning} />
          <Text style={[styles.unsavedBannerText, { color: theme.warning }]}>
            You have unsaved changes
          </Text>
        </View>
      )}

      {/* Basic Information Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="restaurant" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Basic Information</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Meal Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={name}
            onChangeText={(value) => handleFieldChange(setName, value)}
            placeholder="Enter meal name"
            placeholderTextColor={theme.placeholder}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={description}
            onChangeText={(value) => handleFieldChange(setDescription, value)}
            placeholder="Describe your meal"
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      {/* Image Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="image" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Meal Image</Text>
        </View>
        
        {picture ? (
          <View style={styles.imageSection}>
            <View style={[styles.imagePreview, { borderColor: theme.border }]}>
              <Image
                source={{ uri: picture }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.imageButton, { borderColor: theme.primary }]}
                onPress={handleImagePicker}
              >
                <Ionicons name="camera" size={16} color={theme.primary} />
                <Text style={[styles.imageButtonText, { color: theme.primary }]}>Change Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageButton, styles.removeImageButton, { borderColor: theme.danger }]}
                onPress={handleRemoveImage}
              >
                <Ionicons name="trash" size={16} color={theme.danger} />
                <Text style={[styles.imageButtonText, { color: theme.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.imageSection}>
            <TouchableOpacity
              style={[styles.imagePlaceholder, { borderColor: theme.border, backgroundColor: theme.background }]}
              onPress={handleImagePicker}
            >
              <Ionicons name="camera" size={48} color={theme.subtext} />
              <Text style={[styles.placeholderText, { color: theme.subtext }]}>Tap to add image</Text>
              <Text style={[styles.placeholderSubtext, { color: theme.placeholder }]}>Optional</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Ingredients Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="list" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Ingredients</Text>
        </View>
        
        {/* Example hint */}
        <View style={[styles.exampleHint, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
          <Text style={[styles.exampleText, { color: theme.textSecondary }]}>
            Example: <Text style={{ fontWeight: '600' }}>corn, 1, cup</Text>
          </Text>
        </View>
        
        {/* Ingredient headers */}
        <View style={styles.ingredientHeaders}>
          <Text style={[styles.ingredientHeaderText, { color: theme.textSecondary, flex: 2 }]}>Name</Text>
          <Text style={[styles.ingredientHeaderText, { color: theme.textSecondary, flex: 1 }]}>Qty</Text>
          <Text style={[styles.ingredientHeaderText, { color: theme.textSecondary, flex: 1.2 }]}>Measurement</Text>
          <View style={{ width: 32 }} />
        </View>
        
        {ingredients.map((ingredient, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <TextInput
              style={[styles.ingredientInput, styles.ingredientName, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={ingredient.name}
              onChangeText={text => updateIngredient(idx, "name", text)}
              placeholder="e.g. corn"
              placeholderTextColor={theme.placeholder}
            />
            <TextInput
              style={[styles.ingredientInput, styles.ingredientQuantity, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={ingredient.quantity}
              onChangeText={text => updateIngredient(idx, "quantity", text)}
              placeholder="1"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.ingredientInput, styles.ingredientUnit, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={ingredient.unit}
              onChangeText={text => updateIngredient(idx, "unit", text)}
              placeholder="cup"
              placeholderTextColor={theme.placeholder}
            />
            {ingredients.length > 1 && (
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeIngredient(idx)}
              >
                <Ionicons name="close-circle" size={24} color={theme.danger} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        
        <TouchableOpacity
          style={[styles.addButton, { borderColor: theme.primary }]}
          onPress={addIngredient}
        >
          <Ionicons name="add-circle" size={20} color={theme.primary} />
          <Text style={[styles.addButtonText, { color: theme.primary }]}>Add Another Ingredient</Text>
        </TouchableOpacity>

        {/* Optional cleanup button if there are empty ingredients */}
        {ingredients.some(ing => !ing.name.trim() && !ing.quantity.trim() && !ing.unit.trim() && ingredients.length > 1) && (
          <TouchableOpacity
            style={[styles.addButton, { borderColor: theme.textSecondary, borderStyle: 'solid' }]}
            onPress={cleanupEmptyIngredients}
          >
            <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.addButtonText, { color: theme.textSecondary }]}>Clean Up Empty Rows</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Additional Details Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Additional Details</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Instructions</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={instructions}
            onChangeText={(value) => handleFieldChange(setInstructions, value)}
            placeholder="Cooking instructions (optional)"
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Dietary Restriction</Text>
          <TouchableOpacity
            style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setShowDietaryModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="leaf" size={20} color={theme.primary} style={styles.pickerIcon} />
            <Text style={[styles.pickerText, { 
              color: dietaryRestriction ? theme.text : theme.placeholder 
            }]}>
              {dietaryRestriction || "Select dietary restriction (optional)"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text} style={styles.pickerArrow} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Cuisine Type</Text>
          <TouchableOpacity
            style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setShowCuisineModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe" size={20} color={theme.primary} style={styles.pickerIcon} />
            <Text style={[styles.pickerText, { 
              color: cuisine ? theme.text : theme.placeholder 
            }]}>
              {cuisine || "Select cuisine type (optional)"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text} style={styles.pickerArrow} />
          </TouchableOpacity>
        </View>

        {/* Macro Section */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Nutrition Information</Text>
          
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, { color: theme.text }, useAIMacros && styles.activeToggleLabel]}>
              Edamam Calculated
            </Text>
            <Switch
              value={!useAIMacros}
              onValueChange={(value) => {
                const newUseAIMacros = !value;
                setUseAIMacros(newUseAIMacros);
                
                // If switching to manual mode, populate manual fields with current values
                if (!newUseAIMacros) {
                  setManualMacros({
                    calories: currentMacros.calories.toString(),
                    protein: currentMacros.protein.toString(),
                    fat: currentMacros.fat.toString(),
                    carbohydrates: currentMacros.carbohydrates.toString()
                  });
                }
                
                setHasUnsavedChanges(true);
              }}
              trackColor={{ false: '#E3E3E3', true: theme.primary }}
              thumbColor={useAIMacros ? '#f4f3f4' : theme.primary}
            />
            <Text style={[styles.toggleLabel, { color: theme.text }, !useAIMacros && styles.activeToggleLabel]}>
              Manual Entry
            </Text>
          </View>

          {useAIMacros ? (
            <View style={styles.aiMacroContainer}>
              <View style={styles.macroDisplayGrid}>
                <View style={[styles.macroDisplayItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.macroDisplayValue, { color: theme.text }]}>{currentMacros.calories}</Text>
                  <Text style={[styles.macroDisplayLabel, { color: theme.textSecondary }]}>Calories</Text>
                </View>
                <View style={[styles.macroDisplayItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.macroDisplayValue, { color: theme.text }]}>{currentMacros.protein}g</Text>
                  <Text style={[styles.macroDisplayLabel, { color: theme.textSecondary }]}>Protein</Text>
                </View>
                <View style={[styles.macroDisplayItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.macroDisplayValue, { color: theme.text }]}>{currentMacros.fat}g</Text>
                  <Text style={[styles.macroDisplayLabel, { color: theme.textSecondary }]}>Fat</Text>
                </View>
                <View style={[styles.macroDisplayItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.macroDisplayValue, { color: theme.text }]}>{currentMacros.carbohydrates}g</Text>
                  <Text style={[styles.macroDisplayLabel, { color: theme.textSecondary }]}>Carbs</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={[styles.aiUpdateButton, { backgroundColor: theme.primary }, updatingMacros && styles.disabledButton]}
                onPress={updateAIMacros}
                disabled={updatingMacros}
              >
                {updatingMacros ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.aiUpdateButtonText}>Calculate Nutrition with Edamam</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.manualMacroGrid}>
              <View style={styles.macroInputItem}>
                <Text style={[styles.macroInputLabel, { color: theme.text }]}>Calories</Text>
                <TextInput
                  style={[styles.macroInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={manualMacros.calories}
                  onChangeText={(text) => {
                    setManualMacros(prev => ({ ...prev, calories: text }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInputItem}>
                <Text style={[styles.macroInputLabel, { color: theme.text }]}>Protein (g)</Text>
                <TextInput
                  style={[styles.macroInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={manualMacros.protein}
                  onChangeText={(text) => {
                    setManualMacros(prev => ({ ...prev, protein: text }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInputItem}>
                <Text style={[styles.macroInputLabel, { color: theme.text }]}>Fat (g)</Text>
                <TextInput
                  style={[styles.macroInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={manualMacros.fat}
                  onChangeText={(text) => {
                    setManualMacros(prev => ({ ...prev, fat: text }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInputItem}>
                <Text style={[styles.macroInputLabel, { color: theme.text }]}>Carbs (g)</Text>
                <TextInput
                  style={[styles.macroInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={manualMacros.carbohydrates}
                  onChangeText={(text) => {
                    setManualMacros(prev => ({ ...prev, carbohydrates: text }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Recipe Link</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={recipeLink}
            onChangeText={(value) => handleFieldChange(setRecipeLink, value)}
            placeholder="Recipe link (optional)"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="eye" size={20} color={theme.primary} />
            <Text style={[styles.label, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>Make Public</Text>
            <Text style={[styles.switchSubtext, { color: theme.textSecondary }]}>
              Allow other users to discover this meal
            </Text>
          </View>
          <Switch
            value={visibility}
            onValueChange={(value) => handleFieldChange(setVisibility, value)}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={visibility ? theme.buttonText : theme.textSecondary}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color={theme.buttonText} />
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Saving...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark-circle" size={20} color={theme.buttonText} />
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Save Changes</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={handleCancel}
          disabled={saving}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="close-circle" size={20} color={theme.text} />
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Dietary Restrictions Modal */}
    <Modal
      visible={showDietaryModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDietaryModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              <Ionicons name="leaf" size={20} color={theme.success || theme.primary} /> Select Dietary Restrictions
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDietaryModal(false)}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {dietaryCreateOptionsEnhanced.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionItem,
                  { borderBottomColor: theme.border },
                  dietaryRestriction === option.value && { backgroundColor: theme.primary + '15' }
                ]}
                onPress={() => {
                  handleFieldChange(setDietaryRestriction, option.value);
                  setShowDietaryModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name={option.icon as any} size={24} color={theme.primary} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                  <Text style={[styles.optionDescription, { color: theme.subtext || theme.textSecondary }]}>{option.description}</Text>
                </View>
                {dietaryRestriction === option.value && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Cuisine Modal */}
    <Modal
      visible={showCuisineModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCuisineModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              <Ionicons name="globe" size={20} color={theme.warning || theme.primary} /> Select Cuisine Type
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCuisineModal(false)}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {cuisineOptionsEnhanced.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionItem,
                  { borderBottomColor: theme.border },
                  cuisine === option.value && { backgroundColor: theme.primary + '15' }
                ]}
                onPress={() => {
                  handleFieldChange(setCuisine, option.value);
                  setShowCuisineModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name={option.icon as any} size={24} color={theme.primary} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                  <Text style={[styles.optionDescription, { color: theme.subtext || theme.textSecondary }]}>{option.description}</Text>
                </View>
                {cuisine === option.value && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 48, // Add top padding to avoid status bar overlap
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 100, // Add bottom padding for proper scrolling
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Enhanced Loading Card
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: '90%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Enhanced Error Styles
  errorContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '90%',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Enhanced Banners
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  unsavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  unsavedBannerText: {
    fontSize: 14,
    fontWeight: "bold",
  },

  // Form Cards
  formCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: (isSmallScreen || isExtraSmallScreen) ? 14 : 18,
    fontWeight: '700',
  },

  // Form Elements
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: (isSmallScreen || isExtraSmallScreen) ? 14 : 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Ingredients
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ingredientInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: (isSmallScreen || isExtraSmallScreen) ? 12 : 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ingredientName: {
    flex: 2,
  },
  ingredientQuantity: {
    flex: 1,
  },
  ingredientUnit: {
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 8,
  },
  addButtonText: {
    fontSize: (isSmallScreen || isExtraSmallScreen) ? 12 : 14,
    fontWeight: '600',
  },

  // Nutrition Grid
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
  },

  // Picker Styles
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pickerIcon: {
    marginRight: 12,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  pickerArrow: {
    position: 'absolute',
    right: 12,
  },

  // Switch Styles
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchInfo: {
    flex: 1,
    gap: 4,
  },
  switchSubtext: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Action Buttons
  actionContainer: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Image Styles
  imageSection: {
    marginTop: 8,
  },
  imagePreview: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  removeImageButton: {
    // Additional styling for remove button if needed
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Legacy styles for compatibility
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  saveButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  // Macro styles
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    paddingHorizontal: (isSmallScreen || isExtraSmallScreen) ? 10 : 20,
    maxWidth: (isSmallScreen || isExtraSmallScreen) ? 320 : '100%',
    alignSelf: 'center',
  },
  toggleLabel: {
    fontSize: (isSmallScreen || isExtraSmallScreen) ? 12 : 16,
    fontWeight: '500',
    marginHorizontal: (isSmallScreen || isExtraSmallScreen) ? 8 : 15,
    textAlign: 'center',
    maxWidth: (isSmallScreen || isExtraSmallScreen) ? 80 : 120,
    lineHeight: (isSmallScreen || isExtraSmallScreen) ? 16 : 20,
  },
  activeToggleLabel: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  aiMacroContainer: {
    marginTop: 15,
  },
  macroDisplayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  macroDisplayItem: {
    width: '48%',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10,
  },
  macroDisplayValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  macroDisplayLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  aiUpdateButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  aiUpdateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  manualMacroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  macroInputItem: {
    width: '48%',
    marginBottom: 15,
  },
  macroInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  macroInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  // Enhanced modal styles for picker modals
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    opacity: 0.7,
  },

  // New ingredient styles
  exampleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  exampleText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  ingredientHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  ingredientHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});