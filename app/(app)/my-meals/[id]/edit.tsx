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
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";

export default function EditMealScreen() {
  const { id: mealId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const cuisineOptions = [
    { label: "None", value: "" },
    { label: "Italian", value: "Italian" },
    { label: "Mexican", value: "Mexican" },
    { label: "Chinese", value: "Chinese" },
    { label: "Indian", value: "Indian" },
    { label: "American", value: "American" },
    { label: "Japanese", value: "Japanese" },
    { label: "Mediterranean", value: "Mediterranean" },
    { label: "Thai", value: "Thai" },
    { label: "French", value: "French" },
  ];
  const [cuisine, setCuisine] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string }[]>([]);
  const [calories, setCalories] = useState<string>("");
  const [protein, setProtein] = useState<string>("");
  const [carbohydrates, setCarbohydrates] = useState<string>("");
  const [fat, setFat] = useState<string>("");
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

  const dietaryOptions = [
    { label: "None", value: "" },
    { label: "Vegetarian", value: "Vegetarian" },
    { label: "Vegan", value: "Vegan" },
    { label: "Gluten-Free", value: "Gluten-Free" },
    { label: "Keto", value: "Keto" },
    { label: "Paleo", value: "Paleo" },
  ];

  // Fetch meal details from Supabase with retry logic and enhanced error handling
  const fetchMealDetails = useCallback(async (isRetry = false) => {
    setError(null);
    if (!isRetry) {
      setLoading(true);
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        if (!mealId) {
          throw new Error("Meal ID is missing. Cannot fetch meal details.");
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
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
            throw new Error("Meal not found or you don't have permission to edit it.");
          }
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
        setIngredients(
          ingredientsData.length > 0 
            ? ingredientsData.map(ing => ({
                name: ing.raw_name || "",
                quantity: ing.quantity?.toString() || "",
                unit: ing.unit || ""
              }))
            : [{ name: "", quantity: "", unit: "" }]
        );
        setCalories(mealData.calories?.toString() || "");
        setProtein(mealData.protein?.toString() || "");
        setCarbohydrates(mealData.carbohydrates?.toString() || "");
        setFat(mealData.fat?.toString() || "");
        setInstructions(mealData.instructions || "");
        setRecipeLink(mealData.recipeLink || "");
        setVisibility(mealData.visibility ?? true);
        setDietaryRestriction(mealData.dietary_restrictions || "");
        setCuisine(mealData.cuisine || "");
        
        setRetryCount(0);
        setHasUnsavedChanges(false);
        return; // Success, exit retry loop

      } catch (error) {
        attempt++;
        console.error(`Error fetching meal details (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch meal details.";
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

    setLoading(false);
  }, [mealId, router]);

  // Validation function
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    if (!name.trim()) errors.push("Meal name is required");
    if (!description.trim()) errors.push("Meal description is required");
    if (ingredients.length === 0) errors.push("At least one ingredient is required");
    
    const invalidIngredients = ingredients.some(i => !i.name.trim() || !i.quantity.trim() || !i.unit.trim());
    if (invalidIngredients) errors.push("All ingredient fields must be filled");
    
    const invalidQuantities = ingredients.some(i => {
      const qty = parseFloat(i.quantity);
      return isNaN(qty) || qty <= 0;
    });
    if (invalidQuantities) errors.push("All ingredient quantities must be positive numbers");
    
    const nutritionFields = [
      { value: calories, name: "Calories" },
      { value: protein, name: "Protein" },
      { value: carbohydrates, name: "Carbohydrates" },
      { value: fat, name: "Fat" }
    ];
    
    for (const field of nutritionFields) {
      if (field.value && (isNaN(parseInt(field.value)) || parseInt(field.value) < 0)) {
        errors.push(`${field.name} must be a non-negative number`);
      }
    }
    
    return errors;
  }, [name, description, ingredients, calories, protein, carbohydrates, fat]);

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

  // Save meal changes to Supabase with enhanced error handling and retry logic
  const handleSave = useCallback(async () => {
    setError(null);
    
    // Validate form
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

        // Update meal data
        const { error: mealError } = await supabase
          .from("meals")
          .update({
            name: name.trim(),
            description: description.trim(),
            calories: calories ? parseInt(calories) : null,
            protein: protein ? parseInt(protein) : null,
            carbohydrates: carbohydrates ? parseInt(carbohydrates) : null,
            fat: fat ? parseInt(fat) : null,
            instructions: instructions.trim() || null,
            recipeLink: recipeLink.trim() || null,
            visibility,
            dietary_restrictions: dietaryRestriction || null,
            cuisine: cuisine || null,
          })
          .eq("id", mealId)
          .eq("user_id", userId);

        if (mealError) {
          throw mealError;
        }

        // Update ingredients separately
        // First delete existing ingredients
        const { error: deleteError } = await supabase
          .from("meal_ingredients")
          .delete()
          .eq("meal_id", mealId);

        if (deleteError) {
          console.warn("Error deleting old ingredients:", deleteError);
          // Continue with insert anyway
        }

        // Insert new ingredients
        const ingredientRows = ingredients.map(ingredient => ({
          meal_id: mealId,
          raw_name: ingredient.name.trim(),
          quantity: parseFloat(ingredient.quantity),
          unit: ingredient.unit.trim(),
        }));

        const { error: ingredientsError } = await supabase
          .from("meal_ingredients")
          .insert(ingredientRows);

        if (ingredientsError) {
          throw ingredientsError;
        }

        // Try to recalculate nutrition
        try {
          const { error: nutritionError } = await supabase.functions.invoke('calculate-nutrition', {
            body: { meal_id: mealId }
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
    ingredients,
    calories,
    protein,
    carbohydrates,
    fat,
    instructions,
    recipeLink,
    visibility,
    dietaryRestriction,
    cuisine,
    router
  ]);

  // Enhanced ingredient management
  const addIngredient = useCallback(() => {
    setIngredients(prev => [...prev, { name: "", quantity: "", unit: "" }]);
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

  useEffect(() => {
    if (!mealId) {
      Alert.alert("Error", "Meal ID is missing. Returning to the previous screen.");
      router.push("/(app)/my-meals/meals");
      return;
    }
    fetchMealDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal details...</Text>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={() => fetchMealDetails()}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {retryCount > 0 && (
            <Text style={[styles.retryText, { color: theme.warning }]}>
              Retry attempt {retryCount}/3...
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
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
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3...
          </Text>
        </View>
      )}

      {hasUnsavedChanges && (
        <View style={[styles.unsavedBanner, { backgroundColor: theme.card, borderColor: theme.warning }]}>
          <Text style={[styles.unsavedBannerText, { color: theme.warning }]}>
            You have unsaved changes
          </Text>
        </View>
      )}

      <Text style={[styles.label, { color: theme.text }]}>Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={name}
        onChangeText={(value) => handleFieldChange(setName, value)}
        placeholder="Meal Name"
        placeholderTextColor={theme.placeholder}
      />

      <Text style={[styles.label, { color: theme.text }]}>Description</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={description}
        onChangeText={(value) => handleFieldChange(setDescription, value)}
        placeholder="Meal Description"
        placeholderTextColor={theme.placeholder}
        multiline
      />

      <Text style={[styles.label, { color: theme.text }]}>Ingredients</Text>
      {ingredients.map((ingredient, idx) => (
        <View key={idx} style={{ flexDirection: "row", marginBottom: 8, alignItems: "center" }}>
          <TextInput
            style={[styles.input, { flex: 2, marginRight: 4, backgroundColor: theme.card, color: theme.text }]}
            value={ingredient.name}
            onChangeText={text => updateIngredient(idx, "name", text)}
            placeholder="Name"
            placeholderTextColor={theme.placeholder}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 4, backgroundColor: theme.card, color: theme.text }]}
            value={ingredient.quantity}
            onChangeText={text => updateIngredient(idx, "quantity", text)}
            placeholder="Qty"
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 4, backgroundColor: theme.card, color: theme.text }]}
            value={ingredient.unit}
            onChangeText={text => updateIngredient(idx, "unit", text)}
            placeholder="Unit"
            placeholderTextColor={theme.placeholder}
          />
          <TouchableOpacity onPress={() => removeIngredient(idx)}>
            <Text style={{ color: theme.danger, fontWeight: "bold", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        onPress={addIngredient}
        style={{ marginBottom: 12 }}
      >
        <Text style={{ color: theme.primary, fontWeight: "bold" }}>+ Add Ingredient</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: theme.text }]}>Calories</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={calories}
        onChangeText={(value) => handleFieldChange(setCalories, value)}
        placeholder="Calories"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Protein (g)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={protein}
        onChangeText={(value) => handleFieldChange(setProtein, value)}
        placeholder="Protein"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Carbohydrates (g)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={carbohydrates}
        onChangeText={(value) => handleFieldChange(setCarbohydrates, value)}
        placeholder="Carbohydrates"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Fat (g)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={fat}
        onChangeText={(value) => handleFieldChange(setFat, value)}
        placeholder="Fat"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Instructions</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={instructions}
        onChangeText={(value) => handleFieldChange(setInstructions, value)}
        placeholder="Instructions"
        placeholderTextColor={theme.placeholder}
        multiline
      />

      {/* Dietary Restriction Dropdown */}
      <Text style={[styles.label, { color: theme.text }]}>Dietary Restriction</Text>
      <RNPickerSelect
        onValueChange={(value) => handleFieldChange(setDietaryRestriction, value)}
        items={dietaryOptions}
        placeholder={{ label: "Select Dietary Restriction (optional)", value: "" }}
        style={{
          inputIOS: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
          inputAndroid: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
        }}
        value={dietaryRestriction}
      />

      <Text style={[styles.label, { color: theme.text }]}>Cuisine</Text>
      <RNPickerSelect
        onValueChange={(value) => handleFieldChange(setCuisine, value)}
        items={cuisineOptions}
        placeholder={{ label: "Select Cuisine (optional)", value: "" }}
        style={{
          inputIOS: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
          inputAndroid: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
        }}
        value={cuisine}
      />

      <Text style={[styles.label, { color: theme.text }]}>Recipe Link</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={recipeLink}
        onChangeText={(value) => handleFieldChange(setRecipeLink, value)}
        placeholder="Recipe Link (optional)"
        placeholderTextColor={theme.placeholder}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>Visibility</Text>
        <Switch
          value={visibility}
          onValueChange={(value) => handleFieldChange(setVisibility, value)}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={visibility ? theme.primary : theme.border}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: theme.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={theme.buttonText} />
        ) : (
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: theme.border }]}
        onPress={handleCancel}
        disabled={saving}
      >
        <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  label: {
    marginTop: 16,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
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
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 5,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  retryText: {
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
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
  unsavedBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  unsavedBannerText: {
    fontSize: 14,
    fontWeight: "bold",
  },
});