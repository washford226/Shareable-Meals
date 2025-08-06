import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import { dietaryCreateOptionsEnhanced, cuisineOptionsEnhanced } from "../../../constants/dietaryOptions";

const CreateMealScreen = () => {
  const { theme } = useTheme();
  const router = useRouter();

  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [ingredients, setIngredients] = useState([{ name: "", quantity: "", unit: "" }]);
  const [mealInstructions, setMealInstructions] = useState("");
  const [mealRecipeLink, setMealRecipeLink] = useState("");
  const [mealPicture, setMealPicture] = useState<string | null>(null);
  const [mealVisibility, setMealVisibility] = useState(true);
  const [mealDietaryRestriction, setMealDietaryRestriction] = useState("");
  const [mealCuisine, setMealCuisine] = useState("");
  const [mealServings, setMealServings] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [useAIMacros, setUseAIMacros] = useState(true);
  const [manualMacros, setManualMacros] = useState({
    calories: "",
    protein: "",
    fat: "",
    carbohydrates: ""
  });

  // Modal state for enhanced pickers
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);

  const pickMealImage = useCallback(async () => {
    setError(null);
    setUploadingImage(true);
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images.');
        setUploadingImage(false);
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
          setMealPicture(imageUri);
        } else {
          Alert.alert('Error', 'Failed to process the selected image. Please try again.');
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      const errorMessage = "Failed to pick an image. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const addIngredient = useCallback(() => {
    setIngredients(prev => [...prev, { name: "", quantity: "", unit: "" }]);
  }, []);

  const removeIngredient = useCallback((index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateIngredient = useCallback((index: number, field: "name" | "quantity" | "unit", value: string) => {
    setIngredients(prev => {
      const newIngredients = [...prev];
      newIngredients[index][field] = value;
      return newIngredients;
    });
  }, []);

  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    if (!mealName.trim()) errors.push("Meal name is required");
    if (!mealDescription.trim()) errors.push("Meal description is required");
    if (ingredients.length === 0) errors.push("At least one ingredient is required");
    
    const invalidIngredients = ingredients.some(i => !i.name.trim() || !i.quantity.trim() || !i.unit.trim());
    if (invalidIngredients) errors.push("All ingredient fields must be filled");
    
    const invalidQuantities = ingredients.some(i => {
      const qty = parseFloat(i.quantity);
      return isNaN(qty) || qty <= 0;
    });
    if (invalidQuantities) errors.push("All ingredient quantities must be positive numbers");
    
    if (mealServings && (isNaN(parseInt(mealServings)) || parseInt(mealServings) <= 0)) {
      errors.push("Servings must be a positive number");
    }

    // Validate manual macros if not using AI
    if (!useAIMacros) {
      if (!manualMacros.calories.trim()) errors.push("Calories is required when using manual macros");
      if (!manualMacros.protein.trim()) errors.push("Protein is required when using manual macros");
      if (!manualMacros.fat.trim()) errors.push("Fat is required when using manual macros");
      if (!manualMacros.carbohydrates.trim()) errors.push("Carbohydrates is required when using manual macros");

      const invalidMacros = [
        parseFloat(manualMacros.calories),
        parseFloat(manualMacros.protein),
        parseFloat(manualMacros.fat),
        parseFloat(manualMacros.carbohydrates)
      ].some(val => isNaN(val) || val < 0);

      if (invalidMacros) errors.push("All macro values must be non-negative numbers");
    }
    
    return errors;
  }, [mealName, mealDescription, ingredients, mealServings, useAIMacros, manualMacros]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      // Reset form to initial state
      setMealName("");
      setMealDescription("");
      setIngredients([{ name: "", quantity: "", unit: "" }]);
      setMealInstructions("");
      setMealRecipeLink("");
      setMealPicture(null);
      setMealVisibility(true);
      setMealDietaryRestriction("");
      setMealCuisine("");
      setMealServings("1");
      setUseAIMacros(true);
      setManualMacros({
        calories: "",
        protein: "",
        fat: "",
        carbohydrates: ""
      });
      setRetryCount(0);
    } catch (error) {
      console.error("Error refreshing form:", error);
      setError("Failed to reset form");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleAddMeal = useCallback(async () => {
    setError(null);
    
    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.join(", ");
      setError(errorMessage);
      Alert.alert("Validation Error", errorMessage);
      return;
    }

    setLoading(true);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error("User not authenticated. Please log in again.");
        }
        const userId = userData.user.id;

        // Get user's username from user_profiles
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("username")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.warn("Error fetching user profile:", profileError);
        }

        const username = profileData?.username || "Unknown User";

        // Use the picture directly as base64 data URI
        const pictureData = mealPicture || null;

        // Prepare meal data with conditional macros
        const mealData: any = {
          user_id: userId,
          name: mealName.trim(),
          description: mealDescription.trim(),
          instructions: mealInstructions.trim() || null,
          recipeLink: mealRecipeLink.trim() || null,
          visibility: mealVisibility,
          dietary_restrictions: mealDietaryRestriction || null,
          servings: mealServings ? parseInt(mealServings) : 1,
          cuisine: mealCuisine || null,
          picture: pictureData,
          AI_Macros: useAIMacros,
          created_by: username,
        };

        // Add manual macros if not using AI
        if (!useAIMacros) {
          mealData.calories = Math.round(parseFloat(manualMacros.calories));
          mealData.protein = Math.round(parseFloat(manualMacros.protein));
          mealData.fat = Math.round(parseFloat(manualMacros.fat));
          mealData.carbohydrates = Math.round(parseFloat(manualMacros.carbohydrates));
        }

        // 1. Insert the meal (without ingredients)
        const { data: mealDataResult, error: mealError } = await supabase.from("meals").insert([mealData]).select("id").single();

        if (mealError) {
          throw mealError;
        }

        const mealId = mealDataResult?.id;
        if (!mealId) {
          throw new Error("Failed to get new meal ID.");
        }

        // 2. Insert ingredients, each with the new meal's ID
        const ingredientRows = ingredients.map(ingredient => ({
          meal_id: mealId,
          raw_name: ingredient.name.trim(),
          quantity: parseFloat(ingredient.quantity),
          unit: ingredient.unit,
        }));

        const { error: ingredientsError } = await supabase
          .from("meal_ingredients")
          .insert(ingredientRows);

        if (ingredientsError) {
          throw ingredientsError;
        }

        // 3. Calculate nutrition data using AI if enabled
        if (useAIMacros) {
          try {
            // Get the current session to include in the function call
            const { data: { session } } = await supabase.auth.getSession();
            
            const { error: nutritionError } = await supabase.functions.invoke('calculate-ai-nutrition', {
              body: { meal_id: mealId },
              headers: session?.access_token ? {
                Authorization: `Bearer ${session.access_token}`
              } : undefined
            });
            
            if (nutritionError) {
              console.warn("Failed to calculate nutrition:", nutritionError);
              // Don't fail the whole process if nutrition calculation fails
            }
          } catch (nutritionErr) {
            console.warn("Nutrition calculation error:", nutritionErr);
            // Continue even if nutrition calculation fails
          }
        }

        Alert.alert("Success", "Meal added successfully!");
        router.push("/(app)/my-meals/meals");
        return; // Success, exit retry loop
        
      } catch (error) {
        attempt++;
        console.error(`Error adding meal (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : "Failed to add the meal to the database.";
          setError(errorMessage);
          Alert.alert("Error", errorMessage);
        } else {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          setRetryCount(attempt);
        }
      }
    }
    
    setLoading(false);
  }, [
    validateForm, 
    mealName, 
    mealDescription, 
    ingredients, 
    mealInstructions, 
    mealRecipeLink, 
    mealPicture, 
    mealVisibility, 
    mealDietaryRestriction, 
    mealCuisine, 
    mealServings,
    useAIMacros,
    manualMacros,
    router
  ]);

  return (
    <>
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

      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerContent}>
          <Ionicons name="add-circle" size={32} color={theme.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>Create New Meal</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Add a custom meal to your collection
            </Text>
          </View>
        </View>
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
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Enter meal name"
            placeholderTextColor={theme.placeholder}
            value={mealName}
            onChangeText={setMealName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Describe your meal"
            placeholderTextColor={theme.placeholder}
            value={mealDescription}
            onChangeText={setMealDescription}
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
        
        {mealPicture ? (
          <View style={styles.imageSection}>
            <View style={[styles.imagePreviewContainer, { borderColor: theme.border }]}>
              <Image 
                source={{ uri: mealPicture }} 
                style={styles.previewImage} 
                resizeMode="cover"
              />
            </View>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.imageButton, { borderColor: theme.primary }]}
                onPress={pickMealImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="camera" size={16} color={theme.primary} />
                )}
                <Text style={[styles.imageButtonText, { color: theme.primary }]}>
                  {uploadingImage ? "Updating..." : "Change Image"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageButton, { borderColor: theme.danger }]}
                onPress={() => setMealPicture(null)}
              >
                <Ionicons name="trash" size={16} color={theme.danger} />
                <Text style={[styles.imageButtonText, { color: theme.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.imagePlaceholder, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={pickMealImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.placeholderText, { color: theme.text }]}>Processing image...</Text>
              </>
            ) : (
              <>
                <Ionicons name="camera" size={48} color={theme.subtext} />
                <Text style={[styles.placeholderText, { color: theme.subtext }]}>Tap to add image</Text>
                <Text style={[styles.placeholderSubtext, { color: theme.placeholder }]}>Optional</Text>
              </>
            )}
          </TouchableOpacity>
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
              placeholder="Ingredient name"
              placeholderTextColor={theme.placeholder}
              value={ingredient.name}
              onChangeText={text => updateIngredient(idx, "name", text)}
            />
            <TextInput
              style={[styles.ingredientInput, styles.ingredientQuantity, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Qty"
              placeholderTextColor={theme.placeholder}
              value={ingredient.quantity}
              onChangeText={text => updateIngredient(idx, "quantity", text)}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.ingredientInput, styles.ingredientUnit, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Unit"
              placeholderTextColor={theme.placeholder}
              value={ingredient.unit}
              onChangeText={text => updateIngredient(idx, "unit", text)}
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

      {/* Macronutrients Card */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="fitness" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Macronutrients</Text>
        </View>
        
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <View style={styles.switchHeader}>
              <Ionicons name="sparkles" size={20} color={theme.primary} />
              <Text style={[styles.label, { color: theme.text, marginTop: 0, marginBottom: 0, marginLeft: 8 }]}>Use AI Calculation</Text>
            </View>
            <Text style={[styles.switchSubtext, { color: theme.textSecondary }]}>
              {useAIMacros ? "AI will calculate macros from ingredients" : "Enter macros manually"}
            </Text>
          </View>
          <Switch
            value={useAIMacros}
            onValueChange={setUseAIMacros}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={useAIMacros ? theme.buttonText : theme.textSecondary}
          />
        </View>

        {!useAIMacros && (
          <View style={styles.macroInputsContainer}>
            <Text style={[styles.label, { color: theme.text, marginBottom: 16 }]}>Enter Nutrition Values (per serving)</Text>
            
            <View style={styles.macroGrid}>
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Calories</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.calories}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, calories: text }))}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Protein (g)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.protein}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, protein: text }))}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Fat (g)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.fat}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, fat: text }))}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroInput}>
                <Text style={[styles.macroLabel, { color: theme.text }]}>Carbs (g)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  value={manualMacros.carbohydrates}
                  onChangeText={(text) => setManualMacros(prev => ({ ...prev, carbohydrates: text }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
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
            placeholder="Cooking instructions (optional)"
            placeholderTextColor={theme.placeholder}
            value={mealInstructions}
            onChangeText={setMealInstructions}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Dietary Restrictions</Text>
          <TouchableOpacity
            style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setShowDietaryModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="leaf" size={20} color={theme.primary} style={styles.pickerIcon} />
            <Text style={[styles.pickerText, { 
              color: mealDietaryRestriction ? theme.text : theme.placeholder 
            }]}>
              {mealDietaryRestriction || "Select dietary restriction (optional)"}
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
              color: mealCuisine ? theme.text : theme.placeholder 
            }]}>
              {mealCuisine || "Select cuisine type (optional)"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text} style={styles.pickerArrow} />
          </TouchableOpacity>
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Servings</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="1"
              placeholderTextColor={theme.placeholder}
              value={mealServings}
              onChangeText={setMealServings}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Recipe Link</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Recipe URL (optional)"
              placeholderTextColor={theme.placeholder}
              value={mealRecipeLink}
              onChangeText={setMealRecipeLink}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <View style={styles.switchHeader}>
              <Ionicons name="eye" size={20} color={theme.primary} />
              <Text style={[styles.label, { color: theme.text, marginTop: 0, marginBottom: 0, marginLeft: 8 }]}>Make Public</Text>
            </View>
            <Text style={[styles.switchSubtext, { color: theme.textSecondary }]}>
              Allow other users to discover this meal
            </Text>
          </View>
          <Switch
            value={mealVisibility}
            onValueChange={setMealVisibility}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={mealVisibility ? theme.buttonText : theme.textSecondary}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleAddMeal}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color={theme.buttonText} />
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Creating...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark-circle" size={20} color={theme.buttonText} />
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Create Meal</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => router.back()}
          disabled={loading}
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
                  mealDietaryRestriction === option.value && { backgroundColor: theme.primary + '15' }
                ]}
                onPress={() => {
                  setMealDietaryRestriction(option.value);
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
                {mealDietaryRestriction === option.value && (
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
                  mealCuisine === option.value && { backgroundColor: theme.primary + '15' }
                ]}
                onPress={() => {
                  setMealCuisine(option.value);
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
                {mealCuisine === option.value && (
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
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  
  // Header Card Styles
  headerCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  headerSubtitle: {
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
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    textTransform: 'uppercase',
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
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },

  // Two Column Layout
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Picker Styles
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  pickerIcon: {
    marginRight: 8,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  picker: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  pickerArrow: {
    position: 'absolute',
    right: 12,
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

  // Image Picker Styles
  imagePickerContent: {
    alignItems: 'center',
    padding: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 16,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  imageActionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Ingredients Styles
  ingredientsContainer: {
    marginTop: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ingredientInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  },
  unitPicker: {
    width: 100,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
  },
  addIngredientButton: {
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
  addIngredientText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Switch Styles
  switchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 12,
    lineHeight: 16,
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

  // Legacy Styles (for compatibility)
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  
  // Header specific styles
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  
  // Image picker specific styles
  imagePicker: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  removeImageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  
  // Ingredient specific styles
  ingredientName: {
    flex: 2,
    marginRight: 8,
  },
  ingredientQuantity: {
    flex: 1,
    marginRight: 8,
  },
  ingredientUnit: {
    width: 80,
    marginRight: 8,
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
  
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  mealPicture: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  createButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },

  // Additional Image Styles
  imageSection: {
    marginTop: 8,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
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

  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 15,
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
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: "bold",
  },

  // Macro Styles
  macroInputsContainer: {
    marginTop: 16,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroInput: {
    flex: 1,
    minWidth: '45%',
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
});

export default CreateMealScreen;
