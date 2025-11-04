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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { router } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from "../../../utils/supabase";
import { 
  calculateAndSaveMealNutrition, 
  formatNutritionDisplay, 
  getIngredientSuggestions,
  type IngredientInput 
} from "../../../utils/edamamUtils";
import { uploadMealImage } from "../../../utils/mealImageUtils";
import { dietaryCreateOptionsEnhanced, cuisineOptionsEnhanced } from "../../../constants/dietaryOptions";
import { MEAL_TYPE_OPTIONS, CUISINE_OPTIONS } from "../../../constants/filterOptions";

const ManualCreateMealScreen = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
  const [mealType, setMealType] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [useEdamamCalculation, setUseEdamamCalculation] = useState(true);
  const [manualMacros, setManualMacros] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  // Nutrition calculation states
  const [calculatedNutrition, setCalculatedNutrition] = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);

  // Modal states
  const [dietaryModalVisible, setDietaryModalVisible] = useState(false);
  const [cuisineModalVisible, setCuisineModalVisible] = useState(false);
  const [mealTypeModalVisible, setMealTypeModalVisible] = useState(false);
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      const newIngredients = ingredients.filter((_, i) => i !== index);
      setIngredients(newIngredients);
    }
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setMealPicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const calculateNutrition = async (): Promise<any> => {
    if (ingredients.some(ing => ing.name.trim() === "")) {
      return null;
    }

    try {
      const ingredientInputs: IngredientInput[] = ingredients
        .filter(ing => ing.name.trim() !== "")
        .map(ing => ({
          text: `${ing.quantity} ${ing.unit} ${ing.name}`.trim(),
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit
        }));

      const nutrition = await calculateAndSaveMealNutrition("", ingredientInputs);
      return nutrition;
    } catch (error) {
      console.error('Error calculating nutrition:', error);
      return null;
    }
  };

  const saveMeal = async () => {
    if (!mealName.trim()) {
      Alert.alert("Error", "Please enter a meal name.");
      return;
    }

    if (ingredients.some(ing => ing.name.trim() === "")) {
      Alert.alert("Error", "Please fill in all ingredient names.");
      return;
    }

    if (!mealInstructions.trim()) {
      Alert.alert("Error", "Please enter cooking instructions.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to create a meal.");
        return;
      }

      // Extract nutrition values from calculated data or manual input
      let calories = 0, protein = 0, carbohydrates = 0, fat = 0;
      let nutritionCalculated = false;
      
      if (useEdamamCalculation) {
        // Auto-calculate nutrition when saving
        const nutrition = await calculateNutrition();
        if (nutrition) {
          calories = Math.round(nutrition.calories || 0);
          protein = Math.round(nutrition.totalNutrients?.PROCNT?.quantity || 0);
          carbohydrates = Math.round(nutrition.totalNutrients?.CHOCDF?.quantity || 0);
          fat = Math.round(nutrition.totalNutrients?.FAT?.quantity || 0);
          nutritionCalculated = true;
        }
      } else {
        calories = parseInt(manualMacros.calories) || 0;
        protein = parseInt(manualMacros.protein) || 0;
        carbohydrates = parseInt(manualMacros.carbs) || 0;
        fat = parseInt(manualMacros.fat) || 0;
        nutritionCalculated = false;
      }

      // First, insert the meal
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .insert([{
          user_id: user.id,
          name: mealName.trim(),
          description: mealDescription.trim(),
          instructions: mealInstructions.trim(),
          calories: calories,
          protein: protein,
          carbohydrates: carbohydrates,
          fat: fat,
          servings: parseInt(mealServings) || 1,
          meal_type: mealType || null,
          cook_time: cookTime || null,
          visibility: mealVisibility,
          dietary_restrictions: mealDietaryRestriction || null,
          cuisine: mealCuisine || null,
          created_by_ai: false,
          Edamam_macros: nutritionCalculated,
        }])
        .select('id')
        .single();

      if (mealError) {
        throw mealError;
      }

      // Upload meal image if selected
      let mealPictureUrl = null;
      if (mealPicture) {
        console.log('Uploading meal image...');
        mealPictureUrl = await uploadMealImage(user.id, mealData.id, mealPicture);
        if (!mealPictureUrl) {
          console.warn('Failed to upload meal image, continuing without image...');
        }
      }

      // Update meal with image URL if upload was successful
      if (mealPictureUrl) {
        const { error: updateError } = await supabase
          .from('meals')
          .update({ meal_picture_url: mealPictureUrl })
          .eq('id', mealData.id);

        if (updateError) {
          console.warn('Failed to update meal with image URL:', updateError);
        }
      }

      // Then insert ingredients if any
      if (ingredients.some(ing => ing.name.trim() !== "")) {
        const ingredientsData = ingredients
          .filter(ing => ing.name.trim() !== "")
          .map(ing => ({
            meal_id: mealData.id,
            raw_name: ing.name.trim(),
            quantity: parseFloat(ing.quantity) || 1.0,
            unit: ing.unit || null,
          }));

        const { error: ingredientsError } = await supabase
          .from('meal_ingredients')
          .insert(ingredientsData);

        if (ingredientsError) {
          console.warn('Failed to save ingredients:', ingredientsError);
          // Don't fail the whole operation if ingredients fail
        }
      }

      Alert.alert(
        "Success", 
        "Meal created successfully!",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );

    } catch (error: any) {
      console.error('Error saving meal:', error);
      setError(error.message || 'Failed to save meal');
      Alert.alert("Error", "Failed to save meal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const renderIngredientInput = (ingredient: any, index: number) => (
    <View key={index} style={[styles.ingredientRow, { backgroundColor: theme.card }]}>
      <View style={styles.ingredientInputs}>
        <TextInput
          style={[styles.quantityInput, { 
            backgroundColor: theme.cardSecondary, 
            color: theme.text,
            borderColor: theme.border,
          }]}
          value={ingredient.quantity}
          onChangeText={(text) => updateIngredient(index, 'quantity', text)}
          placeholder="Amount"
          placeholderTextColor={theme.placeholder}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.unitInput, { 
            backgroundColor: theme.cardSecondary, 
            color: theme.text,
            borderColor: theme.border,
          }]}
          value={ingredient.unit}
          onChangeText={(text) => updateIngredient(index, 'unit', text)}
          placeholder="Unit"
          placeholderTextColor={theme.placeholder}
        />
        <TextInput
          style={[styles.nameInput, { 
            backgroundColor: theme.cardSecondary, 
            color: theme.text,
            borderColor: theme.border,
          }]}
          value={ingredient.name}
          onChangeText={(text) => updateIngredient(index, 'name', text)}
          placeholder="Ingredient name"
          placeholderTextColor={theme.placeholder}
        />
      </View>
      {ingredients.length > 1 && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeIngredient(index)}
        >
          <Ionicons name="close-circle" size={24} color={theme.danger} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderNutritionSection = () => (
    <View style={styles.nutritionSection}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Nutrition Information
      </Text>
      
      <View style={[styles.nutritionToggle, { backgroundColor: theme.card }]}>
        <Text style={[styles.toggleLabel, { color: theme.text }]}>
          Auto-calculate nutrition from ingredients
        </Text>
        <Switch
          value={useEdamamCalculation}
          onValueChange={setUseEdamamCalculation}
          trackColor={{ false: theme.cardSecondary, true: theme.primaryLight }}
          thumbColor={useEdamamCalculation ? theme.primary : theme.textSecondary}
        />
      </View>

      {useEdamamCalculation ? (
        <View style={styles.autoNutritionSection}>
          <Text style={[styles.manualNutritionLabel, { color: theme.textSecondary }]}>
            Nutrition will be automatically calculated when you save the meal.
          </Text>
        </View>
      ) : (
        <View style={styles.manualNutritionSection}>
          <Text style={[styles.manualNutritionLabel, { color: theme.textSecondary }]}>
            Enter nutrition information manually (per serving)
          </Text>
          <View style={styles.macroInputs}>
            <TextInput
              style={[styles.macroInput, { 
                backgroundColor: theme.cardSecondary, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={manualMacros.calories}
              onChangeText={(text) => setManualMacros(prev => ({ ...prev, calories: text }))}
              placeholder="Calories"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.macroInput, { 
                backgroundColor: theme.cardSecondary, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={manualMacros.protein}
              onChangeText={(text) => setManualMacros(prev => ({ ...prev, protein: text }))}
              placeholder="Protein (g)"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.macroInput, { 
                backgroundColor: theme.cardSecondary, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={manualMacros.carbs}
              onChangeText={(text) => setManualMacros(prev => ({ ...prev, carbs: text }))}
              placeholder="Carbs (g)"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.macroInput, { 
                backgroundColor: theme.cardSecondary, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={manualMacros.fat}
              onChangeText={(text) => setManualMacros(prev => ({ ...prev, fat: text }))}
              placeholder="Fat (g)"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
            />
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>
          Create Recipe
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={saveMeal}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Basic Information
            </Text>
            
            {/* Recipe Name */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Recipe Name *
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={mealName}
              onChangeText={setMealName}
              placeholder="Enter recipe name"
              placeholderTextColor={theme.placeholder}
            />

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Description
            </Text>
            <TextInput
              style={[styles.textArea, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={mealDescription}
              onChangeText={setMealDescription}
              placeholder="Describe your recipe..."
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={3}
            />

            <View style={styles.servingsContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Servings:</Text>
              <TextInput
                style={[styles.servingsInput, { 
                  backgroundColor: theme.card, 
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={mealServings}
                onChangeText={setMealServings}
                placeholder="1"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />
            </View>

            {/* Meal Type Dropdown */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Meal Type
            </Text>
            <TouchableOpacity
              style={[styles.dropdownButton, { 
                backgroundColor: theme.card, 
                borderColor: theme.border,
              }]}
              onPress={() => setShowMealTypeModal(true)}
            >
              <Text style={[styles.dropdownText, { 
                color: mealType ? theme.text : theme.placeholder 
              }]}>
                {mealType ? mealType.charAt(0).toUpperCase() + mealType.slice(1) : "Select meal type"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Cuisine Dropdown */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Cuisine
            </Text>
            <TouchableOpacity
              style={[styles.dropdownButton, { 
                backgroundColor: theme.card, 
                borderColor: theme.border,
              }]}
              onPress={() => setShowCuisineModal(true)}
            >
              <Text style={[styles.dropdownText, { 
                color: mealCuisine ? theme.text : theme.placeholder 
              }]}>
                {mealCuisine || "Select cuisine type"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Cook Time */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Cook Time
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={cookTime}
              onChangeText={setCookTime}
              placeholder="e.g., 30 minutes"
              placeholderTextColor={theme.placeholder}
            />
          </View>

          {/* Image Upload */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Recipe Photo
            </Text>
            
            <TouchableOpacity
              style={[styles.imageUploadContainer, { 
                backgroundColor: theme.card,
                borderColor: theme.border,
              }]}
              onPress={pickImage}
            >
              {mealPicture ? (
                <Image source={{ uri: mealPicture }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.imageUploadPlaceholder}>
                  <Ionicons name="camera" size={32} color={theme.textSecondary} />
                  <Text style={[styles.imageUploadText, { color: theme.textSecondary }]}>
                    Tap to add photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Ingredients */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Ingredients
              </Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={addIngredient}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {ingredients.map((ingredient, index) => renderIngredientInput(ingredient, index))}
          </View>

          {/* Instructions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Instructions
            </Text>
            
            <TextInput
              style={[styles.instructionsTextArea, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={mealInstructions}
              onChangeText={setMealInstructions}
              placeholder="Enter step-by-step cooking instructions..."
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={6}
            />
          </View>

          {/* Nutrition */}
          {renderNutritionSection()}

          {/* Additional Options */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Additional Information
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={mealRecipeLink}
              onChangeText={setMealRecipeLink}
              placeholder="Recipe link (optional)"
              placeholderTextColor={theme.placeholder}
              keyboardType="url"
            />

            <View style={[styles.visibilityContainer, { backgroundColor: theme.card }]}>
              <Text style={[styles.label, { color: theme.text }]}>
                Make recipe public
              </Text>
              <Switch
                value={mealVisibility}
                onValueChange={setMealVisibility}
                trackColor={{ false: theme.cardSecondary, true: theme.primaryLight }}
                thumbColor={mealVisibility ? theme.primary : theme.textSecondary}
              />
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Meal Type Selection Modal */}
      <Modal
        visible={showMealTypeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMealTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Select Meal Type
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {MEAL_TYPE_OPTIONS.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalOption,
                    { borderBottomColor: theme.border }
                  ]}
                  onPress={() => {
                    setMealType(type);
                    setShowMealTypeModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    mealType === type && { fontWeight: '600' },
                    { color: mealType === type ? theme.primary : theme.text }
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: theme.cardSecondary }]}
              onPress={() => setShowMealTypeModal(false)}
            >
              <Text style={[{ color: theme.textSecondary, fontSize: 16, fontWeight: '600' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cuisine Modal */}
      <Modal
        visible={showCuisineModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCuisineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Select Cuisine
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CUISINE_OPTIONS.map((cuisineOption) => (
                <TouchableOpacity
                  key={cuisineOption}
                  style={[
                    styles.modalOption,
                    { borderBottomColor: theme.border }
                  ]}
                  onPress={() => {
                    setMealCuisine(cuisineOption);
                    setShowCuisineModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    mealCuisine === cuisineOption && { fontWeight: '600' },
                    { color: mealCuisine === cuisineOption ? theme.primary : theme.text }
                  ]}>
                    {cuisineOption}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: theme.cardSecondary }]}
              onPress={() => setShowCuisineModal(false)}
            >
              <Text style={[{ color: theme.textSecondary, fontSize: 16, fontWeight: '600' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    backButton: {
      padding: 4,
    },
    title: {
      ...theme.fonts.large,
      fontFamily: theme.fontFamily.heading,
    },
    saveButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 60,
      alignItems: 'center',
    },
    saveButtonText: {
      ...theme.fonts.small,
      fontFamily: theme.fontFamily.heading,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    sectionTitle: {
      ...theme.fonts.large,
      fontFamily: theme.fontFamily.heading,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      ...theme.fonts.body,
      marginBottom: 16,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      ...theme.fonts.body,
      marginBottom: 16,
      height: 100,
      textAlignVertical: 'top',
    },
    // Image Upload Styles
    imageUploadContainer: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      minHeight: 120,
    },
    uploadText: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
      marginTop: 8,
      textAlign: 'center',
    },
    uploadedImageContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    uploadedImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      borderRadius: 20,
      padding: 8,
    },
    // Ingredient Styles
    ingredientsContainer: {
      marginBottom: 24,
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
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
    },
    quantityInput: {
      width: 80,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
      textAlign: 'center',
    },
    unitInput: {
      width: 80,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
      textAlign: 'center',
    },
    addIngredientButton: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    addIngredientText: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
    },
    removeIngredientButton: {
      padding: 4,
      borderRadius: 8,
    },
    // Instruction Styles
    instructionsContainer: {
      marginBottom: 24,
    },
    instructionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 8,
    },
    instructionNumber: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
      marginTop: 12,
      minWidth: 24,
    },
    instructionInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
      minHeight: 40,
      textAlignVertical: 'top',
    },
    addInstructionButton: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    addInstructionText: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
    },
    removeInstructionButton: {
      padding: 4,
      borderRadius: 8,
      marginTop: 8,
    },
    // Nutrition Toggle
    nutritionToggleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
    },
    nutritionToggleText: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
    },
    nutritionContainer: {
      marginBottom: 24,
    },
    autoNutritionContainer: {
      backgroundColor: 'rgba(52, 152, 219, 0.1)',
      padding: 16,
      borderRadius: 12,
    },
    nutritionDisplayTitle: {
      ...theme.fonts.small,
      fontFamily: theme.fontFamily.heading,
      marginBottom: 8,
    },
    nutritionText: {
      ...theme.fonts.small,
      lineHeight: 20,
    },
    manualNutritionSection: {
      gap: 12,
    },
    manualNutritionLabel: {
      ...theme.fonts.small,
      marginBottom: 8,
    },
    macroInputs: {
      flexDirection: 'row',
      gap: 12,
    },
    macroInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
      textAlign: 'center',
    },
    visibilityContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 12,
    },
    selectButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      marginBottom: 12,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
      maxHeight: '70%',
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalTitle: {
      ...theme.fonts.large,
      fontFamily: theme.fontFamily.heading,
      marginBottom: 20,
      textAlign: 'center',
    },
    modalCloseButton: {
      padding: 4,
      marginTop: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalScrollView: {
      maxHeight: 300,
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      marginVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalOptionText: {
      ...theme.fonts.body,
    },
    bottomPadding: {
      height: 40,
    },
    fieldLabel: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
      marginBottom: 8,
      marginTop: 12,
    },
    dropdownButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    dropdownText: {
      ...theme.fonts.body,
      flex: 1,
    },
    // Additional missing styles
    ingredientInputs: {
      flex: 1,
      gap: 8,
    },
    nameInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
    },
    removeButton: {
      padding: 4,
      borderRadius: 8,
    },
    nutritionSection: {
      marginBottom: 24,
    },
    nutritionToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
    },
    toggleLabel: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
    },
    autoNutritionSection: {
      marginTop: 16,
    },
    calculateButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    calculateButtonText: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
    },
    nutritionDisplay: {
      padding: 16,
      borderRadius: 12,
    },
    servingsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    label: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
    },
    servingsInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      ...theme.fonts.small,
      textAlign: 'center',
      width: 80,
    },
    imageUploadPlaceholder: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    imageUploadText: {
      ...theme.fonts.body,
      fontFamily: theme.fontFamily.heading,
      textAlign: 'center',
    },
    addButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
    },
    instructionsTextArea: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      ...theme.fonts.body,
      height: 120,
      textAlignVertical: 'top',
    },
  });

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  instructionsTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  servingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  servingsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
  },
  imageUploadContainer: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  imageUploadPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  imageUploadText: {
    fontSize: 16,
  },
  uploadedImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  ingredientRow: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  unitInput: {
    flex: 1.5,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  nameInput: {
    flex: 3,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  nutritionSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  nutritionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    flex: 1,
  },
  autoNutritionSection: {
    gap: 12,
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  calculateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nutritionDisplay: {
    padding: 16,
    borderRadius: 12,
  },
  nutritionDisplayTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  nutritionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  manualNutritionSection: {
    gap: 12,
  },
  manualNutritionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  macroInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  macroInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  visibilityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalCloseButton: {
    padding: 4,
    marginTop: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalOptionText: {
    fontSize: 16,
  },
  bottomPadding: {
    height: 40,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
});

export default ManualCreateMealScreen;