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
  RefreshControl 
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";

// Ingredient input row component
const IngredientRow = ({ ingredient, onChange, onRemove, theme }: any) => (
  <View style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
    <TextInput
      style={[styles.input, { 
        flex: 2, 
        marginRight: 5, 
        borderColor: theme.border,
        backgroundColor: theme.background,
        color: theme.text 
      }]}
      placeholder="Name"
      placeholderTextColor={theme.placeholder}
      value={ingredient.name}
      onChangeText={text => onChange("name", text)}
    />
    <TextInput
      style={[styles.input, { 
        flex: 1, 
        marginRight: 5,
        borderColor: theme.border,
        backgroundColor: theme.background,
        color: theme.text 
      }]}
      placeholder="Qty"
      placeholderTextColor={theme.placeholder}
      value={ingredient.quantity}
      onChangeText={text => onChange("quantity", text)}
      keyboardType="numeric"
    />
    <TextInput
      style={[styles.input, { 
        flex: 1, 
        marginRight: 5,
        borderColor: theme.border,
        backgroundColor: theme.background,
        color: theme.text 
      }]}
      placeholder="Unit"
      placeholderTextColor={theme.placeholder}
      value={ingredient.unit}
      onChangeText={text => onChange("unit", text)}
    />
    <TouchableOpacity onPress={onRemove}>
      <Text style={{ color: theme.danger, fontWeight: "bold", fontSize: 18 }}>✕</Text>
    </TouchableOpacity>
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
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [recipeUrl, mealName, description, instructions, ingredients, servings]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    setRetryCount(0);
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

      // 1. Insert the meal (without ingredients)
      const { data: mealData, error: mealError } = await supabase.from("meals").insert([
        {
          user_id: userId,
          name: mealName.trim(),
          description: description.trim(),
          servings: parseInt(servings),
          instructions: instructions.trim(),
          recipeLink: recipeUrl.trim(),
          visibility: true, // Default to public for URL-created meals
          created_by: recipeUrl.trim(),
        },
      ]).select("id").single();

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

      // 3. Calculate nutrition data using the edge function
      try {
        const { error: nutritionError } = await supabase.functions.invoke('calculate-nutrition', {
          body: { meal_id: mealId }
        });
        
        if (nutritionError) {
          console.warn("Failed to calculate nutrition:", nutritionError);
          // Don't fail the whole process if nutrition calculation fails
        }
      } catch (nutritionErr) {
        console.warn("Nutrition calculation error:", nutritionErr);
        // Continue even if nutrition calculation fails
      }

      Alert.alert("Success", "Meal added successfully!", [
        {
          text: "OK",
          onPress: () => router.push("./meals"),
        },
      ]);
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
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
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      <ScrollView 
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
        {/* Back Button */}
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: theme.button }]} 
          onPress={() => router.push("./meals")}
        >
          <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.text }]}>Create Meal from URL</Text>

        {/* URL Input */}
        <Text style={[styles.label, { color: theme.text }]}>Recipe URL</Text>
        <TextInput
          style={[
            styles.input,
            { 
              borderColor: validationErrors.recipeUrl ? theme.danger : theme.border,
              backgroundColor: theme.background,
              color: theme.text 
            }
          ]}
          placeholder="Enter recipe URL"
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
        />
        {validationErrors.recipeUrl && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {validationErrors.recipeUrl}
          </Text>
        )}
        
        <TouchableOpacity 
          style={[
            styles.button, 
            { 
              backgroundColor: loading ? theme.button : theme.primary,
              opacity: loading ? 0.6 : 1 
            }
          ]} 
          onPress={handleFetchRecipe} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Fetch Recipe</Text>
          )}
        </TouchableOpacity>

        {/* Meal Name */}
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
          placeholder="Meal Name"
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

        {/* Description */}
        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
        <TextInput
          style={[
            styles.input,
            { 
              borderColor: validationErrors.description ? theme.danger : theme.border,
              backgroundColor: theme.background,
              color: theme.text 
            }
          ]}
          placeholder="Description"
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
          placeholder="Servings"
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

        {/* Ingredients */}
        <Text style={[styles.label, { color: theme.text }]}>Ingredients</Text>
        {ingredients.map((ingredient, idx) => (
          <IngredientRow
            key={idx}
            ingredient={ingredient}
            theme={theme}
            onChange={(field: "name" | "quantity" | "unit", value: string) =>
              updateIngredient(idx, field, value)
            }
            onRemove={() => removeIngredient(idx)}
          />
        ))}
        <TouchableOpacity onPress={addIngredient} style={{ marginBottom: 15 }}>
          <Text style={{ color: theme.primary, fontWeight: "bold" }}>+ Add Ingredient</Text>
        </TouchableOpacity>
        {validationErrors.ingredients && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {validationErrors.ingredients}
          </Text>
        )}

        {/* Instructions */}
        <Text style={[styles.label, { color: theme.text }]}>Instructions</Text>
        <TextInput
          style={[
            styles.input,
            { 
              borderColor: validationErrors.instructions ? theme.danger : theme.border,
              backgroundColor: theme.background,
              color: theme.text,
              minHeight: 100 
            }
          ]}
          placeholder="Instructions"
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
          numberOfLines={5}
          textAlignVertical="top"
        />
        {validationErrors.instructions && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {validationErrors.instructions}
          </Text>
        )}

        {/* Save Meal Button */}
        <TouchableOpacity 
          style={[
            styles.button, 
            { 
              backgroundColor: saving ? theme.button : theme.primary,
              opacity: saving ? 0.6 : 1 
            }
          ]} 
          onPress={handleSaveMeal} 
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Save Meal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 4,
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 14,
    marginBottom: 10,
    marginTop: -3,
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
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
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default URLCreateMealScreen;
