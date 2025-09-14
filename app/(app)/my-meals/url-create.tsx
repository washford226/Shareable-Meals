import React, { useState, useCallback } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  RefreshControl,
  Switch 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";
import { 
  calculateAndSaveMealNutrition, 
  formatNutritionDisplay, 
  getIngredientSuggestions,
  type IngredientInput 
} from "utils/edamamUtils";

// Ingredient input row component
const IngredientRow = ({ ingredient, onChange, onRemove, theme, showRemove = true }: any) => (
  <View style={styles.ingredientRow}>
    <TextInput
      style={[styles.ingredientInput, styles.ingredientName, { 
        backgroundColor: theme.background,
        color: theme.text,
        borderColor: theme.border
      }]}
      placeholder="Ingredient name"
      placeholderTextColor={theme.placeholder}
      value={ingredient.name}
      onChangeText={text => onChange("name", text)}
    />
    <TextInput
      style={[styles.ingredientInput, styles.ingredientQuantity, { 
        backgroundColor: theme.background,
        color: theme.text,
        borderColor: theme.border
      }]}
      placeholder="Amount"
      placeholderTextColor={theme.placeholder}
      value={ingredient.quantity}
      onChangeText={text => onChange("quantity", text)}
      keyboardType="numeric"
    />
    <TextInput
      style={[styles.ingredientInput, styles.ingredientUnit, { 
        backgroundColor: theme.background,
        color: theme.text,
        borderColor: theme.border
      }]}
      placeholder="Unit (cup, tsp, oz)"
      placeholderTextColor={theme.placeholder}
      value={ingredient.unit}
      onChangeText={text => onChange("unit", text)}
    />
    {showRemove && (
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={onRemove}
      >
        <Ionicons name="close-circle" size={24} color={theme.danger} />
      </TouchableOpacity>
    )}
  </View>
);

