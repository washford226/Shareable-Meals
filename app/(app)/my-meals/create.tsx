import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  Platform,
  ScrollView,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";

const dietaryOptions = [
  { label: "None", value: "" },
  { label: "Vegetarian", value: "Vegetarian" },
  { label: "Vegan", value: "Vegan" },
  { label: "Gluten-Free", value: "Gluten-Free" },
  { label: "Keto", value: "Keto" },
  { label: "Paleo", value: "Paleo" },
];


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

const unitOptions = [
  { label: "g", value: "g" },
  { label: "kg", value: "kg" },
  { label: "oz", value: "oz" },
  { label: "lb", value: "lb" },
  { label: "cup", value: "cup" },
  { label: "tbsp", value: "tbsp" },
  { label: "tsp", value: "tsp" },
  { label: "ml", value: "ml" },
  { label: "l", value: "l" },
  { label: "piece", value: "piece" },
];

const CreateMealScreen = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { selectedDay } = useLocalSearchParams<{ selectedDay?: string }>();

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
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbohydrates, setCarbohydrates] = useState("");
  const [fat, setFat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickMealImage = useCallback(async () => {
    setError(null);
    setUploadingImage(true);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const uriParts = result.assets[0].uri.split(".");
        const fileType = uriParts[uriParts.length - 1].toLowerCase();

        if (!["jpg", "jpeg", "png"].includes(fileType)) {
          setError("Only JPEG and PNG images are allowed.");
          Alert.alert("Error", "Only JPEG and PNG images are allowed.");
          return;
        }

        setMealPicture(result.assets[0].uri);
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

  // Upload image to Supabase Storage and return the public URL
  const uploadImageToSupabase = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      const fileExt = uri.split(".").pop();
      const fileName = `meal_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("meal-pictures")
        .upload(fileName, blob, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("meal-pictures")
        .getPublicUrl(fileName);

      return publicUrlData?.publicUrl || null;
    } catch (error) {
      console.error("Image upload error:", error);
      throw new Error("Failed to upload image. Please try again.");
    }
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
  }, [mealName, mealDescription, ingredients, mealServings, calories, protein, carbohydrates, fat]);

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
      setCalories("");
      setProtein("");
      setCarbohydrates("");
      setFat("");
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

        let pictureUrl = null;
        if (mealPicture) {
          try {
            pictureUrl = await uploadImageToSupabase(mealPicture);
          } catch (imageError) {
            console.error("Image upload failed:", imageError);
            setError("Failed to upload image. Continuing without image...");
            // Continue without image rather than failing entirely
          }
        }

        // 1. Insert the meal (without ingredients)
        const { data: mealData, error: mealError } = await supabase.from("meals").insert([
          {
            user_id: userId,
            name: mealName.trim(),
            description: mealDescription.trim(),
            instructions: mealInstructions.trim() || null,
            recipeLink: mealRecipeLink.trim() || null,
            visibility: mealVisibility,
            dietary_restrictions: mealDietaryRestriction || null,
            servings: mealServings ? parseInt(mealServings) : 1,
            cuisine: mealCuisine || null,
            calories: calories ? parseInt(calories) : null,
            protein: protein ? parseInt(protein) : null,
            carbohydrates: carbohydrates ? parseInt(carbohydrates) : null,
            fat: fat ? parseInt(fat) : null,
            picture: pictureUrl,
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
    calories, 
    protein, 
    carbohydrates, 
    fat, 
    uploadImageToSupabase, 
    router
  ]);

  return (
    <ScrollView 
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
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

      <Text style={[styles.title, { color: theme.text }]}>Create a New Meal</Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Meal Name"
        placeholderTextColor={theme.placeholder}
        value={mealName}
        onChangeText={setMealName}
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Meal Description"
        placeholderTextColor={theme.placeholder}
        value={mealDescription}
        onChangeText={setMealDescription}
        multiline
      />

      <Text style={[styles.label, { color: theme.text }]}>Ingredients</Text>
      {ingredients.map((ingredient, idx) => (
        <View key={idx} style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
          <TextInput
            style={[styles.input, { flex: 2, marginRight: 5, backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Name"
            placeholderTextColor={theme.placeholder}
            value={ingredient.name}
            onChangeText={text => updateIngredient(idx, "name", text)}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 5, backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Qty"
            placeholderTextColor={theme.placeholder}
            value={ingredient.quantity}
            onChangeText={text => updateIngredient(idx, "quantity", text)}
            keyboardType="numeric"
          />
          <RNPickerSelect
            onValueChange={value => updateIngredient(idx, "unit", value)}
            items={unitOptions}
            value={ingredient.unit}
            placeholder={{ label: "Unit", value: "" }}
            style={{
              inputIOS: {
                color: ingredient.unit ? theme.text : theme.placeholder,
                height: 50,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 8,
                backgroundColor: theme.card,
                paddingRight: 30,
                flex: 1,
                marginRight: 5,
              },
              inputAndroid: {
                color: ingredient.unit ? theme.text : theme.placeholder,
                height: 50,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 8,
                backgroundColor: theme.card,
                paddingRight: 30,
                flex: 1,
                marginRight: 5,
                marginTop: -13,
              },
              iconContainer: {
                top: 16,
                right: 12,
              },
              placeholder: {
                color: theme.placeholder,
              },
            }}
            useNativeAndroidPickerStyle={false}
            Icon={() => <Text style={{ fontSize: 16, color: theme.text }}>▼</Text>}
          />
          <TouchableOpacity onPress={() => removeIngredient(idx)}>
            <Text style={{ color: theme.danger, fontWeight: "bold", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={addIngredient} style={{ marginBottom: 15 }}>
        <Text style={{ color: theme.primary, fontWeight: "bold" }}>+ Add Ingredient</Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Instructions"
        placeholderTextColor={theme.placeholder}
        value={mealInstructions}
        onChangeText={setMealInstructions}
        multiline
      />

      {/* Dietary Restrictions Dropdown */}
      <Text style={[styles.label, { color: theme.text }]}>Dietary Restrictions</Text>
      <RNPickerSelect
        onValueChange={setMealDietaryRestriction}
        items={dietaryOptions}
        placeholder={{ label: "Select Dietary Restriction (optional)", value: "" }}
        style={{
          inputIOS: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
          inputAndroid: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
        }}
        value={mealDietaryRestriction}
      />

      <Text style={[styles.label, { color: theme.text }]}>Cuisine</Text>
      <RNPickerSelect
        onValueChange={setMealCuisine}
        items={cuisineOptions}
        placeholder={{ label: "Select Cuisine (optional)", value: "" }}
        style={{
          inputIOS: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
          inputAndroid: [styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }],
        }}
        value={mealCuisine}
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Servings"
        placeholderTextColor={theme.placeholder}
        value={mealServings}
        onChangeText={setMealServings}
        keyboardType="numeric"
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Calories"
        placeholderTextColor={theme.placeholder}
        value={calories}
        onChangeText={setCalories}
        keyboardType="numeric"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Protein (g)"
        placeholderTextColor={theme.placeholder}
        value={protein}
        onChangeText={setProtein}
        keyboardType="numeric"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Carbohydrates (g)"
        placeholderTextColor={theme.placeholder}
        value={carbohydrates}
        onChangeText={setCarbohydrates}
        keyboardType="numeric"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Fat (g)"
        placeholderTextColor={theme.placeholder}
        value={fat}
        onChangeText={setFat}
        keyboardType="numeric"
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Recipe Link"
        placeholderTextColor={theme.placeholder}
        value={mealRecipeLink}
        onChangeText={setMealRecipeLink}
        multiline
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: theme.text }]}>Make Meal Public</Text>
        <Switch
          value={mealVisibility}
          onValueChange={setMealVisibility}
          thumbColor={mealVisibility ? theme.primary : theme.border}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </View>

      <TouchableOpacity 
        style={[styles.imagePicker, { backgroundColor: theme.primary }]} 
        onPress={pickMealImage}
        disabled={uploadingImage}
      >
        {uploadingImage ? (
          <ActivityIndicator color={theme.buttonText} />
        ) : (
          <Text style={[styles.imagePickerText, { color: theme.buttonText }]}>Pick a Meal Image</Text>
        )}
      </TouchableOpacity>
      {mealPicture && <Image source={{ uri: mealPicture }} style={styles.mealPicture} />}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={handleAddMeal}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={[styles.createButtonText, { color: theme.buttonText }]}>Create Meal</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: theme.danger }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.createButtonText, { color: theme.buttonText }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    width: "100%",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 16,
  },
  imagePicker: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: "bold",
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
});

export default CreateMealScreen;
