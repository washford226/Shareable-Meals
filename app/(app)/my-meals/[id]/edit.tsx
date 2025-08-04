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
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from "@expo/vector-icons";
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
        const aiMacros = mealData.AI_Macros ?? true;
        setUseAIMacros(aiMacros);
        
        const macroData = {
          calories: mealData.calories || 0,
          protein: mealData.protein || 0,
          fat: mealData.fat || 0,
          carbohydrates: mealData.carbohydrates || 0
        };
        setCurrentMacros(macroData);
        
        if (!aiMacros) {
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
    if (ingredients.length === 0) errors.push("At least one ingredient is required");
    
    const invalidIngredients = ingredients.some(i => !i.name.trim() || !i.quantity.trim() || !i.unit.trim());
    if (invalidIngredients) errors.push("All ingredient fields must be filled");
    
    const invalidQuantities = ingredients.some(i => {
      const qty = parseFloat(i.quantity);
      return isNaN(qty) || qty <= 0;
    });
    if (invalidQuantities) errors.push("All ingredient quantities must be positive numbers");
    
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

  // Function to update AI macros
  const updateAIMacros = async () => {
    if (!name.trim() || !description.trim() || ingredients.length === 0) {
      Alert.alert("Missing Information", "Please ensure meal name, description, and ingredients are filled before updating nutrition.");
      return;
    }

    setUpdatingMacros(true);
    try {
      const ingredientsText = ingredients
        .filter(ingredient => ingredient.name.trim())
        .map(ingredient => `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`)
        .join(", ");

      const { data, error } = await supabase.functions.invoke('generate-AImeal', {
        body: {
          mealName: name.trim(),
          description: description.trim(),
          ingredients: ingredientsText,
          servings: 1, // Default to 1 serving for macro calculation
          calculateMacrosOnly: true
        }
      });

      if (error) {
        console.error('Error updating AI macros:', error);
        Alert.alert("Error", "Failed to update nutrition information. Please try again.");
        return;
      }

      if (data?.macros) {
        setCurrentMacros(data.macros);
        Alert.alert("Success", "Nutrition information updated successfully!");
      } else {
        Alert.alert("Error", "Unable to calculate nutrition information. Please try again or enter manually.");
      }
    } catch (error) {
      console.error('Error updating AI macros:', error);
      Alert.alert("Error", "Failed to update nutrition information. Please try again.");
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
            AI_Macros: useAIMacros,
            calories: macroData.calories,
            protein: macroData.protein,
            fat: macroData.fat,
            carbohydrates: macroData.carbohydrates,
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

  // Handle image selection
  const handleImagePicker = useCallback(async () => {
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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const imageUri = `data:image/jpeg;base64,${asset.base64}`;
          handleFieldChange(setPicture, imageUri);
        } else {
          Alert.alert('Error', 'Failed to process the selected image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  }, [handleFieldChange]);

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
        
        {ingredients.map((ingredient, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <TextInput
              style={[styles.ingredientInput, styles.ingredientName, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={ingredient.name}
              onChangeText={text => updateIngredient(idx, "name", text)}
              placeholder="Ingredient name"
              placeholderTextColor={theme.placeholder}
            />
            <TextInput
              style={[styles.ingredientInput, styles.ingredientQuantity, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={ingredient.quantity}
              onChangeText={text => updateIngredient(idx, "quantity", text)}
              placeholder="Qty"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.ingredientInput, styles.ingredientUnit, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={ingredient.unit}
              onChangeText={text => updateIngredient(idx, "unit", text)}
              placeholder="Unit"
              placeholderTextColor={theme.placeholder}
            />
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => removeIngredient(idx)}
            >
              <Ionicons name="close-circle" size={24} color={theme.danger} />
            </TouchableOpacity>
          </View>
        ))}
        
        <TouchableOpacity
          style={[styles.addButton, { borderColor: theme.primary }]}
          onPress={addIngredient}
        >
          <Ionicons name="add-circle" size={20} color={theme.primary} />
          <Text style={[styles.addButtonText, { color: theme.primary }]}>Add Ingredient</Text>
        </TouchableOpacity>
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
          <View style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="leaf" size={20} color={theme.primary} style={styles.pickerIcon} />
            <RNPickerSelect
              onValueChange={(value) => handleFieldChange(setDietaryRestriction, value)}
              items={dietaryOptions}
              placeholder={{ label: "Select dietary restriction (optional)", value: "" }}
              style={{
                inputIOS: [styles.picker, { color: dietaryRestriction ? theme.text : theme.placeholder }],
                inputAndroid: [styles.picker, { color: dietaryRestriction ? theme.text : theme.placeholder }],
                placeholder: { color: theme.placeholder },
              }}
              value={dietaryRestriction}
              useNativeAndroidPickerStyle={false}
              Icon={() => <Ionicons name="chevron-down" size={16} color={theme.text} style={styles.pickerArrow} />}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Cuisine Type</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="globe" size={20} color={theme.primary} style={styles.pickerIcon} />
            <RNPickerSelect
              onValueChange={(value) => handleFieldChange(setCuisine, value)}
              items={cuisineOptions}
              placeholder={{ label: "Select cuisine type (optional)", value: "" }}
              style={{
                inputIOS: [styles.picker, { color: cuisine ? theme.text : theme.placeholder }],
                inputAndroid: [styles.picker, { color: cuisine ? theme.text : theme.placeholder }],
                placeholder: { color: theme.placeholder },
              }}
              value={cuisine}
              useNativeAndroidPickerStyle={false}
              Icon={() => <Ionicons name="chevron-down" size={16} color={theme.text} style={styles.pickerArrow} />}
            />
          </View>
        </View>

        {/* Macro Section */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Nutrition Information</Text>
          
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, { color: theme.text }, useAIMacros && styles.activeToggleLabel]}>
              AI Calculated
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
                  <Text style={styles.aiUpdateButtonText}>Update AI Nutrition</Text>
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
    fontSize: 18,
    fontWeight: '700',
  },

  // Form Elements
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
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
    fontSize: 14,
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
    fontSize: 14,
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
    paddingHorizontal: 20,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 15,
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
});