const URLCreateMealScreen: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const [recipeUrl, setRecipeUrl] = useState<string>("");
  const [mealName, setMealName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string }[]>([]);
  const [instructions, setInstructions] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [servings, setServings] = useState<string>("1");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [useEdamamCalculation, setUseEdamamCalculation] = useState(true);
  const [manualMacros, setManualMacros] = useState({
    calories: "",
    protein: "",
    fat: "",
    carbohydrates: ""
  });

  // Validation function
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!recipeUrl.trim()) {
      errors.recipeUrl = "Recipe URL is required";
    } else if (!recipeUrl.startsWith("http")) {
      errors.recipeUrl = "URL must start with http or https";
    }
    
    if (!mealName.trim()) {
      errors.mealName = "Meal name is required";
    }
    
    if (!description.trim()) {
      errors.description = "Description is required";
    }
    
    if (!instructions.trim()) {
      errors.instructions = "Instructions are required";
    }
    
    if (ingredients.length === 0) {
      errors.ingredients = "At least one ingredient is required";
    } else {
      const invalidIngredients = ingredients.some(ing => !ing.name.trim());
      if (invalidIngredients) {
        errors.ingredients = "All ingredients must have a name";
      }
    }
    
    const servingsNum = parseInt(servings);
    if (!servings.trim() || isNaN(servingsNum) || servingsNum <= 0) {
      errors.servings = "Servings must be a positive number";
    }

    // Validate manual macros if not using Edamam
    if (!useEdamamCalculation) {
      if (!manualMacros.calories.trim() || isNaN(parseFloat(manualMacros.calories)) || parseFloat(manualMacros.calories) < 0) {
        errors.manualCalories = "Calories must be a non-negative number";
      }
      if (!manualMacros.protein.trim() || isNaN(parseFloat(manualMacros.protein)) || parseFloat(manualMacros.protein) < 0) {
        errors.manualProtein = "Protein must be a non-negative number";
      }
      if (!manualMacros.fat.trim() || isNaN(parseFloat(manualMacros.fat)) || parseFloat(manualMacros.fat) < 0) {
        errors.manualFat = "Fat must be a non-negative number";
      }
      if (!manualMacros.carbohydrates.trim() || isNaN(parseFloat(manualMacros.carbohydrates)) || parseFloat(manualMacros.carbohydrates) < 0) {
        errors.manualCarbohydrates = "Carbohydrates must be a non-negative number";
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [recipeUrl, mealName, description, instructions, ingredients, servings, useEdamamCalculation, manualMacros]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    setRetryCount(0);
    setUseEdamamCalculation(true);
    setManualMacros({
      calories: "",
      protein: "",
      fat: "",
      carbohydrates: ""
    });
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: wait 1s, 2s, 4s, etc.
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
    
    setTimeout(() => {
      if (recipeUrl.trim()) {
        handleFetchRecipe();
      }
    }, delay);
  }, [retryCount, recipeUrl]);

  // Add, remove, update ingredient handlers
  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: "", quantity: "", unit: "" }]);
    // Clear ingredients validation error when adding
    if (validationErrors.ingredients) {
      setValidationErrors(prev => {
        const { ingredients, ...rest } = prev;
        return rest;
      });
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: "name" | "quantity" | "unit", value: string) => {
    setIngredients(prev => {
      const newIngredients = [...prev];
      newIngredients[index][field] = value;
      return newIngredients;
    });
    
    // Clear ingredients validation error when updating
    if (validationErrors.ingredients && field === "name" && value.trim()) {
      setValidationErrors(prev => {
        const { ingredients, ...rest } = prev;
        return rest;
      });
    }
  };

  // Parse a string or array of ingredients into [{name, quantity, unit}]
  function parseIngredientLine(line: string) {
    if (!line || typeof line !== 'string') return null;
    let cleaned = line.trim();
    cleaned = cleaned.replace(/^[\*\-\d\.\s\/]+/, '').trim();

    // Common units for matching
    const units = [
      "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
      "oz", "ounce", "ounces", "lb", "pound", "pounds", "g", "gram", "grams", "kg", "ml", "l", "clove", "cloves", "slice", "slices", "can", "cans", "package", "packages", "stick", "sticks", "inch", "inches"
    ];
    const unitsPattern = units.join("|");

    // 1. quantity unit name (e.g., "1 cup ketchup")
    let match = cleaned.match(
      new RegExp(`^([\\d¼½¾⅓⅔⅛⅜⅝⅞\\/\\.]+)\\s+(${unitsPattern})\\s+(.+)$`, "i")
    );
    if (match) {
      const [, quantity, unit, name] = match;
      return { quantity, unit, name };
    }

    // 2. quantity name (e.g., "2 eggs")
    match = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s+(.+)$/);
    if (match) {
      const [, quantity, name] = match;
      return { quantity, unit: "", name };
    }

    // 3. name quantity unit (e.g., "soy sauce 1/4 cup")
    match = cleaned.match(/^(.+?)\s+([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s*([a-zA-Z]+)?$/);
    if (match) {
      return {
        name: match[1].trim(),
        quantity: match[2].trim(),
        unit: match[3]?.trim() || "",
      };
    }

    // 4. unit name (e.g., "cup ketchup")
    match = cleaned.match(
      new RegExp(`^(${unitsPattern})\\s+(.+)$`, "i")
    );
    if (match) {
      const [, unit, name] = match;
      return { quantity: "1", unit, name };
    }

    // fallback
    return { name: cleaned, quantity: "", unit: "" };
  }

  // Fetch recipe data from a backend API (user must provide their own endpoint)
  const handleFetchRecipe = async () => {
    if (!recipeUrl || !recipeUrl.startsWith("http")) {
      setValidationErrors(prev => ({
        ...prev,
        recipeUrl: "Please enter a valid URL starting with http or https."
      }));
      return;
    }

    setLoading(true);
    setError(null);
    setValidationErrors({});

    try {
      // Get current logged-in user to pass user_id (optional; you can pass null or omit)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      // Call your Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('recipe-scraper', {
        body: { url: recipeUrl, save: false, user_id: userId }
      });

      if (error || !data) {
        throw new Error("Failed to fetch recipe data from server.");
      }

      // Map response to your form state
      setMealName(data.name || "");
      setDescription(data.description || "");
      setServings(data.servings || "1");

      // Parse ingredients array of strings into your ingredient objects with parseIngredientLine helper
      let parsedIngredients: { name: string; quantity: string; unit: string }[] = [];
      if (Array.isArray(data.ingredients)) {
        interface ParsedIngredient {
          name: string;
          quantity: string;
          unit: string;
        }

        parsedIngredients = (data.ingredients as string[])
          .map((line: string): ParsedIngredient | null => parseIngredientLine(line))
          .filter((i): i is ParsedIngredient => !!i && !!i.name);
      }
      setIngredients(parsedIngredients);

      // Instructions may be a string or array — normalize to string
      if (Array.isArray(data.instructions)) {
        setInstructions(data.instructions.join(" "));
      } else {
        setInstructions(data.instructions || "");
      }

      setRetryCount(0);
      Alert.alert("Success", "Recipe data fetched successfully!");
    } catch (error) {
      console.error("Error fetching recipe data:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while fetching recipe data.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Save meal to Supabase
  const handleSaveMeal = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please correct the errors and try again.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      // Prepare meal data with conditional macros
      const mealDataToInsert: any = {
        user_id: userId,
        name: mealName.trim(),
        description: description.trim(),
        servings: parseInt(servings),
        instructions: instructions.trim(),
        recipeLink: recipeUrl.trim(),
        visibility: true, // Default to public for URL-created meals
        created_by: recipeUrl.trim(), // Set created_by to the URL the user entered
        Edamam_Calculation: useEdamamCalculation,
        Edamam_macros: useEdamamCalculation, // Set to true if using Edamam for calculation
      };

      // Add manual macros if not using Edamam
      if (!useEdamamCalculation) {
        mealDataToInsert.calories = Math.round(parseFloat(manualMacros.calories));
        mealDataToInsert.protein = Math.round(parseFloat(manualMacros.protein));
        mealDataToInsert.fat = Math.round(parseFloat(manualMacros.fat));
        mealDataToInsert.carbohydrates = Math.round(parseFloat(manualMacros.carbohydrates));
      }

      // 1. Insert the meal (without ingredients)
      const { data: mealData, error: mealError } = await supabase.from("meals").insert([mealDataToInsert]).select("id").single();

      if (mealError) {
        throw mealError;
      }

      const mealId = mealData?.id;
      if (!mealId) {
        throw new Error("Failed to get new meal ID.");
      }

      // 2. Insert ingredients, each with the new meal's ID
      if (ingredients.length > 0) {
        const ingredientRows = ingredients
          .filter(ingredient => ingredient.name.trim()) // Only include ingredients with names
          .map(ingredient => ({
            meal_id: mealId,
            raw_name: ingredient.name.trim(),
            quantity: ingredient.quantity ? parseFloat(ingredient.quantity) : 1.0,
            unit: ingredient.unit?.trim() || null,
          }));

        if (ingredientRows.length > 0) {
          const { error: ingredientsError } = await supabase
            .from("meal_ingredients")
            .insert(ingredientRows);

          if (ingredientsError) {
            throw ingredientsError;
          }
        }
      }

      // 3. Calculate nutrition data using Edamam if enabled
      if (useEdamamCalculation) {
        try {
          console.log("🥗 Calculating nutrition with Edamam for meal:", mealId);
          
          // Use the new Edamam nutrition calculation
          const nutritionData = await calculateAndSaveMealNutrition(mealId, ingredients);
          
          console.log("✅ Edamam nutrition calculation successful:", nutritionData);
          
          // Show detailed nutrition info including any failed ingredients
          const nutritionDisplay = formatNutritionDisplay(nutritionData);
          const suggestions = getIngredientSuggestions(nutritionData.failedIngredients);
          
          let message = "Meal added successfully!\n\n" + nutritionDisplay;
          if (suggestions) {
            message += "\n" + suggestions;
          }
          
          // Meal added successfully with nutrition calculation
          
          Alert.alert("Success", message, [
            {
              text: "OK",
              onPress: () => router.push("./meals"),
            },
          ]);
          
        } catch (nutritionErr) {
          console.warn("❌ Edamam nutrition calculation error:", nutritionErr);
          
          // Show different messages based on the error
          let errorTitle = "Nutrition Calculation Failed";
          let errorMessage = "The meal was saved successfully, but nutrition calculation failed. You can edit the meal later to add nutrition information manually.";
          
          if (nutritionErr instanceof Error) {
            if (nutritionErr.message.includes("No valid ingredients")) {
              errorTitle = "Ingredients Not Recognized";
              errorMessage = "The meal was saved, but the ingredients couldn't be analyzed for nutrition. Try using more specific ingredient descriptions (e.g., '2 cups all-purpose flour' instead of just 'flour').";
            } else if (nutritionErr.message.includes("configuration error")) {
              errorTitle = "Service Configuration Error";
              errorMessage = "The meal was saved, but nutrition calculation is temporarily unavailable due to a service configuration issue.";
            }
          }
          
          Alert.alert(errorTitle, errorMessage, [
            {
              text: "OK",
              onPress: () => router.push("./meals"),
            },
          ]);
        }
      } else {
        // Meal added successfully with manual macros
        Alert.alert("Success", "Meal added successfully with manual nutrition values!", [
          {
            text: "OK",
            onPress: () => router.push("./meals"),
          },
        ]);
      }
    } catch (error) {
      console.error("Error adding meal:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add the meal to the database.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView 
      style={{ backgroundColor: theme.background }}
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
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: theme.card, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="warning" size={20} color={theme.danger} />
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && (
        <View style={[styles.retryBanner, { 
          backgroundColor: theme.card, 
          borderColor: theme.warning 
        }]}>
          <Ionicons name="refresh-circle" size={20} color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3...
          </Text>
        </View>
      )}

      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerContent}>
          <Ionicons name="link" size={32} color={theme.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>Create from Recipe URL</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Import a meal from any recipe website
            </Text>
          </View>
        </View>
      </View>

      {/* URL Input Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="globe" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Recipe URL</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Website URL</Text>
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: validationErrors.recipeUrl ? theme.danger : theme.border,
                backgroundColor: theme.background,
                color: theme.text 
              }
            ]}
            placeholder="https://example.com/recipe"
            placeholderTextColor={theme.placeholder}
            value={recipeUrl}
            onChangeText={(text) => {
              setRecipeUrl(text);
              if (validationErrors.recipeUrl) {
                setValidationErrors(prev => {
                  const { recipeUrl, ...rest } = prev;
                  return rest;
                });
              }
            }}
            editable={!loading}
            autoCapitalize="none"
            keyboardType="url"
          />
          {validationErrors.recipeUrl && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {validationErrors.recipeUrl}
            </Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={[
            styles.primaryButton, 
            { 
              backgroundColor: loading ? theme.buttonSecondary : theme.primary,
              opacity: loading ? 0.6 : 1 
            }
          ]} 
          onPress={handleFetchRecipe} 
          disabled={loading}
        >
          <View style={styles.buttonContent}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color={theme.buttonText} />
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Fetching...</Text>
              </>
            ) : (
              <>
                <Ionicons name="download" size={20} color={theme.buttonText} />
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Fetch Recipe</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Basic Information Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="restaurant" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Basic Information</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Meal Name</Text>
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: validationErrors.mealName ? theme.danger : theme.border,
                backgroundColor: theme.background,
                color: theme.text 
              }
            ]}
            placeholder="Enter meal name"
            placeholderTextColor={theme.placeholder}
            value={mealName}
            onChangeText={(text) => {
              setMealName(text);
              if (validationErrors.mealName) {
                setValidationErrors(prev => {
                  const { mealName, ...rest } = prev;
                  return rest;
                });
              }
            }}
          />
          {validationErrors.mealName && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {validationErrors.mealName}
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[
              styles.textArea,
              { 
                borderColor: validationErrors.description ? theme.danger : theme.border,
                backgroundColor: theme.background,
                color: theme.text 
              }
            ]}
            placeholder="Describe your meal"
            placeholderTextColor={theme.placeholder}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (validationErrors.description) {
                setValidationErrors(prev => {
                  const { description, ...rest } = prev;
                  return rest;
                });
              }
            }}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {validationErrors.description && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {validationErrors.description}
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Servings</Text>
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: validationErrors.servings ? theme.danger : theme.border,
                backgroundColor: theme.background,
                color: theme.text 
              }
            ]}
            placeholder="Number of servings"
            placeholderTextColor={theme.placeholder}
            value={servings}
            onChangeText={(text) => {
              setServings(text);
              if (validationErrors.servings) {
                setValidationErrors(prev => {
                  const { servings, ...rest } = prev;
                  return rest;
                });
              }
            }}
            keyboardType="numeric"
          />
          {validationErrors.servings && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {validationErrors.servings}
            </Text>
          )}
        </View>
      </View>

      {/* Macro Information Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="nutrition" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Macro Information</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <View style={styles.macroToggleContainer}>
            <Text style={[styles.macroToggleLabel, { color: theme.text }]}>
              {useEdamamCalculation ? "Automatic nutrition calculation using Edamam Food Database" : "Enter macros manually"}
            </Text>
            <Switch
              value={useEdamamCalculation}
              onValueChange={setUseEdamamCalculation}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={useEdamamCalculation ? theme.buttonText : theme.textSecondary}
            />
          </View>
        </View>
        
        {!useEdamamCalculation && (
          <View style={styles.macroInputsContainer}>
            <View style={styles.macroGrid}>
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Calories</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      borderColor: validationErrors.manualCalories ? theme.danger : theme.border,
                      backgroundColor: theme.background,
                      color: theme.text 
                    }
                  ]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.calories}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, calories: text }))}
                  keyboardType="numeric"
                />
                {validationErrors.manualCalories && (
                  <Text style={[styles.errorText, { color: theme.danger }]}>
                    {validationErrors.manualCalories}
                  </Text>
                )}
              </View>
              
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Protein (g)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      borderColor: validationErrors.manualProtein ? theme.danger : theme.border,
                      backgroundColor: theme.background,
                      color: theme.text 
                    }
                  ]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.protein}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, protein: text }))}
                  keyboardType="numeric"
                />
                {validationErrors.manualProtein && (
                  <Text style={[styles.errorText, { color: theme.danger }]}>
                    {validationErrors.manualProtein}
                  </Text>
                )}
              </View>
              
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Fat (g)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      borderColor: validationErrors.manualFat ? theme.danger : theme.border,
                      backgroundColor: theme.background,
                      color: theme.text 
                    }
                  ]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.fat}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, fat: text }))}
                  keyboardType="numeric"
                />
                {validationErrors.manualFat && (
                  <Text style={[styles.errorText, { color: theme.danger }]}>
                    {validationErrors.manualFat}
                  </Text>
                )}
              </View>
              
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Carbs (g)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      borderColor: validationErrors.manualCarbohydrates ? theme.danger : theme.border,
                      backgroundColor: theme.background,
                      color: theme.text 
                    }
                  ]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.carbohydrates}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, carbohydrates: text }))}
                  keyboardType="numeric"
                />
                {validationErrors.manualCarbohydrates && (
                  <Text style={[styles.errorText, { color: theme.danger }]}>
                    {validationErrors.manualCarbohydrates}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Ingredients Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="list" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Ingredients</Text>
        </View>
        
        {ingredients.map((ingredient, idx) => (
          <IngredientRow
            key={idx}
            ingredient={ingredient}
            theme={theme}
            onChange={(field: "name" | "quantity" | "unit", value: string) =>
              updateIngredient(idx, field, value)
            }
            onRemove={() => removeIngredient(idx)}
            showRemove={ingredients.length > 1}
          />
        ))}
        
        {/* Example hint - moved below the inputs */}
        <View style={[styles.exampleHint, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
          <Text style={[styles.exampleText, { color: theme.textSecondary }]}>
            Examples: <Text style={{ fontWeight: '600' }}>flour, 2, cups</Text> • <Text style={{ fontWeight: '600' }}>salt, 1, tsp</Text> • <Text style={{ fontWeight: '600' }}>olive oil, 3, tbsp</Text>
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.addButton, { borderColor: theme.primary }]}
          onPress={addIngredient}
        >
          <Ionicons name="add-circle" size={20} color={theme.primary} />
          <Text style={[styles.addButtonText, { color: theme.primary }]}>Add Another Ingredient</Text>
        </TouchableOpacity>
        
        {validationErrors.ingredients && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {validationErrors.ingredients}
          </Text>
        )}
      </View>

      {/* Instructions Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Cooking Instructions</Text>
          <TextInput
            style={[
              styles.textArea,
              { 
                borderColor: validationErrors.instructions ? theme.danger : theme.border,
                backgroundColor: theme.background,
                color: theme.text,
                minHeight: 120
              }
            ]}
            placeholder="Step-by-step cooking instructions"
            placeholderTextColor={theme.placeholder}
            value={instructions}
            onChangeText={(text) => {
              setInstructions(text);
              if (validationErrors.instructions) {
                setValidationErrors(prev => {
                  const { instructions, ...rest } = prev;
                  return rest;
                });
              }
            }}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          {validationErrors.instructions && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {validationErrors.instructions}
            </Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[
            styles.primaryButton, 
            { 
              backgroundColor: saving ? theme.buttonSecondary : theme.primary,
              opacity: saving ? 0.6 : 1 
            }
          ]} 
          onPress={handleSaveMeal} 
          disabled={saving}
        >
          <View style={styles.buttonContent}>
            {saving ? (
              <>
                <ActivityIndicator size="small" color={theme.buttonText} />
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Saving...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={theme.buttonText} />
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Save Meal</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => router.back()}
          disabled={saving}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back to Meals</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  
  // Header Card Styles
  headerCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },

  // Form Card Styles
  formCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  // Input Styles
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 4,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 4,
  },

  // Ingredient Styles
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ingredientInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  },
  ingredientName: {
    flex: 2,
  },
  ingredientQuantity: {
    flex: 1,
  },
  ingredientUnit: {
    width: 200,
  },
  removeButton: {
    padding: 6,
    borderRadius: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Action Buttons
  actionContainer: {
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Error Styles
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  retryBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },

  // Legacy Styles (for compatibility)
  container: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 20,
  },

  // Macro Styles
  macroToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  macroToggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  macroInputsContainer: {
    marginTop: 16,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  macroInput: {
    width: '48%',
    minWidth: 140,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
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

export default URLCreateMealScreen;
