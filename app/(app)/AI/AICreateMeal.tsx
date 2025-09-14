import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { supabase } from "utils/supabase";
import { useTheme } from "../../../context/ThemeContext";
import { useAIUsage } from "../../../hooks/useAIUsage";
import { 
  calculateAndSaveMealNutrition, 
  formatNutritionDisplay, 
  getIngredientSuggestions,
  type IngredientInput 
} from "utils/edamamUtils";

const AICreateMeal = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { todayUsage, remaining, dailyLimit, canUse, useAICreation, isLoading: usageLoading } = useAIUsage();
  const [prompt, setPrompt] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [generatedMeal, setGeneratedMeal] = useState<{
    name: string;
    description: string;
    servings: string;
    ingredients: { name: string; quantity: string; unit: string }[];
    instructions: string;
    macros?: {
      calories: number;
      protein: number;
      fat: number;
      carbohydrates: number;
    };
  }>({
    name: "",
    description: "",
    servings: "1",
    ingredients: [],
    instructions: "",
    macros: {
      calories: 0,
      protein: 0,
      fat: 0,
      carbohydrates: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usePantry, setUsePantry] = useState(false);
  const [fetchingRestrictions, setFetchingRestrictions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Enhanced fetch function with retry logic
  const fetchDietaryRestrictions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setFetchingRestrictions(true);
      }
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      
      setUserId(userData.user.id);

      // Fetch user profile from 'user_profiles' table
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (error) {
        throw new Error("Failed to fetch dietary restrictions.");
      }

      setDietaryRestrictions(data.dietary_restrictions || "");
      setAllergies(data.allergies || "");
      
      setRetryCount(0);
    } catch (error: any) {
      console.error("Error fetching dietary restrictions:", error);
      const errorMessage = error.message || "An error occurred while fetching dietary restrictions.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.replace("/login") }
        ]);
      }
    } finally {
      setFetchingRestrictions(false);
      setRefreshing(false);
    }
  }, [router]);

  // Retry function with exponential backoff
  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 16000);
    
    setTimeout(() => {
      fetchDietaryRestrictions();
    }, delay);
  }, [retryCount, fetchDietaryRestrictions]);

  // Fetch dietary restrictions and user ID from Supabase
  useEffect(() => {
    fetchDietaryRestrictions();
  }, [fetchDietaryRestrictions]);

  // Validation functions
  const validateMeal = useCallback(() => {
    const errors: {[key: string]: string} = {};

    if (!generatedMeal.name.trim()) {
      errors.name = "Meal name is required";
    } else if (generatedMeal.name.length > 100) {
      errors.name = "Meal name must be 100 characters or less";
    }

    if (!generatedMeal.description.trim()) {
      errors.description = "Description is required";
    } else if (generatedMeal.description.length > 500) {
      errors.description = "Description must be 500 characters or less";
    }

    if (!generatedMeal.servings || !/^\d+$/.test(generatedMeal.servings) || parseInt(generatedMeal.servings) < 1) {
      errors.servings = "Servings must be a positive number";
    }

    if (generatedMeal.ingredients.length === 0) {
      errors.ingredients = "At least one ingredient is required";
    }

    if (!generatedMeal.instructions.trim()) {
      errors.instructions = "Instructions are required";
    } else if (generatedMeal.instructions.length > 20000) {
      errors.instructions = "Instructions must be 20000 characters or less";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [generatedMeal]);

  // Enhanced parsing function for AI generated ingredients
  const parseIngredients = (ingredientsText: string) => {
    try {
      const lines = ingredientsText
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^[-•*]\s*$/));

      return lines.map((line, index) => {
        // Remove leading bullet points, numbers, or dashes
        const cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
        
        // Try to parse structured format like "2 cups flour"
        const match = cleanLine.match(/^([0-9./]+)\s*([a-zA-Z]+)?\s*(.+)$/);
        
        if (match) {
          const [, quantity, unit = '', ingredient] = match;
          return {
            name: ingredient.trim() || `Ingredient ${index + 1}`,
            quantity: quantity.trim(),
            unit: unit.trim(),
          };
        } else {
          // Fallback for unstructured text
          return {
            name: cleanLine || `Ingredient ${index + 1}`,
            quantity: "1",
            unit: "piece",
          };
        }
      }).filter(ingredient => ingredient.name && ingredient.name.length > 0);
    } catch (error) {
      console.warn('Error parsing ingredients:', error);
      return [];
    }
  };

  // Enhanced AI meal generation with error handling and nutrition calculation
  const handleGenerateMeal = async () => {
    if (loading || saving || !prompt.trim()) {
      return;
    }

    // Check if user can use AI creation
    if (!canUse) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${todayUsage} of your daily AI meal creations. The limit resets at midnight.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Add haptic feedback
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptics not available:', error);
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Track AI usage
      const usageResult = await useAICreation();
      if (!usageResult.success) {
        Alert.alert('Usage Limit', usageResult.error || 'Cannot use AI creation right now');
        setLoading(false);
        return;
      }

      // Enhanced prompt with dietary restrictions and allergies
      let enhancedPrompt = prompt;
      
      if (dietaryRestrictions || allergies) {
        enhancedPrompt += `\n\nDietary requirements: ${dietaryRestrictions}${dietaryRestrictions && allergies ? ', ' : ''}${allergies}`;
      }
      
      if (usePantry) {
        enhancedPrompt += "\nPlease prioritize common pantry ingredients.";
      }

      console.log('Making request with enhanced prompt:', enhancedPrompt);

      // Call the Supabase Edge Function for AI meal generation
      const { data: mealData, error: functionError } = await supabase.functions.invoke('generate-AImeal', {
        body: {
          prompt: prompt.trim(),
          dietaryRestrictions: dietaryRestrictions || undefined,
          allergies: allergies || undefined,
          pantryItems: usePantry ? [] : undefined // TODO: Add actual pantry items if needed
        }
      });

      if (functionError) {
        console.error('Edge Function Error:', functionError);
        throw new Error(functionError.message || 'Failed to generate meal');
      }

      if (!mealData) {
        console.error('Edge Function returned no data');
        throw new Error('No meal data received from AI service');
      }

      if (mealData.error) {
        console.error('Edge Function returned error:', mealData.error);
        throw new Error(mealData.error);
      }

      console.log('Edge Function Response:', mealData);

      // Validate required fields
      if (!mealData.name || !mealData.description || !mealData.ingredients || !mealData.instructions) {
        throw new Error("Incomplete meal data received from AI. Please try again.");
      }

      // Parse ingredients - Edge Function returns 2D array format [[name, quantity, unit], ...]
      let parsedIngredients;
      if (Array.isArray(mealData.ingredients)) {
        // New format from Edge Function: 2D array
        parsedIngredients = mealData.ingredients.map((ingredient: any, index: number) => {
          if (Array.isArray(ingredient) && ingredient.length >= 3) {
            return {
              name: String(ingredient[0]).trim() || `Ingredient ${index + 1}`,
              quantity: String(ingredient[1]).trim() || "1",
              unit: String(ingredient[2]).trim() || "",
            };
          } else {
            console.warn('Invalid ingredient format:', ingredient);
            return {
              name: `Ingredient ${index + 1}`,
              quantity: "1",
              unit: "",
            };
          }
        }).filter((ingredient: any) => ingredient.name && ingredient.name.length > 0);
      } else {
        // Fallback to old string parsing format
        parsedIngredients = parseIngredients(mealData.ingredients);
      }
      
      if (parsedIngredients.length === 0) {
        throw new Error("Failed to parse ingredients. Please try again with a more specific prompt.");
      }

      const newMeal = {
        name: mealData.name.trim(),
        description: mealData.description.trim(),
        servings: mealData.servings?.toString() || "4",
        ingredients: parsedIngredients,
        instructions: mealData.instructions.trim(),
        macros: {
          calories: 0,
          protein: 0,
          fat: 0,
          carbohydrates: 0
        }
      };

      console.log('Setting generated meal:', newMeal);
      setGeneratedMeal(newMeal);

      // Calculate nutrition information
      try {
        console.log('Calculating nutrition for ingredients:', newMeal.ingredients);
        // We'll calculate nutrition after the meal is saved since we need the meal ID
      } catch (nutritionError) {
        console.warn('Nutrition calculation will be done after meal is saved:', nutritionError);
        // Don't throw here - nutrition is optional
      }

      // Provide haptic success feedback
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.warn('Haptics not available:', error);
        }
      }

    } catch (error: any) {
      console.error("Error generating meal:", error);
      
      let errorMessage = "Failed to generate meal. Please try again.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString().includes('Network request failed')) {
        errorMessage = "Network connection failed. Please check your internet connection.";
      } else if (error.toString().includes('JSON')) {
        errorMessage = "AI response formatting issue. Please try again.";
      }
      
      setError(errorMessage);
      Alert.alert("Error", errorMessage);

      // Provide haptic error feedback
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (error) {
          console.warn('Haptics not available:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Save generated meal to Supabase
  const handleSaveMeal = async () => {
    if (!validateMeal()) {
      Alert.alert("Validation Error", "Please fix the errors before saving.");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setSaving(true);
    
    try {
      // First, insert the meal into the meals table
      const { data: mealData, error: mealError } = await supabase
        .from("meals")
        .insert([
          {
            user_id: userId,
            name: generatedMeal.name,
            description: generatedMeal.description,
            servings: parseInt(generatedMeal.servings),
            instructions: generatedMeal.instructions,
            calories: generatedMeal.macros?.calories || null,
            protein: generatedMeal.macros?.protein || null,
            fat: generatedMeal.macros?.fat || null,
            carbohydrates: generatedMeal.macros?.carbohydrates || null,
            created_by_ai: true, // Mark as AI-generated
            created_by: "AI Meal Generator",
            dietary_restrictions: dietaryRestrictions || null,
            AI_Macros: false, // Will be updated after nutrition calculation
            Edamam_macros: false
          },
        ])
        .select('id')
        .single();

      if (mealError) {
        console.error("Supabase meal error:", mealError);
        throw mealError;
      }

      const mealId = mealData.id;
      console.log('Meal saved with ID:', mealId);

      // Second, insert the ingredients into the meal_ingredients table
      if (generatedMeal.ingredients.length > 0) {
        const ingredientsToInsert = generatedMeal.ingredients.map(ingredient => ({
          meal_id: mealId,
          raw_name: ingredient.name,
          quantity: parseFloat(ingredient.quantity) || 1.0,
          unit: ingredient.unit || ''
        }));

        const { error: ingredientsError } = await supabase
          .from("meal_ingredients")
          .insert(ingredientsToInsert);

        if (ingredientsError) {
          console.error("Supabase ingredients error:", ingredientsError);
          throw ingredientsError;
        }

        console.log('Ingredients saved successfully');
      }

      // Third, calculate nutrition using Edamam if ingredients are available
      try {
        if (generatedMeal.ingredients.length > 0) {
          console.log('Calculating nutrition for meal ID:', mealId);
          await calculateAndSaveMealNutrition(mealId, generatedMeal.ingredients);
          console.log('Nutrition calculation completed');
        }
      } catch (nutritionError) {
        console.warn('Nutrition calculation failed, but meal was saved:', nutritionError);
        // Don't throw here - the meal was saved successfully
      }

      // AI meal saved successfully
      console.log('New AI meal saved successfully');

      // Provide haptic success feedback
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.warn('Haptics not available:', error);
        }
      }

      Alert.alert("Success", "Meal saved successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);

    } catch (error: any) {
      console.error("Error saving meal:", error);
      const errorMessage = error.message || "Failed to save meal. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);

      // Provide haptic error feedback
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (error) {
          console.warn('Haptics not available:', error);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Add/remove ingredient functions
  const addIngredient = () => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", quantity: "", unit: "" }]
    }));
  };

  const removeIngredient = (index: number) => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, i) =>
        i === index ? { ...ingredient, [field]: value } : ingredient
      )
    }));
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    fetchDietaryRestrictions(true);
  }, [fetchDietaryRestrictions]);

  // Loading state
  if (fetchingRestrictions) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
      </View>
    );
  }

  // Error state with retry option
  if (error && retryCount > 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.retryBanner, { backgroundColor: theme.warningLight, borderColor: theme.warning }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retrying in {Math.min(1000 * Math.pow(2, retryCount - 1), 16000) / 1000}s... (Attempt {retryCount})
          </Text>
        </View>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* AI Usage Display */}
        {!usageLoading && (
          <View style={[styles.usageDisplay, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.usageInfo}>
              <Ionicons name="sparkles" size={20} color={theme.primary} />
              <Text style={[styles.usageText, { color: theme.text }]}>
                AI Creations: {todayUsage}/{__DEV__ ? '∞' : dailyLimit} used today
              </Text>
            </View>
            <Text style={[styles.remainingText, { color: remaining > 0 ? theme.success : theme.danger }]}>
              {remaining > 0 ? `${remaining} remaining` : 'Limit reached'}
            </Text>
          </View>
        )}

        {/* Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}>
            <Text style={[styles.errorBannerText, { color: theme.danger }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
              onPress={() => setError(null)}
            >
              <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.back()}
          disabled={loading || saving}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="arrow-back" 
            size={20} 
            color={theme.textSecondary} 
            style={styles.backIcon}
          />
          <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.text }]}>AI Meal Creator</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Generate personalized meals with AI
          </Text>
        </View>

        {/* Prompt Section */}
        <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              ✨ Meal Prompt *
            </Text>
            <Text style={[styles.characterCount, { color: theme.textSecondary }]}>
              {prompt.length}/200
            </Text>
          </View>
          
          <TextInput
            style={[
              styles.input,
              styles.multilineInput,
              { 
                borderColor: validationErrors.prompt ? theme.danger : theme.border, 
                color: theme.text,
                backgroundColor: theme.card,
                shadowColor: theme.shadow
              }
            ]}
            placeholder="Describe the meal you'd like to create (e.g., 'healthy vegetarian pasta dish' or 'quick protein-rich breakfast')"
            placeholderTextColor={theme.textSecondary}
            value={prompt}
            onChangeText={(text) => {
              if (text.length <= 200) {
                setPrompt(text);
                if (validationErrors.prompt) {
                  setValidationErrors(prev => ({ ...prev, prompt: "" }));
                }
              }
            }}
            multiline
            maxLength={200}
          />
          
          {validationErrors.prompt && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {validationErrors.prompt}
            </Text>
          )}
          
          {/* Example Hints */}
          <View style={[styles.exampleHint, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={{ color: theme.primary }}>💡</Text>
            <Text style={[styles.exampleText, { color: theme.textSecondary }]}>
              Try: "Mediterranean chicken with vegetables", "Quick vegetarian stir-fry", or "High-protein breakfast bowl"
            </Text>
          </View>
        </View>

        {/* Dietary Information Display */}
        {(dietaryRestrictions || allergies) && (
          <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              🍽️ Your Dietary Information
            </Text>
            
            {dietaryRestrictions && (
              <View style={[styles.dietaryBadge, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.dietaryText, { color: theme.primary }]}>
                  Dietary: {dietaryRestrictions}
                </Text>
              </View>
            )}
            
            {allergies && (
              <View style={[styles.dietaryBadge, { backgroundColor: theme.warningLight }]}>
                <Text style={[styles.dietaryText, { color: theme.warning }]}>
                  Allergies: {allergies}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Pantry Priority Option */}
        <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setUsePantry(!usePantry)}
          >
            <View style={[
              styles.checkbox,
              {
                borderColor: theme.border,
                backgroundColor: usePantry ? theme.primary : theme.card,
                shadowColor: theme.shadow
              }
            ]}>
              {usePantry && (
                <Text style={[styles.checkboxMark, { color: theme.buttonText }]}>✓</Text>
              )}
            </View>
            <View style={styles.checkboxContent}>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                🥫 Prioritize Pantry Ingredients
              </Text>
              <Text style={[styles.checkboxDescription, { color: theme.textSecondary }]}>
                Generate meals using common pantry ingredients to minimize shopping trips
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[
            styles.generateButton, 
            { 
              backgroundColor: loading || saving || !prompt.trim() || !canUse
                ? theme.border 
                : theme.primary,
              shadowColor: loading || saving || !prompt.trim() || !canUse
                ? 'transparent' 
                : theme.primary,
            }
          ]}
          onPress={handleGenerateMeal}
          disabled={loading || saving || !prompt.trim() || !canUse}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color={theme.buttonTextPrimary} style={{ marginRight: 8 }} />
                <Text style={[styles.generateButtonText, { color: theme.buttonTextPrimary }]}>
                  Generating...
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.generateButtonIcon, { color: theme.buttonTextPrimary }]}>
                  ✨
                </Text>
                <Text style={[styles.generateButtonText, { color: theme.buttonTextPrimary }]}>
                  {canUse ? `Generate AI Meal (${remaining} left)` : 'Daily Limit Reached'}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Generated Meal Result */}
        {generatedMeal.name && (
          <View style={styles.resultContainer}>
            <Text style={[styles.resultTitle, { color: theme.text }]}>Generated Meal</Text>

            {/* Meal Name */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Meal Name *</Text>
              <TextInput
                style={[
                  styles.resultInput, 
                  { 
                    borderColor: validationErrors.name ? theme.danger : theme.border, 
                    color: theme.text, 
                    backgroundColor: theme.card 
                  }
                ]}
                value={generatedMeal.name}
                onChangeText={(text) => setGeneratedMeal(prev => ({ ...prev, name: text }))}
                placeholder="Enter meal name"
                placeholderTextColor={theme.textSecondary}
                maxLength={100}
              />
              {validationErrors.name && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.name}
                </Text>
              )}
            </View>

            {/* Description */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Description *</Text>
              <TextInput
                style={[
                  styles.resultInput, 
                  styles.multilineInput,
                  { 
                    borderColor: validationErrors.description ? theme.danger : theme.border, 
                    color: theme.text, 
                    backgroundColor: theme.card 
                  }
                ]}
                value={generatedMeal.description}
                onChangeText={(text) => setGeneratedMeal(prev => ({ ...prev, description: text }))}
                placeholder="Enter meal description"
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={500}
              />
              {validationErrors.description && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.description}
                </Text>
              )}
            </View>

            {/* Servings */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Servings *</Text>
              <TextInput
                style={[
                  styles.resultInput, 
                  { 
                    borderColor: validationErrors.servings ? theme.danger : theme.border, 
                    color: theme.text, 
                    backgroundColor: theme.card 
                  }
                ]}
                value={generatedMeal.servings}
                onChangeText={(text) => setGeneratedMeal(prev => ({ ...prev, servings: text }))}
                placeholder="Enter number of servings"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
              {validationErrors.servings && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.servings}
                </Text>
              )}
            </View>

            {/* Nutrition Information */}
            {generatedMeal.macros && (generatedMeal.macros.calories > 0 || generatedMeal.macros.protein > 0) && (
              <View style={styles.macroContainer}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>
                  📊 Nutrition Information (per serving)
                </Text>
                <View style={styles.macroGrid}>
                  <View style={[styles.macroItem, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Calories</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round((generatedMeal.macros.calories || 0) / parseInt(generatedMeal.servings || '1'))}
                    </Text>
                  </View>
                  <View style={[styles.macroItem, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Protein</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round((generatedMeal.macros.protein || 0) / parseInt(generatedMeal.servings || '1'))}g
                    </Text>
                  </View>
                  <View style={[styles.macroItem, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Fat</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round((generatedMeal.macros.fat || 0) / parseInt(generatedMeal.servings || '1'))}g
                    </Text>
                  </View>
                  <View style={[styles.macroItem, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Carbs</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round((generatedMeal.macros.carbohydrates || 0) / parseInt(generatedMeal.servings || '1'))}g
                    </Text>
                  </View>
                </View>
                <View style={[styles.macroNote, { backgroundColor: theme.infoLight }]}>
                  <Text style={[styles.macroNoteText, { color: theme.info }]}>
                    ℹ️ Nutrition values are estimates based on ingredient data
                  </Text>
                </View>
              </View>
            )}

            {/* Ingredients */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Ingredients *</Text>
              {generatedMeal.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientRow}>
                  <TextInput
                    style={[
                      styles.ingredientInput, 
                      styles.ingredientName,
                      { 
                        borderColor: theme.border, 
                        color: theme.text, 
                        backgroundColor: theme.card 
                      }
                    ]}
                    placeholder="Ingredient name"
                    placeholderTextColor={theme.textSecondary}
                    value={ingredient.name}
                    onChangeText={(text) => updateIngredient(index, "name", text)}
                  />
                  <TextInput
                    style={[
                      styles.ingredientInput, 
                      styles.ingredientQuantity,
                      { 
                        borderColor: theme.border, 
                        color: theme.text, 
                        backgroundColor: theme.card 
                      }
                    ]}
                    placeholder="Qty"
                    placeholderTextColor={theme.textSecondary}
                    value={ingredient.quantity}
                    onChangeText={(text) => updateIngredient(index, "quantity", text)}
                  />
                  <TextInput
                    style={[
                      styles.ingredientInput, 
                      styles.ingredientUnit,
                      { 
                        borderColor: theme.border, 
                        color: theme.text, 
                        backgroundColor: theme.card 
                      }
                    ]}
                    placeholder="Unit"
                    placeholderTextColor={theme.textSecondary}
                    value={ingredient.unit}
                    onChangeText={(text) => updateIngredient(index, "unit", text)}
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeIngredient(index)}
                  >
                    <Text style={[styles.removeButtonText, { color: theme.danger }]}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {validationErrors.ingredients && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.ingredients}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.button, styles.addIngredientButton, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                onPress={addIngredient}
              >
                <Text style={[styles.addIngredientText, { color: theme.primary }]}>+ Add Ingredient</Text>
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Instructions *</Text>
              <TextInput
                style={[
                  styles.resultInput, 
                  styles.multilineInput,
                  { 
                    borderColor: validationErrors.instructions ? theme.danger : theme.border, 
                    color: theme.text, 
                    backgroundColor: theme.card,
                    height: 120
                  }
                ]}
                value={generatedMeal.instructions}
                onChangeText={(text) => setGeneratedMeal(prev => ({ ...prev, instructions: text }))}
                placeholder="Enter cooking instructions"
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={20000}
                textAlignVertical="top"
              />
              {validationErrors.instructions && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.instructions}
                </Text>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.button, 
                styles.saveButton, 
                { 
                  backgroundColor: saving ? theme.border : theme.success,
                  shadowColor: saving ? 'transparent' : theme.success
                }
              ]}
              onPress={handleSaveMeal}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>
                  💾 Save Meal
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Placeholder when no meal is generated */}
        {!generatedMeal.name && !loading && (
          <View style={styles.placeholderContainer}>
            <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
              Enter a meal prompt above and tap "Generate AI Meal" to create your personalized recipe!
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryBanner: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    marginTop: 40,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backIcon: {
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  formSection: {
    marginBottom: 20,
  },
  formCard: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 48,
  },
  dietaryBadge: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  dietaryText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    marginRight: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxMark: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  generateButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultContainer: {
    marginTop: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: "top",
  },
  ingredientRow: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "center",
  },
  ingredientInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginRight: 8,
  },
  ingredientName: {
    flex: 2,
  },
  ingredientQuantity: {
    flex: 1,
  },
  ingredientUnit: {
    width: 200,
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  addIngredientButton: {
    marginBottom: 15,
  },
  addIngredientText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  exampleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  placeholderText: {
    fontSize: 16,
    textAlign: "center",
  },
  
  // Macro Styles
  macroContainer: {
    marginTop: 16,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  macroItem: {
    width: '48%',
    minWidth: 120,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.8,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  macroNote: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  macroNoteText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // AI Usage Display Styles
  usageDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  usageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageText: {
    fontSize: 16,
    fontWeight: '500',
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AICreateMeal;
