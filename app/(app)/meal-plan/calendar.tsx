import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from "react-native";
import { format, startOfWeek, addDays } from "date-fns";
import { useRouter } from "expo-router";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import BottomNav from "../../../components/bottomNav";
import { supabase } from "utils/supabase";
import { cachedDataService } from "utils/cachedDataService";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { 
  analyzeImageNutrition, 
  convertImageNutritionToMeal, 
  formatImageNutritionDisplay,
  validateImageNutritionData,
  ImageNutritionData 
} from '../../../utils/edamamImageUtils';
import { responsiveFontSizes } from '../../../utils/responsiveUtils';

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const MealPlanCalendar: React.FC = () => {
  const router = useRouter();
  const today = new Date();
  const { theme } = useTheme();
  const [daysToShow, setDaysToShow] = useState(7);
  const [meals, setMeals] = useState<{ [key: string]: Meal[] }>({});
  const [loadingDates, setLoadingDates] = useState<{ [key: string]: boolean }>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // Meal scanning states
  const [mealScanModalVisible, setMealScanModalVisible] = useState(false);
  const [scanningMeal, setScanningMeal] = useState(false);
  const [scannedMealData, setScannedMealData] = useState<ImageNutritionData | null>(null);
  const [selectedScanDate, setSelectedScanDate] = useState<string | null>(null);

  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 });

  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting user:", error.message);
        setError("Authentication error. Please log in again.");
        return null;
      }
      if (!data?.user) {
        setError("You are not logged in. Please log in to view your meals.");
        return null;
      }
      return data.user.id;
    } catch (error) {
      console.error("Unexpected error getting user:", error);
      setError("An unexpected error occurred. Please try again.");
      return null;
    }
  };

  const fetchMealsForDate = async (date: string, retryCount = 0): Promise<Meal[]> => {
    try {
      // Set loading state for this date
      setLoadingDates(prev => ({ ...prev, [date]: true }));
      
      const userId = await getCurrentUserId();
      if (!userId) {
        setLoadingDates(prev => ({ ...prev, [date]: false }));
        return [];
      }

      // Try cached data first for better performance
      try {
        const cachedMeals = await cachedDataService.getMealsForDate(userId, date, false);
        if (cachedMeals && cachedMeals.length > 0) {
          console.log(`📱 Using cached meals for ${date} (${cachedMeals.length} meals)`);
          setLoadingDates(prev => ({ ...prev, [date]: false }));
          setError(null);
          return cachedMeals;
        }
      } catch (cacheError) {
        console.log(`Cache miss for ${date}, fetching from Supabase`);
      }

      // Fetch both regular meal plan entries and macro meals
      const [mealPlanData, macroMealsData] = await Promise.all([
        // Fetch meal plan entries with full meal details
        supabase
          .from("meal_plan")
          .select(`
            *,
            meals (
              id,
              name,
              description,
              calories,
              protein,
              carbohydrates,
              fat,
              picture,
              instructions,
              recipeLink,
              created_at,
              created_by_ai,
              favorite,
              dietary_restrictions,
              servings,
              cuisine,
              visibility,
              created_by
            )
          `)
          .eq("user_id", userId)
          .eq("date", date),
        
        // Fetch macro meals for this date
        supabase
          .from("macro_meals")
          .select("*")
          .eq("user_id", userId)
          .gte("created_at", `${date}T00:00:00.000Z`)
          .lt("created_at", `${date}T23:59:59.999Z`)
      ]);

      // Handle errors from either query
      if (mealPlanData.error) {
        console.error(`Error fetching meal plan for date (${date}):`, mealPlanData.error.message);
        
        // Retry logic for network errors
        if (retryCount < 2 && (mealPlanData.error.message.includes('network') || mealPlanData.error.message.includes('timeout'))) {
          console.log(`Retrying fetch for ${date}, attempt ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return fetchMealsForDate(date, retryCount + 1);
        }
        
        setError(`Failed to load meals for ${date}. Please try refreshing.`);
        setLoadingDates(prev => ({ ...prev, [date]: false }));
        return [];
      }

      if (macroMealsData.error) {
        console.error(`Error fetching macro meals for date (${date}):`, macroMealsData.error.message);
        // Continue without macro meals if there's an error, don't fail completely
      }

      // Transform regular meal plan data
      const transformedMeals = mealPlanData.data?.map(entry => {
        // Handle profile picture - convert hex bytes to string if needed
        let pictureUri = entry.meals?.picture || null;
        if (pictureUri && typeof pictureUri === 'string' && pictureUri.startsWith('\\x')) {
          // Convert hex bytes back to string
          const hexString = pictureUri.slice(2); // Remove \x prefix
          const bytes = hexString.match(/.{1,2}/g) || [];
          pictureUri = bytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
        }

        return {
          id: entry.meals?.id || entry.meal_id,
          name: entry.meals?.name || "Unknown Meal",
          description: entry.meals?.description || "",
          calories: entry.meals?.calories || 0,
          protein: entry.meals?.protein || 0,
          carbohydrates: entry.meals?.carbohydrates || 0,
          fat: entry.meals?.fat || 0,
          picture: pictureUri,
          meal_type: entry.meal_type || "Other", // Get meal_type from meal_plan table
          userName: entry.meals?.created_by || "",
          visibility: entry.meals?.visibility || false,
          averageRating: 0, // Not stored in database
          reviewCount: 0, // Not stored in database
          meal_plan_id: entry.meal_plan_id,
          instructions: entry.meals?.instructions || "",
          recipeLink: entry.meals?.recipeLink || "",
          created_at: entry.meals?.created_at || "",
          created_by_ai: entry.meals?.created_by_ai || false,
          favorite: entry.meals?.favorite || false,
          dietary_restrictions: entry.meals?.dietary_restrictions || "",
          servings: entry.meals?.servings || 1,
          cuisine: entry.meals?.cuisine || "",
          isMacroMeal: false // Flag to identify regular meals
        };
      }) || [];

      // Transform macro meals data
      const transformedMacroMeals = macroMealsData.data?.map(macroMeal => ({
        id: `macro_${macroMeal.id}`, // Prefix to avoid ID conflicts
        name: macroMeal.meal_name || "Scanned Meal",
        description: "AI-analyzed meal nutrition",
        calories: macroMeal.calories || 0,
        protein: macroMeal.protein || 0,
        carbohydrates: macroMeal.carbs || 0, // Note: macro_meals uses 'carbs', Meal interface uses 'carbohydrates'
        fat: macroMeal.fat || 0,
        picture: null, // Macro meals don't have pictures
        meal_type: "Scanned", // Special type for scanned meals
        userName: "Edamam Food Scanner",
        visibility: false,
        averageRating: 0,
        reviewCount: 0,
        meal_plan_id: null,
        instructions: "",
        recipeLink: "",
        created_at: macroMeal.created_at || "",
        created_by_ai: true,
        favorite: false,
        dietary_restrictions: "",
        servings: 1,
        cuisine: "",
        isMacroMeal: true // Flag to identify macro meals
      })) || [];

      // Combine both types of meals
      const allMeals = [...transformedMeals, ...transformedMacroMeals];

      // Clear loading state for this date
      setLoadingDates(prev => ({ ...prev, [date]: false }));
      setError(null); // Clear any previous errors
      return allMeals;
    } catch (error) {
      console.error(`Unexpected error fetching meals for date (${date}):`, error);
      
      // Retry logic for unexpected errors
      if (retryCount < 2) {
        console.log(`Retrying fetch for ${date}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchMealsForDate(date, retryCount + 1);
      }
      
      setError(`An unexpected error occurred loading meals for ${date}.`);
      setLoadingDates(prev => ({ ...prev, [date]: false }));
      return [];
    }
  };

  const fetchMealsForWeek = async (weekStartDate: Date, isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }
      
      const userId = await getCurrentUserId();
      if (!userId) {
        setError("Authentication required. Please log in again.");
        return;
      }

      const newMeals: { [key: string]: Meal[] } = {};

      // Use cached data service for efficient fetching
      if (!isRefresh) {
        console.log('📱 Trying cached data for week...');
        try {
          // Fetch all days of the week using cached service
          const fetchPromises = [];
          for (let i = 0; i < daysToShow; i++) {
            const currentDate = addDays(weekStartDate, i);
            const currentDateString = format(currentDate, "yyyy-MM-dd");
            fetchPromises.push(
              cachedDataService.getMealsForDate(userId, currentDateString, false)
                .then(mealsForDate => {
                  newMeals[currentDateString] = mealsForDate;
                })
                .catch(error => {
                  console.log(`Cache miss for ${currentDateString}, will fetch from Supabase`);
                  return null; // Mark as needing fresh fetch
                })
            );
          }
          
          await Promise.all(fetchPromises);
          
          // Check if we have data for all days
          const datesWithData = Object.keys(newMeals).filter(date => newMeals[date].length > 0);
          if (datesWithData.length > 0) {
            console.log(`📱 Using cached data for ${datesWithData.length}/${daysToShow} days`);
            setMeals((prevMeals) => ({ ...prevMeals, ...newMeals }));
            
            // If we have partial cached data, fetch missing days in background
            const missingDates = [];
            for (let i = 0; i < daysToShow; i++) {
              const currentDate = addDays(weekStartDate, i);
              const currentDateString = format(currentDate, "yyyy-MM-dd");
              if (!newMeals[currentDateString] || newMeals[currentDateString].length === 0) {
                missingDates.push(currentDateString);
              }
            }
            
            if (missingDates.length > 0) {
              console.log(`🌐 Fetching missing dates from Supabase: ${missingDates.join(', ')}`);
              // Fetch missing dates in parallel
              const missingPromises = missingDates.map(date => 
                fetchMealsForDate(date).then(mealsForDate => {
                  setMeals(prevMeals => ({ 
                    ...prevMeals, 
                    [date]: mealsForDate 
                  }));
                })
              );
              await Promise.all(missingPromises);
            }
            
            setError(null);
            return; // Successfully used cached data
          }
        } catch (error) {
          console.log('Cache failed, falling back to fresh fetch');
        }
      }

      // Fresh fetch from Supabase for all days
      console.log('🌐 Fetching all data from Supabase...');
      const fetchPromises = [];
      for (let i = 0; i < daysToShow; i++) {
        const currentDate = addDays(weekStartDate, i);
        const currentDateString = format(currentDate, "yyyy-MM-dd");
        fetchPromises.push(
          fetchMealsForDate(currentDateString).then(mealsForDate => {
            newMeals[currentDateString] = mealsForDate;
          })
        );
      }
      
      await Promise.all(fetchPromises);
      setMeals((prevMeals) => ({ ...prevMeals, ...newMeals }));
      
      setError(null); // Clear any errors on successful fetch
    } catch (error) {
      console.error("Error fetching meals for week:", error);
      setError("Failed to load meal plan. Please try again.");
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchMealsForWeek(startOfCurrentWeek, true);
  };

  const deleteAllMealsForDate = async (date: string) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Error", "You are not logged in. Please log in to continue.");
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to delete all meals for ${format(new Date(date), "EEEE, MMMM d")}?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("meal_plan")
                  .delete()
                  .eq("user_id", userId)
                  .eq("date", date);

                if (error) {
                  console.error("Error deleting meals:", error.message);
                  Alert.alert("Error", `Failed to delete meals: ${error.message}`);
                  return;
                }

                Alert.alert("Success", `All meals for ${format(new Date(date), "EEEE, MMMM d")} have been deleted.`);
                
                // Invalidate meal plan cache to ensure fresh data on next load
                await cachedDataService.invalidateMealPlanCache(userId);
                
                setMeals((prevMeals) => {
                  const updatedMeals = { ...prevMeals };
                  updatedMeals[date] = []; // Set to empty array instead of deleting
                  return updatedMeals;
                });
              } catch (error) {
                console.error("Unexpected error deleting meals:", error);
                Alert.alert("Error", "An unexpected error occurred. Please try again.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error in deleteAllMealsForDate:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  useEffect(() => {
    // Defer heavy data loading to allow fast navigation
    const timer = setTimeout(() => {
      fetchMealsForWeek(startOfCurrentWeek);
    }, 100); // Small delay to allow UI to render first
    
    return () => clearTimeout(timer);
  }, []); // Only run on mount

  useEffect(() => {
    if (daysToShow > 7) {
      // Only fetch new data when extending beyond initial week
      const newWeekStart = addDays(startOfCurrentWeek, daysToShow - 7);
      fetchMealsForWeek(newWeekStart);
    }
  }, [daysToShow]);

  // Auto-scroll to today's date after initial loading is complete
  useEffect(() => {
    if (!isInitialLoading) {
      const todayIndex = Math.floor(
        (today.getTime() - startOfWeek(today, { weekStartsOn: 0 }).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const dayWidth = SCREEN_WIDTH * 0.95 + 16; // Width of the day container + marginRight
      
      // Add a small delay to ensure the ScrollView has rendered properly
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ 
          x: todayIndex * dayWidth, 
          animated: true 
        });
      }, 300);
    }
  }, [isInitialLoading]);

  const handleDatePress = (date: string) => {
    setSelectedDate(date);
    setIsModalVisible(true);
  };

  const calculateNutritionTotals = (mealsForDay: Meal[]) => {
    return mealsForDay.reduce(
      (totals, meal) => {
        return {
          calories: totals.calories + (meal.calories || 0),
          protein: totals.protein + (meal.protein || 0),
          carbs: totals.carbs + (meal.carbohydrates || 0),
          fat: totals.fat + (meal.fat || 0),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const handleAddMeal = () => {
    try {
      if (selectedDate) {
        router.push(`/(app)/meal-plan/${selectedDate}/add-to-date`);
        setIsModalVisible(false);
      } else {
        Alert.alert("Error", "No date selected. Please try again.");
      }
    } catch (error) {
      console.error("Error navigating to add meal:", error);
      Alert.alert("Error", "Failed to open add meal screen. Please try again.");
    }
  };

  const handleDeleteMeals = () => {
    try {
      if (selectedDate) {
        deleteAllMealsForDate(selectedDate);
        setIsModalVisible(false);
      } else {
        Alert.alert("Error", "No date selected. Please try again.");
      }
    } catch (error) {
      console.error("Error in handleDeleteMeals:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  const handleNextWeek = async () => {
    try {
      if (isRefreshing || isInitialLoading) {
        return; // Prevent multiple requests
      }
      
      const newDaysToShow = daysToShow + 7;
      setDaysToShow(newDaysToShow);
      
      // Fetch meals for the new week
      const newWeekStart = addDays(startOfCurrentWeek, daysToShow);
      const newMeals: { [key: string]: Meal[] } = {};
      
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(newWeekStart, i);
        const currentDateString = format(currentDate, "yyyy-MM-dd");
        if (!meals[currentDateString]) {
          const mealsForDate = await fetchMealsForDate(currentDateString);
          newMeals[currentDateString] = mealsForDate;
        }
      }
      
      if (Object.keys(newMeals).length > 0) {
        setMeals((prevMeals) => ({ ...prevMeals, ...newMeals }));
      }
    } catch (error) {
      console.error("Error loading next week:", error);
      setError("Failed to load next week. Please try again.");
    }
  };

  const handleMealSelect = (meal: Meal) => {
    try {
      // Skip navigation for macro meals since they don't have detailed views
      if (meal.isMacroMeal) {
        Alert.alert(
          "Scanned Meal", 
          `This is an AI-scanned meal.\n\nName: ${meal.name}\nCalories: ${meal.calories}\nProtein: ${meal.protein}g\nCarbs: ${meal.carbohydrates}g\nFat: ${meal.fat}g`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (!meal?.meal_plan_id) {
        Alert.alert("Error", "Invalid meal data. Please try refreshing the calendar.");
        return;
      }
      // Navigate to the meal plan details using the meal_plan_id
      router.push(`/(app)/meal-plan/${meal.meal_plan_id}/details`);
    } catch (error) {
      console.error("Error navigating to meal details:", error);
      Alert.alert("Error", "Failed to open meal details. Please try again.");
    }
  };

  // Meal scanning functionality
  const resizeAndEncode = async (uri: string): Promise<string> => {
    try {
      // Resize image to 512x512 max and compress to JPEG with 70% quality
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { 
          compress: 0.7, // 70% quality (60-80% range)
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );

      // Convert to base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Log image size for debugging
      console.log(`Resized meal image size: ${Math.round(base64.length * 0.75 / 1024)} KB`);
      
      return base64;
    } catch (error) {
      console.error('Error resizing meal image:', error);
      throw new Error('Failed to process image. Please try again.');
    }
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera permissions to scan meal nutrition.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const openCameraForMealScan = async (dateKey: string) => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    setSelectedScanDate(dateKey);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0, // Use highest quality from camera, we'll compress later
        base64: false, // Don't need base64 from camera since we'll process it
        exif: false,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        if (imageUri) {
          // Resize and compress the image before sending
          const processedBase64 = await resizeAndEncode(imageUri);
          await scanMealImage(processedBase64, dateKey);
        }
      }
    } catch (error) {
      console.error('Error opening camera for meal scan:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const scanMealImage = async (base64Image: string, dateKey: string) => {
    setScanningMeal(true);
    setSelectedScanDate(dateKey);
    
    try {
      console.log(`Analyzing meal image with Edamam Food Vision - Size: ${Math.round(base64Image.length * 0.75 / 1024)} KB`);

      // Use the new Edamam Food Vision API
      const result = await analyzeImageNutrition(base64Image, false);
      
      if ('error' in result) {
        throw new Error(result.details);
      }

      if (!validateImageNutritionData(result.nutrition)) {
        throw new Error('Could not detect valid nutrition information from this image. Please try a different image with clearer food items.');
      }

      // Save the meal to macro_meals table (for backward compatibility with existing nutrition screens)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error: insertError } = await supabase
        .from('macro_meals')
        .insert([{
          user_id: user.id,
          meal_name: result.nutrition.foodLabel,
          calories: result.nutrition.calories,
          protein: result.nutrition.protein,
          carbs: result.nutrition.carbohydrates,
          fat: result.nutrition.fat,
          created_at: `${dateKey}T12:00:00.000Z`, // Set to noon of the selected date
          ingredients: result.nutrition.ingredients.join(', '),
          diet_labels: result.nutrition.dietLabels.join(', '),
          health_labels: result.nutrition.healthLabels.join(', '),
          cautions: result.nutrition.cautions.join(', ')
        }]);

      if (insertError) {
        console.error('Error saving meal to database:', insertError);
        throw new Error('Failed to save meal data');
      }
        
      setScannedMealData(result.nutrition);
      setMealScanModalVisible(true);
      // Refresh the meals for this date to show the new macro meal
      await fetchMealsForDate(dateKey);
      console.log(`Successfully analyzed meal nutrition with Edamam:`, result.nutrition);
      
    } catch (error) {
      console.error('Error scanning meal image:', error);
      Alert.alert(
        'Meal Analysis Failed',
        error instanceof Error ? error.message : 'Failed to analyze meal nutrition. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setScanningMeal(false);
    }
  };

  const getMealButtonColor = (mealType: string) => {
    const mealTypeKey = mealType.toLowerCase() as keyof typeof theme.mealColors;
    return theme.mealColors[mealTypeKey] || theme.button;
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}>
          <View style={styles.errorContent}>
            <Text style={[styles.errorIcon, { color: theme.danger }]}>⚠️</Text>
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          </View>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.danger }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonTextPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Compact Header */}
      <View style={[styles.headerContainer, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, styles.groceryButton, { 
              backgroundColor: theme.successLight, 
              borderColor: theme.success 
            }]}
            onPress={() => router.push("./grocery-list")}
          >
            <Text style={[styles.headerButtonIcon, { color: theme.success }]}>🛒</Text>
            <Text style={[styles.headerButtonText, { color: theme.success }]}>Grocery List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.pantryButton, { 
              backgroundColor: theme.primaryLight, 
              borderColor: theme.primary 
            }]}
            onPress={() => router.push("/pantry/pantry")}
          >
            <Text style={[styles.headerButtonIcon, { color: theme.primary }]}>🏠</Text>
            <Text style={[styles.headerButtonText, { color: theme.primary }]}>Pantry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton, 
              styles.mealScanButton, 
              { 
                backgroundColor: scanningMeal ? theme.warningLight : theme.warningLight, 
                borderColor: scanningMeal ? theme.warning : theme.warning,
                opacity: scanningMeal ? 0.7 : 1
              }
            ]}
            onPress={() => {
              // Show enhanced modal to select date for meal scan
              Alert.alert(
                "📸 Edamam Food Scanner",
                "Scan a meal photo to automatically detect nutrition data using Edamam Food Vision!",
                [
                  { 
                    text: "📅 Today", 
                    onPress: () => openCameraForMealScan(format(today, 'yyyy-MM-dd')),
                    style: "default"
                  },
                  { 
                    text: "📋 Select Date", 
                    onPress: () => {
                      // For now, just use today - could enhance later with date picker
                      openCameraForMealScan(format(today, 'yyyy-MM-dd'));
                    },
                    style: "default"
                  },
                  { text: "Cancel", style: "cancel" }
                ]
              );
            }}
            disabled={scanningMeal}
          >
            <View style={styles.scanButtonWrapper}>
              {scanningMeal ? (
                <>
                  <ActivityIndicator size="small" color={theme.warning} />
                  <Text style={[styles.scanButtonProcessing, { color: theme.warning }]}>
                    Analyzing...
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.scanIconContainer, { backgroundColor: theme.warning }]}>
                    <Ionicons name="camera" size={18} color={theme.buttonText} />
                    <Ionicons name="sparkles" size={12} color={theme.buttonText} style={styles.aiSparkle} />
                  </View>
                  <View style={styles.scanButtonContent}>
                    <Text style={[styles.headerButtonText, { color: theme.warning, fontSize: 15 }]}>
                      Edamam Food Scanner
                    </Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Indicator for Initial Load */}
      {isInitialLoading ? (
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading your meal plan...</Text>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          style={styles.scrollView} 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          bouncesZoom={false}
          alwaysBounceVertical={false}
          alwaysBounceHorizontal={false}
          scrollEnabled={true}
          directionalLockEnabled={true}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          <View style={styles.container}>
          {Array.from({ length: daysToShow }).map((_, i) => {
            const currentDate = addDays(startOfCurrentWeek, i);
            const dateString = format(currentDate, "yyyy-MM-dd");
            const isToday = format(currentDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
            return (
              <View
                key={dateString}
                style={[
                  styles.dayContainer,
                  { 
                    backgroundColor: theme.card,
                    borderColor: isToday ? theme.primary : theme.border,
                    shadowColor: theme.shadow,
                  },
                  isToday && styles.todayContainer,
                ]}
              >
                {/* Enhanced Date Header */}
                <TouchableOpacity 
                  style={[styles.dateHeader, isToday && { backgroundColor: theme.primaryLight }]}
                  onPress={() => handleDatePress(dateString)}
                  accessibilityLabel={`Options for ${format(currentDate, "EEEE, MMMM d")}`}
                  accessibilityHint="Tap to add or delete meals for this date"
                >
                  <View style={styles.dateHeaderContent}>
                    <Text style={[styles.dayName, { color: isToday ? theme.primary : theme.text }]}>
                      {format(currentDate, "EEEE")}
                    </Text>
                    <Text style={[styles.dateNumber, { color: isToday ? theme.primary : theme.text }]}>
                      {format(currentDate, "MMM d")}
                    </Text>
                    {isToday && (
                      <View style={[styles.todayBadge, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.todayText, { color: theme.buttonTextPrimary }]}>Today</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.optionsHint, { color: theme.textSecondary }]}>
                    Tap for options
                  </Text>
                </TouchableOpacity>
                <View style={styles.mealsContainer}>
                  <ScrollView contentContainerStyle={styles.mealsScrollContent}>
                  {loadingDates[dateString] ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading meals...</Text>
                    </View>
                  ) : meals[dateString]?.length > 0 ? (
                    meals[dateString].map((meal, index) => (
                      <TouchableOpacity
                        key={`${meal.id}-${index}`}
                        style={[
                          styles.mealCard,
                          { 
                            backgroundColor: theme.mealColors[meal.meal_type.toLowerCase() as keyof typeof theme.mealColors] || theme.card,
                            borderColor: theme.mealAccent[meal.meal_type.toLowerCase() as keyof typeof theme.mealAccent] || theme.border,
                            shadowColor: theme.shadow,
                          },
                        ]}
                        onPress={() => handleMealSelect(meal)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mealCardContent}>
                          {/* Enhanced Meal Type Badge */}
                          <View style={[styles.mealTypeBadge, { 
                            backgroundColor: theme.mealAccent[meal.meal_type.toLowerCase() as keyof typeof theme.mealAccent] || theme.primary 
                          }]}>
                            <View style={styles.mealTypeBadgeContent}>
                              <Text style={[styles.mealTypeIcon, { color: theme.buttonTextPrimary }]}>
                                {meal.meal_type.includes('Breakfast') ? '🌅' : 
                                 meal.meal_type.includes('Lunch') ? '🌞' : 
                                 meal.meal_type.includes('Dinner') ? '🌙' : 
                                 meal.meal_type.includes('Snack') ? '🍎' : 
                                 meal.meal_type === 'Scanned' ? '📸' : '🍽️'}
                              </Text>
                              <Text style={[styles.mealTypeBadgeText, { color: theme.buttonTextPrimary }]}>
                                {meal.meal_type}
                              </Text>
                            </View>
                          </View>

                          {/* Edamam Food Scanner Badge for macro meals */}
                          {meal.isMacroMeal && (
                            <View style={[styles.aiScannerBadge, { backgroundColor: theme.aiAccent }]}>
                              <View style={styles.aiScannerBadgeContent}>
                                <Ionicons name="sparkles" size={10} color={theme.buttonTextPrimary} />
                                <Text style={[styles.aiScannerBadgeText, { color: theme.buttonTextPrimary }]}>
                                  AI SCAN
                                </Text>
                                <Ionicons name="camera" size={8} color={theme.buttonTextPrimary} />
                              </View>
                            </View>
                          )}

                          {/* Meal Image */}
                          <View style={styles.mealImageContainer}>
                            {meal.picture && typeof meal.picture === "string" && !meal.isMacroMeal ? (
                              <Image source={{ uri: meal.picture }} style={styles.mealImage} />
                            ) : (
                              <View style={[styles.mealImagePlaceholder, { backgroundColor: theme.divider }]}>
                                <Text style={[styles.mealImagePlaceholderText, { color: theme.textSecondary }]}>
                                  {meal.isMacroMeal ? '📸' : '🍽️'}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Meal Info */}
                          <View style={styles.mealInfo}>
                            <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>
                              {meal.name || "Unknown Meal"}
                            </Text>
                            <Text style={[styles.mealDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                              {meal.description || "No description available"}
                            </Text>
                            {/* Nutrition Preview */}
                            <View style={styles.nutritionPreview}>
                              <Text style={[styles.nutritionPreviewText, { color: theme.textSecondary }]}>
                                {meal.calories || 0} cal • {meal.protein || 0}g protein
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : meals[dateString] !== undefined ? (
                    <View style={styles.emptyMealsContainer}>
                      <Text style={[styles.emptyMealsIcon, { color: theme.textSecondary }]}>🍽️</Text>
                      <Text style={[styles.emptyMealsText, { color: theme.textSecondary }]}>
                        No meals planned
                      </Text>
                      <Text style={[styles.emptyMealsSubtext, { color: theme.textSecondary }]}>
                        Tap the date to add meals
                      </Text>
                    </View>
                  ) : null}
                  </ScrollView>
                </View>
                {/* Enhanced Nutrition Block */}
                <TouchableOpacity
                  style={[styles.nutritionBlock, { 
                    backgroundColor: theme.card,
                    shadowColor: theme.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                  }]}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: "/(app)/meal-plan/[date]/daynutrition", params: { date: dateString } })}
                >
                  {(() => {
                    const totals = meals[dateString]?.length > 0
                      ? calculateNutritionTotals(meals[dateString])
                      : { calories: 0, protein: 0, carbs: 0, fat: 0 };
                    const hasNutrition = totals.calories > 0;
                    return (
                      <>
                        <View style={styles.nutritionHeader}>
                          <Text style={[styles.nutritionTitle, { color: theme.text }]}>
                            Daily Nutrition
                          </Text>
                          <Text style={[styles.nutritionSubtitle, { color: theme.textSecondary }]}>
                            Tap for details
                          </Text>
                        </View>
                        <View style={styles.nutritionRow}>
                          <View style={[styles.nutritionColumn, styles.caloriesColumn]}>
                            <Text style={[styles.nutritionValue, { color: theme.primary, fontSize: responsiveFontSizes.h4, fontWeight: '800' }]}>
                              {totals.calories}
                            </Text>
                            <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>calories</Text>
                          </View>
                          <View style={styles.nutritionDivider} />
                          <View style={styles.macrosContainer}>
                            <View style={styles.macroItem}>
                              <Text style={[styles.macroValue, { color: theme.text }]}>{totals.protein}g</Text>
                              <Text style={[styles.macroLabel, { color: theme.protein }]}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                              <Text style={[styles.macroValue, { color: theme.text }]}>{totals.carbs}g</Text>
                              <Text style={[styles.macroLabel, { color: theme.carbs }]}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                              <Text style={[styles.macroValue, { color: theme.text }]}>{totals.fat}g</Text>
                              <Text style={[styles.macroLabel, { color: theme.fat }]}>Fat</Text>
                            </View>
                          </View>
                        </View>
                        {!hasNutrition && (
                          <View style={styles.emptyNutritionContainer}>
                            <Text style={[styles.emptyNutritionText, { color: theme.textSecondary }]}>
                              📊 Add meals to see nutrition data
                            </Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </TouchableOpacity>
              
              </View>
            );
          })}

          <TouchableOpacity
            style={[
              styles.nextWeekButton, 
              { backgroundColor: theme.primary },
              (isRefreshing || isInitialLoading) && { opacity: 0.6 }
            ]}
            onPress={handleNextWeek}
            disabled={isRefreshing || isInitialLoading}
            accessibilityLabel="Load next week"
            accessibilityHint="Tap to load more days in your meal plan"
          >
            {isRefreshing || isInitialLoading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Text style={[styles.nextWeekButtonText, { color: theme.buttonText }]}>
                Next Week
              </Text>
            )}
          </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Options for {selectedDate}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={handleAddMeal}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Add Meal to Calendar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.danger }]}
              onPress={handleDeleteMeals}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Delete All Meals for This Date
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: theme.border }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.modalCancelButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Enhanced Meal Scan Results Modal */}
      <Modal visible={mealScanModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.scanModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.scanModalHeader}>
              <View style={[styles.scanModalIcon, { backgroundColor: theme.success }]}>
                <Ionicons name="leaf" size={24} color={theme.buttonText} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                📸 Edamam Food Analysis Complete!
              </Text>
              <Text style={[styles.scanModalSubtitle, { color: theme.textSecondary }]}>
                Your meal has been analyzed and nutrition data saved
              </Text>
            </View>
            
            {scannedMealData && (
              <ScrollView style={styles.scanResultsContainer} showsVerticalScrollIndicator={false}>
                <View style={[styles.scanResultCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                  <View style={styles.scanResultHeader}>
                    <Ionicons name="restaurant" size={20} color={theme.primary} />
                    <Text style={[styles.scanResultItemName, { color: theme.text }]}>
                      {scannedMealData.foodLabel || 'Analyzed Meal'}
                    </Text>
                  </View>
                  
                  <View style={styles.nutritionGrid}>
                    <View style={[styles.nutritionGridItem, { backgroundColor: theme.warningLight }]}>
                      <Ionicons name="flame" size={16} color={theme.warning} />
                      <Text style={[styles.nutritionGridValue, { color: theme.warning }]}>
                        {scannedMealData.calories || 'N/A'}
                      </Text>
                      <Text style={[styles.nutritionGridLabel, { color: theme.warning }]}>calories</Text>
                    </View>
                    
                    <View style={[styles.nutritionGridItem, { backgroundColor: theme.protein + '20' }]}>
                      <Ionicons name="barbell" size={16} color={theme.protein} />
                      <Text style={[styles.nutritionGridValue, { color: theme.protein }]}>
                        {scannedMealData.protein || 'N/A'}g
                      </Text>
                      <Text style={[styles.nutritionGridLabel, { color: theme.protein }]}>protein</Text>
                    </View>
                    
                    <View style={[styles.nutritionGridItem, { backgroundColor: theme.carbs + '20' }]}>
                      <Ionicons name="leaf" size={16} color={theme.carbs} />
                      <Text style={[styles.nutritionGridValue, { color: theme.carbs }]}>
                        {scannedMealData.carbohydrates || 'N/A'}g
                      </Text>
                      <Text style={[styles.nutritionGridLabel, { color: theme.carbs }]}>carbs</Text>
                    </View>
                    
                    <View style={[styles.nutritionGridItem, { backgroundColor: theme.fat + '20' }]}>
                      <Ionicons name="water" size={16} color={theme.fat} />
                      <Text style={[styles.nutritionGridValue, { color: theme.fat }]}>
                        {scannedMealData.fat || 'N/A'}g
                      </Text>
                      <Text style={[styles.nutritionGridLabel, { color: theme.fat }]}>fat</Text>
                    </View>
                  </View>
                </View>
                
                <View style={[styles.scanSuccessMessage, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  <Text style={[styles.scanSuccessText, { color: theme.success }]}>
                    Meal data has been automatically added to your daily nutrition totals!
                  </Text>
                </View>
                
                {/* Edamam Attribution */}
                <View style={[styles.edamamAttribution, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                  <Text style={[styles.attributionText, { color: theme.textSecondary }]}>
                    Nutrition analysis powered by
                  </Text>
                  <View style={styles.edamamLogoContainer}>
                    <Text style={[styles.edamamLogoText, { color: theme.success }]}>EDAMAM</Text>
                  </View>
                </View>
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={[styles.scanModalButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                // The meal has already been saved to the macro_meals table by the edge function
                if (scannedMealData && selectedScanDate) {
                  console.log('Meal macros saved to database:', scannedMealData);
                }
                setMealScanModalVisible(false);
                setScannedMealData(null);
                setSelectedScanDate(null);
              }}
            >
              <Ionicons name="checkmark" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Got it!
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => {
                setMealScanModalVisible(false);
                setScannedMealData(null);
                setSelectedScanDate(null);
              }}
            >
              <Text style={[styles.modalCancelButtonText, { color: theme.text }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: { 
    flex: 1,
    paddingTop: 20, // Add top padding to avoid status bar overlap
    paddingBottom: 80, // Add bottom padding to avoid navigation overlap
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced from 12 to 8
    marginBottom: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, // Reduced from 16 to 12
    paddingHorizontal: 16, // Reduced from 20 to 16
    borderRadius: 16,
    borderWidth: 2,
    gap: 8,
  },
  headerButtonIcon: {
    fontSize: responsiveFontSizes.h4,
  },
  headerButtonText: {
    fontSize: responsiveFontSizes.button,
    fontWeight: '700',
  },
  initialLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
groceryButton: {
  padding: 12,
  borderRadius: 8,
},
groceryButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},
pantryButton: {
  padding: 12,
  borderRadius: 8,
},
pantryButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},
mealScanButton: {
  padding: 12,
  borderRadius: 8,
},
mealScanButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},
  nutritionBlock: {
    position: "absolute", // Make the block absolute
    bottom: 0, // Anchor it to the bottom of the container
    left: 0, // Align it to the left
    right: 0, // Align it to the right
    padding: 10, // Reduced from 12 to 10
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  nutritionRow: {
    flexDirection: "row", // Arrange columns horizontally
    justifyContent: "space-between", // Space out the columns evenly
  },
  nutritionColumn: {
    alignItems: "center", // Center the text in each column
    flex: 1, // Ensure equal width for each column
  },
  nutritionLabel: {
    fontSize: responsiveFontSizes.nutritionLabel,
    fontWeight: "bold",
    marginBottom: 4, // Add spacing between the label and the value
  },
  nutritionValue: {
    fontSize: responsiveFontSizes.nutritionValue,
    fontWeight: "bold",
  },
  nutritionTitle: {
    fontSize: responsiveFontSizes.h5,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8, // Add spacing between the title and the nutrition rows
  },
  nutritionHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  nutritionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  caloriesColumn: {
    flex: 2,
    alignItems: 'center',
    paddingRight: 16,
  },
  nutritionDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
    alignSelf: 'stretch',
  },
  macrosContainer: {
    flex: 3,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyNutritionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  emptyNutritionText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  createMealButtonContainer: { 
    alignItems: "center", 
    marginVertical: 16 
  },
  createMealButton: { 
    padding: 12, 
    borderRadius: 8 
  },
  createMealButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  mealContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
  },
  scrollView: { 
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.78, // Limit the height to prevent overlap
  },
  scrollViewContent: {
    alignItems: 'flex-start',
  },
  container: { 
    flexDirection: "row", 
    padding: 16,
    alignItems: 'flex-start', // Prevent vertical centering
  },
  mealPicture: {
    width: 150,
    height: 150,
    borderRadius: 8,
    resizeMode: "cover",
    marginLeft: 3,
  },
  mealPicturePlaceholder: {
    width: 150,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ccc",
    borderRadius: 8,
    marginLeft: 3,
  },
  mealPicturePlaceholderText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  dayContainer: {
    width: SCREEN_WIDTH * 0.95,
    marginRight: 16,
    padding: 0,
    borderWidth: 2,
    borderRadius: 20,
    height: SCREEN_HEIGHT * 0.725,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  todayContainer: {
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  dateHeader: {
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dateHeaderContent: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  todayText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionsHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  dateLabel: { 
    fontSize: 16, 
    fontWeight: "bold", 
    marginBottom: 8, 
    textAlign: "center" 
  },
  mealsContainer: { 
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  mealsScrollContent: {
    paddingBottom: 95, // Increased from 85 to 95 to account for larger container
  },
  mealCard: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  mealCardContent: {
    position: 'relative',
  },
  mealTypeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealTypeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealTypeIcon: {
    fontSize: 10,
  },
  mealTypeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  mealImageContainer: {
    height: 120,
    width: '100%',
  },
  mealImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mealImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealImagePlaceholderText: {
    fontSize: 32,
  },
  mealInfo: {
    padding: 12,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  nutritionPreview: {
    marginTop: 4,
  },
  nutritionPreviewText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyMealsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyMealsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMealsText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyMealsSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  mealButton: { 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#ccc",
  },
  mealText: { 
    fontSize: 14, 
    textAlign: "center" 
  },
  noMealText: { 
    fontSize: 12, 
    fontStyle: "italic", 
    textAlign: "center" 
  },
  nextWeekButton: {
    width: 150,
    marginLeft: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  nextWeekButtonText: { 
    fontSize: 16, 
    fontWeight: "bold", 
    textAlign: "center" 
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: { 
    fontSize: responsiveFontSizes.h3, 
    fontWeight: "800", 
    marginBottom: 8,
    textAlign: 'center',
  },
  modalButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: { 
    fontSize: 16, 
    fontWeight: "700" 
  },
  modalCancelButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    marginTop: 8,
  },
  modalCancelButtonText: { 
    fontSize: 16, 
    fontWeight: "600" 
  },
  mealTypeText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
    fontWeight: "bold",
  },
  mealTextContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 4,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  scanResultsContainer: {
    maxHeight: 300,
    marginVertical: 16,
  },
  scanResultsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  scanResultItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  scanResultItemName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  scanResultItemNutrition: {
    fontSize: 14,
    marginBottom: 2,
  },
  totalNutritionContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  totalNutritionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  totalNutritionText: {
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  aiScannerBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 1,
  },
  aiScannerBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  aiScannerBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  scanButtonContent: {
    alignItems: 'center',
  },
  usageText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.9,
  },
  scanButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  scanButtonProcessing: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scanIconContainer: {
    position: 'relative',
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSparkle: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  usageContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  limitReachedText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  // Enhanced scan modal styles
  scanModalContent: {
    width: "95%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    maxHeight: '85%',
  },
  scanModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scanModalIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scanModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  scanResultCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  scanResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  nutritionGridItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  nutritionGridValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  nutritionGridLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scanSuccessMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  scanSuccessText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  scanModalButton: {
    width: "100%",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  edamamAttribution: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    gap: 6,
  },
  attributionText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  edamamLogoContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  edamamLogoText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default React.memo(MealPlanCalendar);
