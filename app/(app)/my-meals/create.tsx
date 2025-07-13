import React, { useState } from "react";
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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "app/utils_supabase";

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

  const pickMealImage = async () => {
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
          Alert.alert("Error", "Only JPEG and PNG images are allowed.");
          return;
        }

        setMealPicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick an image.");
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: "name" | "quantity" | "unit", value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    setIngredients(newIngredients);
  };

  // Upload image to Supabase Storage and return the public URL
  const uploadImageToSupabase = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split(".").pop();
      const fileName = `meal_${Date.now()}.${fileExt}`;
      const filePath = `meal-pictures/${fileName}`;

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
      Alert.alert("Error", "Failed to upload image.");
      return null;
    }
  };

  const handleAddMeal = async () => {
    if (
      !mealName ||
      !mealDescription ||
      ingredients.some(i => !i.name || !i.quantity || !i.unit)
    ) {
      Alert.alert("Error", "Please fill in all required fields and ingredients.");
      return;
    }

    setLoading(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in again.");
        setLoading(false);
        return;
      }
      const userId = userData.user.id;

      let pictureUrl = null;
      if (mealPicture) {
        pictureUrl = await uploadImageToSupabase(mealPicture);
      }

      const { error } = await supabase.from("meals").insert([
        {
          user_id: userId,
          name: mealName,
          description: mealDescription,
          ingredients,
          instructions: mealInstructions,
          recipeLink: mealRecipeLink,
          visibility: mealVisibility,
          dietary_restrictions: mealDietaryRestriction,
          servings: mealServings ? parseInt(mealServings) : 1,
          cuisine: mealCuisine,
          calories: calories ? parseInt(calories) : null,
          protein: protein ? parseInt(protein) : null,
          carbohydrates: carbohydrates ? parseInt(carbohydrates) : null,
          fat: fat ? parseInt(fat) : null,
          picture: pictureUrl,
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Meal added successfully!");
      router.push("/(app)/my-meals/meals");
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add the meal to the database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
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

      <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.primary }]} onPress={pickMealImage}>
        <Text style={[styles.imagePickerText, { color: theme.buttonText }]}>Pick a Meal Image</Text>
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
});

export default CreateMealScreen;