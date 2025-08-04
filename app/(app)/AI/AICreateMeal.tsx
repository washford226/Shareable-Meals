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
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import { useTheme } from "../../../context/ThemeContext";

const AICreateMeal = () => {
  const { theme } = useTheme();
  const router = useRouter();
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
  const [aiUsageCount, setAiUsageCount] = useState<number>(0);
  const [aiUsageLimit] = useState<number>(10);
  const [lastUsageDate, setLastUsageDate] = useState<string>("");

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Helper function to parse AI ingredients into array of objects
  function parseAIIngredients(ingredientText: string) {
    return ingredientText
      .split(/\r?\n|,/)
      .map(line => line.replace(/^\*\s*/, '').trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Try to match "quantity unit name"
        const match = line.match(/^([\d\/\.]+)?\s*([a-zA-Z]+)?\s*(.+)$/);
        if (match) {
          return {
            quantity: match[1] || "",
            unit: match[2] || "",
            name: match[3] || line,
          };
        }
        return { quantity: "", unit: "", name: line };
      });
  }

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
      
      // Handle daily AI usage reset
      const today = getTodayDate();
      const userLastUsageDate = data.ai_usage_last_date || "";
      const userUsageCount = data.ai_usage_count || 0;
      
      if (userLastUsageDate !== today) {
        // It's a new day, reset the usage count
        setAiUsageCount(0);
        setLastUsageDate(today);
        
        // Update the database to reset count for new day
        try {
          await supabase
            .from("user_profiles")
            .update({ 
              ai_usage_count: 0,
              ai_usage_last_date: today
            })
            .eq("id", userData.user.id);
        } catch (updateError) {
          console.warn("Failed to reset daily AI usage count:", updateError);
        }
      } else {
        // Same day, use existing count
        setAiUsageCount(userUsageCount);
        setLastUsageDate(userLastUsageDate);
      }
      
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
    } else if (generatedMeal.instructions.length > 2000) {
      errors.instructions = "Instructions must be 2000 characters or less";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [generatedMeal]);

  const validatePrompt = useCallback(() => {
    if (!prompt.trim()) {
      return "Please enter a meal prompt";
    }
    if (prompt.length > 200) {
      return "Prompt must be 200 characters or less";
    }
    return null;
  }, [prompt]);

  // Form field handlers
  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value);
    setError(null);
  }, []);

  const handleMealFieldChange = useCallback((field: string, value: string) => {
    setGeneratedMeal(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field when user types
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Also validate the field immediately to check if it's now valid
    const newErrors = { ...validationErrors };
    
    // Validate the specific field
    if (field === 'name') {
      if (value.trim() && value.length <= 100) {
        delete newErrors.name;
      }
    } else if (field === 'description') {
      if (value.trim() && value.length <= 500) {
        delete newErrors.description;
      }
    } else if (field === 'servings') {
      if (value && /^\d+$/.test(value) && parseInt(value) >= 1) {
        delete newErrors.servings;
      }
    } else if (field === 'instructions') {
      if (value.trim() && value.length <= 2000) {
        delete newErrors.instructions;
      }
    }
    
    setValidationErrors(newErrors);
  }, [validationErrors]);

  const isMealValid = useCallback(() => {
    return generatedMeal.name.trim() && 
           generatedMeal.name.length <= 100 &&
           generatedMeal.description.trim() && 
           generatedMeal.description.length <= 500 &&
           generatedMeal.instructions.trim() && 
           generatedMeal.instructions.length <= 2000 &&
           generatedMeal.servings &&
           /^\d+$/.test(generatedMeal.servings) &&
           parseInt(generatedMeal.servings) >= 1 &&
           generatedMeal.ingredients.length > 0;
  }, [generatedMeal]);

  // Enhanced save function with validation and error handling
  const handleSaveMeal = useCallback(async () => {
    if (!validateMeal()) {
      Alert.alert("Validation Error", "Please fix the form errors before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (!userId) {
        throw new Error("User not authenticated. Please log in.");
      }

      // Get user's username from user_profiles
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("username")
        .eq("user_id", userId)
        .single();

      const username = profileData?.username || "Unknown User";

      // 1. Insert the meal (without ingredients)
      const { data: mealData, error: mealError } = await supabase.from("meals").insert([
        {
          name: generatedMeal.name.trim(),
          description: generatedMeal.description.trim(),
          instructions: generatedMeal.instructions.trim(),
          servings: generatedMeal.servings ? parseInt(generatedMeal.servings) : 1,
          user_id: userId,
          visibility: true, // Default to public for AI-created meals
          dietary_restrictions: dietaryRestrictions,
          created_by_ai: true,
          created_by: username,
          AI_Macros: true, // AI-created meals always use AI for nutrition calculation
          calories: generatedMeal.macros?.calories || 0,
          protein: generatedMeal.macros?.protein || 0,
          fat: generatedMeal.macros?.fat || 0,
          carbohydrates: generatedMeal.macros?.carbohydrates || 0,
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
      // Filter out ingredients that don't have a name
      const validIngredients = generatedMeal.ingredients.filter(ingredient => 
        ingredient.name && ingredient.name.trim().length > 0
      );
      
      if (validIngredients.length > 0) {
        const ingredientRows = validIngredients.map(ingredient => ({
          meal_id: mealId,
          raw_name: ingredient.name.trim(),
          quantity: ingredient.quantity ? parseFloat(ingredient.quantity) : 1.0,
          unit: ingredient.unit || null,
        }));

        const { error: ingredientsError } = await supabase
          .from("meal_ingredients")
          .insert(ingredientRows);

        if (ingredientsError) {
          throw ingredientsError;
        }
      }

      Alert.alert("Success", "Meal added successfully!", [
        { text: "OK", onPress: () => router.push("/(app)/my-meals/meals") }
      ]);
    } catch (error: any) {
      console.error("Error adding meal:", error);
      const errorMessage = error.message || "Failed to add the meal to the database.";
      setError(errorMessage);
      Alert.alert("Save Error", errorMessage);
    } finally {
      setSaving(false);
    }
  }, [validateMeal, generatedMeal, userId, dietaryRestrictions, router]);

  // Enhanced ingredient management functions
  const addIngredient = useCallback(() => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", quantity: "", unit: "" }],
    }));
    if (validationErrors.ingredients) {
      setValidationErrors(prev => ({ ...prev, ingredients: '' }));
    }
  }, [validationErrors.ingredients]);

  const removeIngredient = useCallback((index: number) => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }, []);

  const updateIngredient = useCallback((index: number, field: "name" | "quantity" | "unit", value: string) => {
    setGeneratedMeal(prev => {
      const newIngredients = [...prev.ingredients];
      newIngredients[index][field] = value;
      return { ...prev, ingredients: newIngredients };
    });
  }, []);

  // Enhanced meal generation function
  const handleGenerateMeal = useCallback(async () => {
    const promptError = validatePrompt();
    if (promptError) {
      Alert.alert("Validation Error", promptError);
      return;
    }

    // Check AI usage limit
    if (aiUsageCount >= aiUsageLimit) {
      Alert.alert(
        "Daily Usage Limit Reached", 
        `You have reached your daily limit of ${aiUsageLimit} AI meal generations. Your usage will reset tomorrow.`,
        [{ text: "OK" }]
      );
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedMeal({
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

    try {
      const { data, error } = await supabase.functions.invoke("generate-AImeal", {
        body: {
          prompt: prompt.trim(),
          dietaryRestrictions,
          allergies,
          usePantry,
        },
      });

      if (error || !data) {
        throw new Error(error?.message || "Failed to generate meal.");
      }

      // Update AI usage count in database
      if (userId) {
        const newUsageCount = aiUsageCount + 1;
        const today = getTodayDate();
        
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ 
            ai_usage_count: newUsageCount,
            ai_usage_last_date: today
          })
          .eq("id", userId);

        if (updateError) {
          console.warn("Failed to update AI usage count:", updateError);
        } else {
          setAiUsageCount(newUsageCount);
          setLastUsageDate(today);
        }
      }

      setGeneratedMeal({
        name: data.name || "",
        description: data.description || "",
        servings: data.servings || "1",
        ingredients: (data.ingredients || []).map((ingredient: string[] | any) => {
          // Handle 2D array format: [name, quantity, unit]
          if (Array.isArray(ingredient) && ingredient.length >= 3) {
            return {
              name: ingredient[0] || "",
              quantity: ingredient[1] || "",
              unit: ingredient[2] || ""
            };
          }
          // Fallback for old object format (just in case)
          else if (typeof ingredient === 'object' && ingredient.name) {
            return {
              name: ingredient.name || "",
              quantity: ingredient.quantity || "",
              unit: ingredient.unit || ""
            };
          }
          // Fallback for unexpected format
          else {
            return {
              name: String(ingredient) || "",
              quantity: "",
              unit: ""
            };
          }
        }),
        instructions: data.instructions || "",
        macros: data.macros || {
          calories: 0,
          protein: 0,
          fat: 0,
          carbohydrates: 0
        }
      });
    } catch (error: any) {
      console.error("AI generation error:", error);
      const errorMessage = error.message || "Failed to generate meal. Please try again.";
      setError(errorMessage);
      Alert.alert("Generation Error", errorMessage);
    } finally {
      setLoading(false);
    }
  }, [prompt, validatePrompt, dietaryRestrictions, allergies, usePantry, aiUsageCount, aiUsageLimit, userId]);

  // Enhanced loading state with theme
  if (fetchingRestrictions) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Fetching dietary restrictions...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDietaryRestrictions(true)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
            <Text style={[styles.errorBannerText, { color: theme.danger }]}>{error}</Text>
            <TouchableOpacity 
              style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
              onPress={handleRetry}
            >
              <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Retry Banner */}
        {retryCount > 0 && !error && (
          <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.primary }]}>
            <Text style={[styles.retryBannerText, { color: theme.primary }]}>
              Retrying... (Attempt {retryCount})
            </Text>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push("/(app)/my-meals/meals")}
          disabled={loading || saving}
        >
          <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.text }]}>AI Meal Creator</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Generate personalized meals with AI
          </Text>
        </View>

        {/* AI Usage Display */}
        <View style={[styles.usageContainer, { 
          backgroundColor: theme.card, 
          borderColor: aiUsageCount >= aiUsageLimit ? theme.danger : theme.border,
          shadowColor: theme.shadow 
        }]}>
          <View style={styles.usageHeader}>
            <View style={[styles.aiIcon, { backgroundColor: theme.aiLight }]}>
              <Text style={[styles.aiIconText, { color: theme.aiAccent }]}>🤖</Text>
            </View>
            <View style={styles.usageInfo}>
              <Text style={[styles.usageText, { color: theme.text }]}>
                Daily AI Generations
              </Text>
              <Text style={[styles.usageCount, { color: theme.primary }]}>
                {aiUsageCount}/{aiUsageLimit}
              </Text>
            </View>
          </View>
          
          <View style={[styles.usageBar, { backgroundColor: theme.divider }]}>
            <View 
              style={[
                styles.usageProgress, 
                { 
                  backgroundColor: aiUsageCount >= aiUsageLimit ? theme.danger : 
                                   aiUsageCount >= aiUsageLimit * 0.8 ? theme.warning : 
                                   theme.success,
                  width: `${Math.min((aiUsageCount / aiUsageLimit) * 100, 100)}%`
                }
              ]} 
            />
          </View>
          
          <Text style={[styles.usageRemaining, { color: theme.textSecondary }]}>
            {aiUsageLimit - aiUsageCount} generations remaining today
          </Text>
          
          {aiUsageCount >= aiUsageLimit && (
            <View style={[styles.limitBadge, { backgroundColor: theme.dangerLight }]}>
              <Text style={[styles.limitText, { color: theme.danger }]}>
                🚫 Daily limit reached. Resets tomorrow
              </Text>
            </View>
          )}
          {aiUsageCount >= aiUsageLimit * 0.8 && aiUsageCount < aiUsageLimit && (
            <View style={[styles.warningBadge, { backgroundColor: theme.warningLight }]}>
              <Text style={[styles.warningText, { color: theme.warning }]}>
                ⚠️ {aiUsageLimit - aiUsageCount} generations left
              </Text>
            </View>
          )}
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
            style={[styles.input, { 
              borderColor: theme.border, 
              color: theme.text, 
              backgroundColor: theme.background,
              fontSize: 16,
            }]}
            placeholder="Describe your ideal meal (e.g., 'healthy vegan dinner with quinoa')"
            placeholderTextColor={theme.placeholder}
            value={prompt}
            onChangeText={handlePromptChange}
            maxLength={200}
            editable={!loading && !saving}
            multiline={true}
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Dietary Restrictions Display */}
        <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            🥗 Dietary Restrictions
          </Text>
          <View style={[styles.dietaryBadge, { backgroundColor: dietaryRestrictions ? theme.successLight : theme.divider }]}>
            <Text style={[styles.dietaryText, { 
              color: dietaryRestrictions ? theme.success : theme.textSecondary 
            }]}>
              {dietaryRestrictions || "No restrictions specified"}
            </Text>
          </View>
        </View>

        {/* Pantry Checkbox */}
        <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setUsePantry(!usePantry)}
            disabled={loading || saving}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                { 
                  backgroundColor: usePantry ? theme.primary : theme.background,
                  borderColor: usePantry ? theme.primary : theme.border,
                  shadowColor: usePantry ? theme.primary : 'transparent',
                },
              ]}
            >
              {usePantry && <Text style={[styles.checkboxMark, { color: theme.buttonTextPrimary }]}>✓</Text>}
            </View>
            <View style={styles.checkboxContent}>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                🏠 Use ingredients from my pantry
              </Text>
              <Text style={[styles.checkboxDescription, { color: theme.textSecondary }]}>
                AI will prioritize ingredients you already have
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[
            styles.generateButton, 
            { 
              backgroundColor: loading || saving || !prompt.trim() || aiUsageCount >= aiUsageLimit 
                ? theme.border 
                : theme.primary,
              shadowColor: loading || saving || !prompt.trim() || aiUsageCount >= aiUsageLimit 
                ? 'transparent' 
                : theme.primary,
            }
          ]}
          onPress={handleGenerateMeal}
          disabled={loading || saving || !prompt.trim() || aiUsageCount >= aiUsageLimit}
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
                  {aiUsageCount >= aiUsageLimit ? "🚫" : "✨"}
                </Text>
                <Text style={[styles.generateButtonText, { color: theme.buttonTextPrimary }]}>
                  {aiUsageCount >= aiUsageLimit ? "Daily Limit Reached" : "Generate AI Meal"}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Generated Meal Results */}
        {generatedMeal.name ? (
          <View style={styles.resultContainer}>
            <Text style={[styles.resultTitle, { color: theme.text }]}>Generated Meal</Text>
            
            {/* Meal Name Section */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Meal Name *</Text>
              <Text style={[styles.characterCount, { color: theme.subtext }]}>
                {generatedMeal.name.length}/100
              </Text>
              <TextInput
                style={[
                  styles.resultInput, 
                  styles.multilineInput,
                  { 
                    borderColor: validationErrors.name ? theme.danger : theme.border, 
                    color: theme.text,
                    backgroundColor: theme.card
                  }
                ]}
                value={generatedMeal.name}
                onChangeText={(text) => handleMealFieldChange('name', text)}
                placeholder="Meal Name"
                placeholderTextColor={theme.subtext}
                multiline={true}
                maxLength={100}
                editable={!saving}
              />
              {validationErrors.name && (
                <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.name}</Text>
              )}
            </View>

            {/* Description Section */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Description *</Text>
              <Text style={[styles.characterCount, { color: theme.subtext }]}>
                {generatedMeal.description.length}/500
              </Text>
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
                onChangeText={(text) => handleMealFieldChange('description', text)}
                placeholder="Description"
                placeholderTextColor={theme.subtext}
                multiline={true}
                maxLength={500}
                editable={!saving}
              />
              {validationErrors.description && (
                <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.description}</Text>
              )}
            </View>

            {/* Servings Section */}
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
                onChangeText={(text) => handleMealFieldChange('servings', text)}
                placeholder="Servings"
                placeholderTextColor={theme.subtext}
                keyboardType="numeric"
                editable={!saving}
              />
              {validationErrors.servings && (
                <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.servings}</Text>
              )}
            </View>

            {/* Ingredients Section */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Ingredients *</Text>
              {generatedMeal.ingredients.map((ingredient, idx) => (
                <View key={idx} style={styles.ingredientRow}>
                  <TextInput
                    style={[styles.ingredientInput, styles.ingredientName, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                    placeholder="Name"
                    placeholderTextColor={theme.subtext}
                    value={ingredient.name}
                    onChangeText={text => updateIngredient(idx, "name", text)}
                    editable={!saving}
                  />
                  <TextInput
                    style={[styles.ingredientInput, styles.ingredientQuantity, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                    placeholder="Qty"
                    placeholderTextColor={theme.subtext}
                    value={ingredient.quantity}
                    onChangeText={text => updateIngredient(idx, "quantity", text)}
                    keyboardType="numeric"
                    editable={!saving}
                  />
                  <TextInput
                    style={[styles.ingredientInput, styles.ingredientUnit, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                    placeholder="Unit"
                    placeholderTextColor={theme.subtext}
                    value={ingredient.unit}
                    onChangeText={text => updateIngredient(idx, "unit", text)}
                    editable={!saving}
                  />
                  <TouchableOpacity 
                    onPress={() => removeIngredient(idx)}
                    style={styles.removeButton}
                    disabled={saving}
                  >
                    <Text style={[styles.removeButtonText, { color: theme.danger }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity 
                onPress={addIngredient} 
                style={[styles.addIngredientButton, { opacity: saving ? 0.6 : 1 }]}
                disabled={saving}
              >
                <Text style={[styles.addIngredientText, { color: theme.primary }]}>+ Add Ingredient</Text>
              </TouchableOpacity>
              {validationErrors.ingredients && (
                <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.ingredients}</Text>
              )}
            </View>

            {/* Instructions Section */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Instructions *</Text>
              <Text style={[styles.characterCount, { color: theme.subtext }]}>
                {generatedMeal.instructions.length}/2000
              </Text>
              <TextInput
                style={[
                  styles.resultInput, 
                  styles.multilineInput,
                  { 
                    borderColor: validationErrors.instructions ? theme.danger : theme.border, 
                    color: theme.text,
                    backgroundColor: theme.card
                  }
                ]}
                value={generatedMeal.instructions}
                onChangeText={(text) => handleMealFieldChange('instructions', text)}
                placeholder="Instructions"
                placeholderTextColor={theme.subtext}
                multiline={true}
                maxLength={2000}
                editable={!saving}
              />
              {validationErrors.instructions && (
                <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.instructions}</Text>
              )}
            </View>

            {/* Macros Section */}
            <View style={styles.formSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Nutritional Information</Text>
              <View style={styles.macroContainer}>
                <View style={styles.macroGrid}>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroLabel, { color: theme.text }]}>Calories</Text>
                    <Text style={[styles.macroValue, { color: theme.primary }]}>
                      {generatedMeal.macros?.calories || 0}
                    </Text>
                  </View>
                  
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroLabel, { color: theme.text }]}>Protein</Text>
                    <Text style={[styles.macroValue, { color: theme.primary }]}>
                      {generatedMeal.macros?.protein || 0}g
                    </Text>
                  </View>
                  
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroLabel, { color: theme.text }]}>Fat</Text>
                    <Text style={[styles.macroValue, { color: theme.primary }]}>
                      {generatedMeal.macros?.fat || 0}g
                    </Text>
                  </View>
                  
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroLabel, { color: theme.text }]}>Carbs</Text>
                    <Text style={[styles.macroValue, { color: theme.primary }]}>
                      {generatedMeal.macros?.carbohydrates || 0}g
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.macroNote, { backgroundColor: theme.successLight }]}>
                  <Text style={[styles.macroNoteText, { color: theme.success }]}>
                    🤖 AI-calculated nutrition per serving
                  </Text>
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { 
                  backgroundColor: isMealValid() && !saving ? theme.primary : theme.border,
                  opacity: saving ? 0.6 : 1
                }
              ]}
              onPress={handleSaveMeal}
              disabled={!isMealValid() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Meal</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          !loading && (
            <View style={styles.placeholderContainer}>
              <Text style={[styles.placeholderText, { color: theme.subtext }]}>
                Your meal will appear here...
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
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
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
    flexDirection: 'row',
    alignItems: 'center',
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
  usageContainer: {
    padding: 20,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  aiIconText: {
    fontSize: 24,
  },
  usageInfo: {
    flex: 1,
  },
  usageText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  usageCount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  usageBar: {
    height: 12,
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  usageProgress: {
    height: '100%',
    borderRadius: 6,
  },
  usageRemaining: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  limitBadge: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  limitText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningBadge: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
    flex: 1,
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
});

export default AICreateMeal;
