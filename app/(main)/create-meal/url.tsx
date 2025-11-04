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
  Switch,
  KeyboardAvoidingView,
  Platform 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "../../../context/ThemeContext";
import { useRevenueCat } from "../../../context/RevenueCatContext";
import { supabase } from "../../../utils/supabase";
import { 
  calculateAndSaveMealNutrition, 
  formatNutritionDisplay, 
  getIngredientSuggestions,
  type IngredientInput 
} from "../../../utils/edamamUtils";
import { Paywall } from "../../../components/Paywall";
import { getResponsiveFontSize } from "../../../utils/responsiveUtils";

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

const URLCreateMealScreen: React.FC = () => {
  const { theme } = useTheme();
  const { isPremium } = useRevenueCat();
  const styles = createStyles(theme);
  const [showPaywall, setShowPaywall] = useState(false);
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
  const [calculatedNutrition, setCalculatedNutrition] = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);

  // Validation function
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!recipeUrl.trim()) {
      errors.recipeUrl = "Recipe URL is required";
    } else {
      try {
        new URL(recipeUrl);
      } catch {
        errors.recipeUrl = "Please enter a valid URL";
      }
    }
    
    if (!mealName.trim()) {
      errors.mealName = "Meal name is required";
    }
    
    if (ingredients.length === 0) {
      errors.ingredients = "At least one ingredient is required";
    }
    
    if (!instructions.trim()) {
      errors.instructions = "Instructions are required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [recipeUrl, mealName, ingredients, instructions]);

  const fetchRecipeFromUrl = async () => {
    // Check if user has premium access
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    if (!recipeUrl.trim()) {
      Alert.alert("Error", "Please enter a recipe URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the recipe-scraper edge function
      const { data, error } = await supabase.functions.invoke('recipe-scraper', {
        body: {
          url: recipeUrl.trim(),
          save: false, // Don't save automatically, let user review first
          user_id: null
        }
      });

      if (error) {
        console.error('Recipe scraping error:', error);
        throw new Error(error.message || 'Failed to scrape recipe');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'No recipe data could be extracted from this URL');
      }

      // Set the scraped recipe data
      setMealName(data.name || "Imported Recipe");
      setDescription(data.description || "Recipe imported from URL");
      
      // Convert ingredients to our component format
      if (data.ingredients && Array.isArray(data.ingredients)) {
        const formattedIngredients = data.ingredients.map((ing: string, index: number) => {
          // Try to parse ingredient text into components
          const parts = ing.match(/^(.+?)(?:\s+(\d+(?:\/\d+)?(?:\.\d+)?)\s*(.+))?$/);
          if (parts) {
            return {
              name: parts[1]?.trim() || ing,
              quantity: parts[2] || "1",
              unit: parts[3]?.trim() || ""
            };
          }
          return { name: ing, quantity: "1", unit: "" };
        });
        setIngredients(formattedIngredients);
      } else {
        // Fallback if no ingredients found
        setIngredients([
          { name: "Please add ingredients manually", quantity: "1", unit: "" }
        ]);
      }
      
      // Set instructions
      if (data.instructions && Array.isArray(data.instructions)) {
        setInstructions(data.instructions.join('\n'));
      } else if (typeof data.instructions === 'string') {
        setInstructions(data.instructions);
      } else {
        setInstructions("Please add cooking instructions manually");
      }
      
      // Set servings if available
      if (data.servings) {
        setServings(String(parseInt(data.servings) || 1));
      }
      
      Alert.alert("Success", "Recipe imported successfully! Please review and edit as needed.");
    } catch (error: any) {
      console.error('Error fetching recipe:', error);
      setError(error.message || "Failed to import recipe from URL");
      Alert.alert("Error", error.message || "Failed to import recipe. Please try entering the recipe manually.");
    } finally {
      setLoading(false);
    }
  };

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

  const calculateNutrition = async (): Promise<any> => {
    if (ingredients.some(ing => ing.name.trim() === "")) {
      return null;
    }

    try {
      const ingredientInputs: IngredientInput[] = ingredients.map(ing => ({
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
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the errors before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to save a meal.");
        return;
      }

      // Prepare nutrition data
      let nutritionData = null;
      let nutritionCalculated = false;
      
      if (useEdamamCalculation) {
        // Auto-calculate nutrition when saving
        nutritionData = await calculateNutrition();
        if (nutritionData) {
          nutritionCalculated = true;
        }
      } else {
        nutritionData = {
          calories: parseInt(manualMacros.calories) || 0,
          totalNutrients: {
            PROCNT: { quantity: parseFloat(manualMacros.protein) || 0 },
            CHOCDF: { quantity: parseFloat(manualMacros.carbohydrates) || 0 },
            FAT: { quantity: parseFloat(manualMacros.fat) || 0 },
          }
        };
        nutritionCalculated = false;
      }

      // Extract nutrition values for database
      let calories = 0, protein = 0, carbohydrates = 0, fat = 0;
      if (nutritionData) {
        calories = Math.round(nutritionData.calories || 0);
        protein = Math.round(nutritionData.totalNutrients?.PROCNT?.quantity || 0);
        carbohydrates = Math.round(nutritionData.totalNutrients?.CHOCDF?.quantity || 0);
        fat = Math.round(nutritionData.totalNutrients?.FAT?.quantity || 0);
      }

      // First, insert the meal
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .insert([{
          user_id: user.id,
          name: mealName.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          calories: calories,
          protein: protein,
          carbohydrates: carbohydrates,
          fat: fat,
          servings: parseInt(servings) || 1,
          visibility: true,
          created_by_ai: false,
          Edamam_macros: nutritionCalculated,
        }])
        .select('id')
        .single();

      if (mealError) {
        throw mealError;
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
        "Meal imported and saved successfully!",
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
      setSaving(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
          Import Recipe
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={saveMeal}
          disabled={saving}
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
          {/* URL Input Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Recipe URL
            </Text>
            
            <TextInput
              style={[styles.urlInput, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: validationErrors.recipeUrl ? theme.danger : theme.border,
              }]}
              value={recipeUrl}
              onChangeText={setRecipeUrl}
              placeholder="https://example.com/recipe"
              placeholderTextColor={theme.placeholder}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            {validationErrors.recipeUrl && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {validationErrors.recipeUrl}
              </Text>
            )}
            
            <TouchableOpacity
              style={[styles.importButton, { backgroundColor: theme.primary }]}
              onPress={fetchRecipeFromUrl}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="download" size={20} color="#FFFFFF" />
              )}
              <Text style={[styles.importButtonText, { color: "#FFFFFF" }]}>
                {loading ? "Importing..." : "Import Recipe"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Recipe Information
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: validationErrors.mealName ? theme.danger : theme.border,
              }]}
              value={mealName}
              onChangeText={setMealName}
              placeholder="Recipe name"
              placeholderTextColor={theme.placeholder}
            />
            
            {validationErrors.mealName && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {validationErrors.mealName}
              </Text>
            )}

            <TextInput
              style={[styles.textArea, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Recipe description"
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
      
      {/* Paywall Modal */}
      <Paywall 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)}
        feature="URL Meal Creation"
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
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
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginBottom: 12,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  importButtonText: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
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
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
  },
  unitInput: {
    flex: 1.5,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
  },
  nameInput: {
    flex: 3,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    ...theme.fonts.small,
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
    ...theme.fonts.body,
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
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
  },
  nutritionDisplay: {
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
    fontFamily: theme.fontFamily.body,
    lineHeight: 20,
  },
  manualNutritionSection: {
    gap: 12,
  },
  manualNutritionLabel: {
    ...theme.fonts.small,
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
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});

export default URLCreateMealScreen;