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
import { 
  checkAIMealCreationUsage, 
  incrementAIMealCreationUsage, 
  getAIMealCreationUsageStatus 
} from "../../../utils/aiUsageUtils";
import { Paywall } from "../../../components/Paywall";

// Premium badge component
const PremiumBadge = ({ theme, styles }: { theme: any; styles: any }) => (
  <View style={[styles.premiumBadge, { backgroundColor: theme.warning }]}>
    <Ionicons name="star" size={12} color="#FFFFFF" />
    <Text style={[styles.premiumText, { color: "#FFFFFF" }]}>
      PREMIUM
    </Text>
  </View>
);

// AI suggestion chip component
const SuggestionChip = ({ text, onPress, theme, styles }: any) => (
  <TouchableOpacity
    style={[styles.suggestionChip, { backgroundColor: theme.card, borderColor: theme.border }]}
    onPress={() => onPress(text)}
  >
    <Text style={[styles.suggestionText, { color: theme.text }]}>
      {text}
    </Text>
  </TouchableOpacity>
);

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

const AICreateMealScreen: React.FC = () => {
  const { theme } = useTheme();
  const { isPremium } = useRevenueCat();
  const styles = createStyles(theme);
  const [showPaywall, setShowPaywall] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>("");
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [useProfileDietaryRestrictions, setUseProfileDietaryRestrictions] = useState(false);
  const [useProfileAllergies, setUseProfileAllergies] = useState(false);
  const [manualMacros, setManualMacros] = useState({
    calories: "",
    protein: "",
    fat: "",
    carbohydrates: ""
  });
  const [calculatedNutrition, setCalculatedNutrition] = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<boolean>(false);
  const [usageStatus, setUsageStatus] = useState<{ used: number; remaining: number; total: number } | null>(null);

  // Common AI prompt suggestions
  const promptSuggestions = [
    "Healthy pasta dish with chicken and vegetables",
    "Quick 30-minute dinner for busy weeknight",
    "Vegetarian comfort food for winter",
    "High-protein breakfast with eggs",
    "Asian-inspired stir-fry with tofu",
    "Mediterranean salad with grilled fish",
    "Low-carb meal with ground turkey",
    "Hearty soup for cold weather"
  ];

  // Load user profile data
  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('dietary_restrictions, allergies')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      setUserProfile(profile);
      
      // Auto-enable profile usage if profile data exists
      if (profile?.dietary_restrictions) {
        setUseProfileDietaryRestrictions(true);
      }
      if (profile?.allergies) {
        setUseProfileAllergies(true);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load AI usage status
  const loadUsageStatus = async () => {
    try {
      const status = await getAIMealCreationUsageStatus();
      setUsageStatus(status);
    } catch (error) {
      console.error('Error loading usage status:', error);
    }
  };

  // Load user profile and usage status on component mount
  React.useEffect(() => {
    loadUserProfile();
    loadUsageStatus();
  }, []);

  // Validation function
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!aiPrompt.trim()) {
      errors.aiPrompt = "AI prompt is required";
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
  }, [aiPrompt, mealName, ingredients, instructions]);

  const generateRecipeFromAI = async () => {
    // Check if user has premium access first
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    // Check AI usage limits for premium users (5 uses per day)
    const usageCheck = await checkAIMealCreationUsage();
    if (!usageCheck.canUse) {
      Alert.alert(
        "Daily Limit Reached", 
        usageCheck.message || "You have reached your daily AI meal creation limit of 5 uses.",
        [
          { text: "OK", style: "default" }
        ]
      );
      return;
    }

    if (!aiPrompt.trim()) {
      Alert.alert("Error", "Please enter a description for the recipe you want to create");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine which dietary restrictions and allergies to use
      const finalDietaryRestrictions = useProfileDietaryRestrictions 
        ? (userProfile?.dietary_restrictions || "")
        : "";
      
      const finalAllergies = useProfileAllergies 
        ? (userProfile?.allergies || "")
        : "";

      // Call the generate-AImeal edge function
      const { data, error } = await supabase.functions.invoke('generate-AImeal', {
        body: {
          prompt: aiPrompt,
          dietaryRestrictions: finalDietaryRestrictions || null,
          allergies: finalAllergies || null
        }
      });

      if (error) {
        console.error('AI generation error:', error);
        throw new Error(error.message || 'Failed to generate recipe');
      }

      if (!data) {
        throw new Error('No recipe data received from AI');
      }

      // Increment usage count after successful generation (for all premium users)
      await incrementAIMealCreationUsage();
      // Reload usage status to update UI
      await loadUsageStatus();

      // Set the generated recipe data
      setMealName(data.name || `AI Generated ${aiPrompt.split(' ').slice(0, 3).join(' ')}`);
      setDescription(data.description || `A delicious ${aiPrompt.toLowerCase()} created by AI to match your preferences.`);
      
      // Convert ingredients array format to our component format
      if (data.ingredients && Array.isArray(data.ingredients)) {
        const formattedIngredients = data.ingredients.map((ing: any) => {
          if (Array.isArray(ing) && ing.length >= 3) {
            return {
              name: ing[0] || "",
              quantity: ing[1] || "1",
              unit: ing[2] || ""
            };
          }
          return { name: "Unknown ingredient", quantity: "1", unit: "" };
        });
        setIngredients(formattedIngredients);
      } else {
        // Fallback ingredients
        setIngredients([
          { name: "Main ingredient", quantity: "1", unit: "cup" },
          { name: "Seasoning", quantity: "1", unit: "tsp" }
        ]);
      }
      
      setInstructions(data.instructions || "1. Prepare all ingredients\n2. Follow the cooking method\n3. Season to taste\n4. Serve hot");
      setGeneratedRecipe(true);
      
      Alert.alert("Success", "Recipe generated successfully! Please review and edit as needed.");
    } catch (error: any) {
      console.error('Error generating recipe:', error);
      setError(error.message || "Failed to generate recipe");
      Alert.alert("Error", "Failed to generate recipe. Please try again or create manually.");
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
          created_by_ai: true,
          Edamam_macros: nutritionCalculated,
          ai_prompt: aiPrompt.trim(),
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
        "AI-generated meal saved successfully!",
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
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: theme.text }]}>
            AI Recipe Generator
          </Text>
          <PremiumBadge theme={theme} styles={styles} />
        </View>
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
          {/* Usage Status Card for Premium Users */}
          {isPremium && usageStatus && (
            <View style={styles.section}>
              <View style={[styles.usageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.usageCardHeader}>
                  <Ionicons name="flash" size={20} color={theme.primary} />
                  <Text style={[styles.usageCardTitle, { color: theme.text }]}>
                    Daily AI Generation Usage
                  </Text>
                </View>
                <View style={styles.usageCardContent}>
                  <Text style={[styles.usageCardText, { color: theme.textSecondary }]}>
                    You have <Text style={[styles.usageCardHighlight, { color: theme.primary }]}>{usageStatus.remaining}</Text> out of {usageStatus.total} AI generations remaining today
                  </Text>
                  <View style={[styles.usageProgressBar, { backgroundColor: theme.cardSecondary }]}>
                    <View 
                      style={[
                        styles.usageProgressFill, 
                        { 
                          backgroundColor: theme.primary,
                          width: `${(usageStatus.used / usageStatus.total) * 100}%`
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* AI Prompt Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Describe Your Recipe
              </Text>
            </View>
            
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Tell AI what kind of meal you want and it will generate a recipe for you
            </Text>
            
            <TextInput
              style={[styles.promptInput, { 
                backgroundColor: theme.card, 
                color: theme.text,
                borderColor: validationErrors.aiPrompt ? theme.danger : theme.border,
              }]}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="E.g., A healthy chicken pasta with vegetables for dinner"
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={3}
            />
            
            {validationErrors.aiPrompt && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {validationErrors.aiPrompt}
              </Text>
            )}

            {/* Prompt Suggestions */}
            <Text style={[styles.suggestionsTitle, { color: theme.textSecondary }]}>
              Popular Ideas:
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsContainer}
            >
              {promptSuggestions.map((suggestion, index) => (
                <SuggestionChip
                  key={index}
                  text={suggestion}
                  onPress={setAiPrompt}
                  theme={theme}
                  styles={styles}
                />
              ))}
            </ScrollView>
            
            {/* Additional Options */}
            <View style={styles.additionalOptions}>
              <Text style={[styles.optionsTitle, { color: theme.text }]}>
                Additional Preferences (Optional)
              </Text>
              
              {/* Dietary Restrictions Section */}
              {userProfile?.dietary_restrictions && (
                <View style={styles.preferenceSection}>
                  <View style={[styles.preferenceToggle, { backgroundColor: theme.card }]}>
                    <View style={styles.preferenceToggleContent}>
                      <Text style={[styles.preferenceToggleLabel, { color: theme.text }]}>
                        Use Profile Dietary Restrictions
                      </Text>
                      <Text style={[styles.profilePreview, { color: theme.textSecondary }]}>
                        "{userProfile.dietary_restrictions}"
                      </Text>
                    </View>
                    <Switch
                      value={useProfileDietaryRestrictions}
                      onValueChange={setUseProfileDietaryRestrictions}
                      trackColor={{ false: theme.cardSecondary, true: theme.primaryLight }}
                      thumbColor={useProfileDietaryRestrictions ? theme.primary : theme.textSecondary}
                    />
                  </View>
                </View>
              )}
              
              {/* Allergies Section */}
              {userProfile?.allergies && (
                <View style={styles.preferenceSection}>
                  <View style={[styles.preferenceToggle, { backgroundColor: theme.card }]}>
                    <View style={styles.preferenceToggleContent}>
                      <Text style={[styles.preferenceToggleLabel, { color: theme.text }]}>
                        Use Profile Allergies
                      </Text>
                      <Text style={[styles.profilePreview, { color: theme.textSecondary }]}>
                        "{userProfile.allergies}"
                      </Text>
                    </View>
                    <Switch
                      value={useProfileAllergies}
                      onValueChange={setUseProfileAllergies}
                      trackColor={{ false: theme.cardSecondary, true: theme.primaryLight }}
                      thumbColor={useProfileAllergies ? theme.primary : theme.textSecondary}
                    />
                  </View>
                </View>
              )}
              
              {/* Info message when no profile data exists */}
              {!userProfile?.dietary_restrictions && !userProfile?.allergies && (
                <View style={[styles.infoMessage, { backgroundColor: theme.cardSecondary }]}>
                  <Ionicons name="information-circle" size={20} color={theme.textSecondary} />
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    No dietary restrictions or allergies found in your profile. Update your profile to use this feature.
                  </Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: theme.primary }]}
              onPress={generateRecipeFromAI}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              )}
              <Text style={[styles.generateButtonText, { color: "#FFFFFF" }]}>
                {loading ? "Generating Recipe..." : "Generate Recipe with AI"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Generated Recipe Information */}
          {generatedRecipe && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Generated Recipe
                </Text>
                
                <View style={[styles.generatedBanner, { backgroundColor: theme.successLight }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  <Text style={[styles.generatedText, { color: theme.success }]}>
                    Recipe generated successfully! Review and edit as needed.
                  </Text>
                </View>
                
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
            </>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Paywall Modal */}
      <Paywall 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)}
        feature="AI Meal Generation"
      />
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
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  premiumText: {
    ...theme.fonts.tiny,
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
  },
  sectionSubtitle: {
    ...theme.fonts.small,
    marginBottom: 16,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  usageCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  usageText: {
    ...theme.fonts.tiny,
    fontFamily: theme.fontFamily.medium,
  },
  usageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  usageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  usageCardTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.heading,
  },
  usageCardContent: {
    gap: 8,
  },
  usageCardText: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
  },
  usageCardHighlight: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '600',
  },
  usageProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  suggestionsTitle: {
    ...theme.fonts.small,
    marginBottom: 8,
    fontFamily: theme.fontFamily.body,
  },
  suggestionsContainer: {
    marginBottom: 16,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  suggestionText: {
    ...theme.fonts.small,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
  },
  generatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  generatedText: {
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  instructionsTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
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
    width: 80,
    textAlign: 'center',
  },
  errorText: {
    ...theme.fonts.small,
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
    textAlign: 'center',
  },
  unitInput: {
    flex: 1.5,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    ...theme.fonts.small,
  },
  nameInput: {
    flex: 3,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    ...theme.fonts.small,
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
  bottomPadding: {
    height: 40,
  },
  additionalOptions: {
    marginTop: 16,
    marginBottom: 8,
  },
  optionsTitle: {
    ...theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 12,
  },
  optionInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    ...theme.fonts.body,
    marginBottom: 12,
  },
  preferenceSection: {
    marginBottom: 16,
  },
  preferenceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  preferenceToggleContent: {
    flex: 1,
    marginRight: 12,
  },
  preferenceToggleLabel: {
    ...theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    marginBottom: 2,
  },
  profilePreview: {
    ...theme.fonts.tiny,
    fontStyle: 'italic',
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  infoText: {
    ...theme.fonts.small,
    flex: 1,
    lineHeight: 18,
  },
});

export default AICreateMealScreen;