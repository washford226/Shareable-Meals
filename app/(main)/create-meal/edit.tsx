import React, { useState, useCallback, useEffect } from "react";
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
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "../../../utils/supabase";
import { 
  calculateAndSaveMealNutrition, 
  formatNutritionDisplay, 
  getIngredientSuggestions,
  type IngredientInput 
} from "../../../utils/edamamUtils";
import { uploadMealImage, deleteMealImage } from "../../../utils/mealImageUtils";
import { MEAL_TYPE_OPTIONS, CUISINE_OPTIONS } from "../../../constants/filterOptions";

// Ingredient input row component
const IngredientRow = ({ ingredient, onChange, onRemove, theme, styles, showRemove = true }: any) => (
  <View style={[styles.ingredientRow, { backgroundColor: theme.card }]}>
    <View style={styles.ingredientInputs}>
      <TextInput
        style={[styles.quantityInput, { 
          backgroundColor: theme.cardSecondary,
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
        style={[styles.unitInput, { 
          backgroundColor: theme.cardSecondary,
          color: theme.text,
          borderColor: theme.border
        }]}
        placeholder="Unit"
        placeholderTextColor={theme.placeholder}
        value={ingredient.unit}
        onChangeText={text => onChange("unit", text)}
      />
      <TextInput
        style={[styles.nameInput, { 
          backgroundColor: theme.cardSecondary,
          color: theme.text,
          borderColor: theme.border
        }]}
        placeholder="Ingredient name"
        placeholderTextColor={theme.placeholder}
        value={ingredient.name}
        onChangeText={text => onChange("name", text)}
      />
    </View>
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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
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
  changesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  changesText: {
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
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
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  instructionsTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  servingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  servingsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    width: 80,
    textAlign: 'center',
  },
  errorText: {
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginBottom: 8,
    marginTop: -8,
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
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
  },
  unitInput: {
    flex: 1.5,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
  },
  nameInput: {
    flex: 3,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
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
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
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
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
  },
  nutritionDisplay: {
    padding: 16,
    borderRadius: 12,
  },
  nutritionDisplayTitle: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 8,
  },
  nutritionText: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    lineHeight: 20,
  },
  manualNutritionSection: {
    gap: 12,
  },
  manualNutritionLabel: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
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
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
  imageSection: {
    alignItems: 'center',
    marginVertical: 8,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: 300,
    height: 200,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    borderRadius: 20,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  uploadingText: {
    marginTop: 8,
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
  },
  imageUploadButton: {
    width: 300,
    height: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageUploadText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
  },
  fieldLabel: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
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
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.bold,
    marginBottom: 20,
    textAlign: 'center',
  },
  optionButton: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  optionText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  selectedOptionText: {
    fontFamily: theme.fontFamily.semiBold,
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
  },
});

const EditMealScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  
  const [mealName, setMealName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string }[]>([]);
  const [instructions, setInstructions] = useState<string>("");
  const [mealType, setMealType] = useState<string>("");
  const [cuisine, setCuisine] = useState<string>("");
  const [cookTime, setCookTime] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [servings, setServings] = useState<string>("1");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [useEdamamCalculation, setUseEdamamCalculation] = useState(true);
  const [manualMacros, setManualMacros] = useState({
    calories: "",
    protein: "",
    fat: "",
    carbohydrates: ""
  });
  const [calculatedNutrition, setCalculatedNutrition] = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [originalMeal, setOriginalMeal] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [mealPicture, setMealPicture] = useState<string | null>(null);
  const [originalPictureUrl, setOriginalPictureUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);

  // Load meal data
  useEffect(() => {
    if (mealId) {
      loadMealData();
    }
  }, [mealId]);

  // Track changes
  useEffect(() => {
    if (originalMeal) {
      const currentData = {
        name: mealName,
        description: description,
        instructions: instructions,
        servings: parseInt(servings) || 1,
        meal_type: mealType,
        cuisine: cuisine,
        cook_time: cookTime,
        ingredients: ingredients,
      };
      
      const hasDataChanged = (
        originalMeal.name !== currentData.name ||
        originalMeal.description !== currentData.description ||
        originalMeal.servings !== currentData.servings ||
        originalMeal.instructions !== currentData.instructions ||
        originalMeal.meal_type !== currentData.meal_type ||
        originalMeal.cuisine !== currentData.cuisine ||
        originalMeal.cook_time !== currentData.cook_time ||
        JSON.stringify(originalMeal.meal_ingredients) !== JSON.stringify(currentData.ingredients) ||
        mealPicture !== originalPictureUrl
      );
      
      setHasChanges(hasDataChanged);
    }
  }, [mealName, description, ingredients, instructions, servings, mealType, cuisine, cookTime, originalMeal, mealPicture, originalPictureUrl]);

  const loadMealData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to edit a meal.");
        router.back();
        return;
      }

      const { data: meal, error: fetchError } = await supabase
        .from('meals')
        .select(`
          *,
          meal_ingredients (
            raw_name,
            quantity,
            unit
          )
        `)
        .eq('id', mealId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!meal) {
        Alert.alert("Error", "Meal not found or you don't have permission to edit it.");
        router.back();
        return;
      }

      // Populate form with existing data
      setOriginalMeal(meal);
      setMealName(meal.name || "");
      setDescription(meal.description || "");
      setInstructions(meal.instructions || "");
      setServings((meal.servings || 1).toString());
      setMealType(meal.meal_type || "");
      setCuisine(meal.cuisine || "");
      setCookTime(meal.cook_time || "");

      // Load ingredients
      if (meal.meal_ingredients && meal.meal_ingredients.length > 0) {
        const ingredientsData = meal.meal_ingredients.map((ing: any) => ({
          name: ing.raw_name || "",
          quantity: ing.quantity ? ing.quantity.toString() : "",
          unit: ing.unit || "",
        }));
        setIngredients(ingredientsData);
      } else {
        setIngredients([{ name: "", quantity: "", unit: "" }]);
      }

      // Load existing nutrition data from the meal columns
      setManualMacros({
        calories: (meal.calories || "").toString(),
        protein: (meal.protein || "").toString(),
        carbohydrates: (meal.carbohydrates || "").toString(),
        fat: (meal.fat || "").toString(),
      });

      // Load meal picture
      if (meal.meal_picture_url) {
        setMealPicture(meal.meal_picture_url);
        setOriginalPictureUrl(meal.meal_picture_url);
      }

      if (meal.Edamam_macros) {
        setUseEdamamCalculation(true);
      } else {
        setUseEdamamCalculation(false);
      }

    } catch (error: any) {
      console.error('Error loading meal:', error);
      setError("Failed to load meal data");
      Alert.alert("Error", "Failed to load meal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Validation function
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!mealName.trim()) {
      errors.mealName = "Meal name is required";
    }
    
    if (ingredients.length === 0 || ingredients.every(ing => !ing.name.trim())) {
      errors.ingredients = "At least one ingredient is required";
    }
    
    if (!instructions.trim()) {
      errors.instructions = "Instructions are required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [mealName, ingredients, instructions]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const calculateNutrition = async () => {
    if (ingredients.some(ing => ing.name.trim() === "")) {
      Alert.alert("Error", "Please fill in all ingredient names before calculating nutrition.");
      return;
    }

    setNutritionLoading(true);
    try {
      const ingredientInputs: IngredientInput[] = ingredients
        .filter(ing => ing.name.trim() !== "")
        .map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit
        }));

      const nutrition = await calculateAndSaveMealNutrition(mealId || "", ingredientInputs);
      if (nutrition) {
        setCalculatedNutrition(nutrition);
        Alert.alert("Success", "Nutrition calculated successfully!");
      }
    } catch (error) {
      console.error('Error calculating nutrition:', error);
      Alert.alert("Error", "Failed to calculate nutrition. Please try again.");
    } finally {
      setNutritionLoading(false);
    }
  };

  // Image picker functions
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setMealPicture(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setMealPicture(null);
  };

  const saveChanges = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the errors before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to save changes.");
        return;
      }

      // Extract nutrition values
      let calories = 0, protein = 0, carbohydrates = 0, fat = 0;
      
      if (useEdamamCalculation && calculatedNutrition) {
        calories = Math.round(calculatedNutrition.calories || 0);
        protein = Math.round(calculatedNutrition.totalNutrients?.PROCNT?.quantity || 0);
        carbohydrates = Math.round(calculatedNutrition.totalNutrients?.CHOCDF?.quantity || 0);
        fat = Math.round(calculatedNutrition.totalNutrients?.FAT?.quantity || 0);
      } else if (!useEdamamCalculation) {
        calories = parseInt(manualMacros.calories) || 0;
        protein = parseInt(manualMacros.protein) || 0;
        carbohydrates = parseInt(manualMacros.carbohydrates) || 0;
        fat = parseInt(manualMacros.fat) || 0;
      }

      // Update the meal
      const { error: updateError } = await supabase
        .from('meals')
        .update({
          name: mealName.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          servings: parseInt(servings) || 1,
          meal_type: mealType || null,
          cuisine: cuisine || null,
          cook_time: cookTime || null,
          calories: calories,
          protein: protein,
          carbohydrates: carbohydrates,
          fat: fat,
          Edamam_macros: useEdamamCalculation,
        })
        .eq('id', mealId)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Handle image upload/update
      let finalImageUrl = originalPictureUrl;
      
      // Check if image was changed
      const imageChanged = mealPicture !== originalPictureUrl;
      
      if (imageChanged) {
        if (mealPicture && !mealPicture.startsWith('http')) {
          // New image selected - upload it
          setImageUploading(true);
          console.log('Uploading new meal image...');
          const newImageUrl = await uploadMealImage(user.id, mealId as string, mealPicture);
          if (newImageUrl) {
            finalImageUrl = newImageUrl;
            // Delete old image if it exists
            if (originalPictureUrl) {
              await deleteMealImage(originalPictureUrl);
            }
          } else {
            console.warn('Failed to upload new image, keeping original');
          }
          setImageUploading(false);
        } else if (!mealPicture && originalPictureUrl) {
          // Image was removed
          console.log('Removing meal image...');
          await deleteMealImage(originalPictureUrl);
          finalImageUrl = null;
        }
        
        // Update meal with new image URL
        const { error: imageUpdateError } = await supabase
          .from('meals')
          .update({ meal_picture_url: finalImageUrl })
          .eq('id', mealId)
          .eq('user_id', user.id);

        if (imageUpdateError) {
          console.warn('Failed to update meal image URL:', imageUpdateError);
        }
      }

      // Update ingredients - delete existing and insert new ones
      const { error: deleteError } = await supabase
        .from('meal_ingredients')
        .delete()
        .eq('meal_id', mealId);

      if (deleteError) {
        console.warn('Failed to delete old ingredients:', deleteError);
      }

      // Insert new ingredients
      if (ingredients.some(ing => ing.name.trim() !== "")) {
        const ingredientsData = ingredients
          .filter(ing => ing.name.trim() !== "")
          .map(ing => ({
            meal_id: parseInt(mealId as string),
            raw_name: ing.name.trim(),
            quantity: parseFloat(ing.quantity) || 1.0,
            unit: ing.unit || null,
          }));

        const { error: ingredientsError } = await supabase
          .from('meal_ingredients')
          .insert(ingredientsData);

        if (ingredientsError) {
          console.warn('Failed to save ingredients:', ingredientsError);
        }
      }

      Alert.alert(
        "Success", 
        "Meal updated successfully!",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );

    } catch (error: any) {
      console.error('Error saving meal:', error);
      setError(error.message || 'Failed to save changes');
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteMeal = async () => {
    Alert.alert(
      "Delete Meal",
      "Are you sure you want to delete this meal? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const { error: deleteError } = await supabase
                .from('meals')
                .delete()
                .eq('id', mealId)
                .eq('user_id', user.id);

              if (deleteError) {
                throw deleteError;
              }

              Alert.alert("Success", "Meal deleted successfully!");
              router.back();
            } catch (error: any) {
              console.error('Error deleting meal:', error);
              Alert.alert("Error", "Failed to delete meal. Please try again.");
            }
          }
        }
      ]
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMealData().finally(() => setRefreshing(false));
  }, [mealId]);

  const renderNutritionSection = () => (
    <View style={styles.section}>
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
          <TouchableOpacity
            style={[styles.calculateButton, { backgroundColor: theme.primary }]}
            onPress={calculateNutrition}
            disabled={nutritionLoading}
          >
            {nutritionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="calculator" size={20} color="#FFFFFF" />
            )}
            <Text style={[styles.calculateButtonText, { color: "#FFFFFF" }]}>
              {nutritionLoading ? "Calculating..." : "Recalculate Nutrition"}
            </Text>
          </TouchableOpacity>

          {calculatedNutrition && (
            <View style={[styles.nutritionDisplay, { backgroundColor: theme.successLight }]}>
              <Text style={[styles.nutritionDisplayTitle, { color: theme.success }]}>
                Calculated Nutrition (per serving)
              </Text>
              <Text style={[styles.nutritionText, { color: theme.text }]}>
                {formatNutritionDisplay(calculatedNutrition)}
              </Text>
            </View>
          )}
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
              value={manualMacros.carbohydrates}
              onChangeText={(text) => setManualMacros(prev => ({ ...prev, carbohydrates: text }))}
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading meal...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          Edit Recipe
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: theme.dangerLight }]}
            onPress={deleteMeal}
          >
            <Ionicons name="trash-outline" size={20} color={theme.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton, 
              { 
                backgroundColor: hasChanges ? theme.primary : theme.cardSecondary,
                opacity: hasChanges ? 1 : 0.6
              }
            ]}
            onPress={saveChanges}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Changes indicator */}
      {hasChanges && (
        <View style={[styles.changesIndicator, { backgroundColor: theme.warningLight }]}>
          <Ionicons name="warning" size={16} color={theme.warning} />
          <Text style={[styles.changesText, { color: theme.warning }]}>
            You have unsaved changes
          </Text>
        </View>
      )}

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
              Recipe Information
            </Text>
            
            {/* Recipe Name */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Recipe Name *
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: validationErrors.mealName ? theme.danger : theme.border,
              }]}
              value={mealName}
              onChangeText={setMealName}
              placeholder="Enter recipe name"
              placeholderTextColor={theme.placeholder}
            />
            
            {validationErrors.mealName && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {validationErrors.mealName}
              </Text>
            )}

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
              value={description}
              onChangeText={setDescription}
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
                value={servings}
                onChangeText={setServings}
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
                color: cuisine ? theme.text : theme.placeholder 
              }]}>
                {cuisine || "Select cuisine type"}
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

          {/* Meal Image */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Meal Image
            </Text>
            
            <View style={styles.imageSection}>
              {mealPicture ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: mealPicture }} style={styles.uploadedImage} />
                  <TouchableOpacity
                    style={[styles.imageOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    onPress={removeImage}
                  >
                    <Ionicons name="trash" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  {imageUploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="large" color={theme.primary} />
                      <Text style={[styles.uploadingText, { color: theme.text }]}>
                        Uploading...
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.imageUploadButton, { 
                    backgroundColor: theme.card,
                    borderColor: theme.border 
                  }]}
                  onPress={pickImage}
                  disabled={imageUploading}
                >
                  <Ionicons name="camera" size={40} color={theme.primary} />
                  <Text style={[styles.imageUploadText, { color: theme.text }]}>
                    Add Meal Photo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
            
            {validationErrors.ingredients && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {validationErrors.ingredients}
              </Text>
            )}
            
            {ingredients.map((ingredient, index) => (
              <IngredientRow
                key={index}
                ingredient={ingredient}
                onChange={(field: string, value: string) => updateIngredient(index, field, value)}
                onRemove={() => removeIngredient(index)}
                theme={theme}
                styles={styles}
                showRemove={ingredients.length > 1}
              />
            ))}
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
                borderColor: validationErrors.instructions ? theme.danger : theme.border,
              }]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Enter step-by-step cooking instructions..."
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={6}
            />
            
            {validationErrors.instructions && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {validationErrors.instructions}
              </Text>
            )}
          </View>

          {/* Nutrition */}
          {renderNutritionSection()}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Meal Type Modal */}
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
                    styles.optionButton,
                    { borderBottomColor: theme.border }
                  ]}
                  onPress={() => {
                    setMealType(type);
                    setShowMealTypeModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    mealType === type && styles.selectedOptionText,
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
              <Text style={[styles.modalCloseButtonText, { color: theme.textSecondary }]}>
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
                    styles.optionButton,
                    { borderBottomColor: theme.border }
                  ]}
                  onPress={() => {
                    setCuisine(cuisineOption);
                    setShowCuisineModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    cuisine === cuisineOption && styles.selectedOptionText,
                    { color: cuisine === cuisineOption ? theme.primary : theme.text }
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
              <Text style={[styles.modalCloseButtonText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EditMealScreen;