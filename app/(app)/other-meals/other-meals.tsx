import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import Icon from "react-native-vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import BottomNav from "components/bottomNav";
import { supabase } from "utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dietaryFilterOptions, dietaryFilterOptionsEnhanced, cuisineFilterOptions, cuisineFilterOptionsEnhanced } from "../../../constants/dietaryOptions";
import { isSmallScreen, responsiveFontSizes } from "../../../utils/responsiveUtils";

const aiOptions = [
  { label: "All", value: "" },
  { label: "AI Generated", value: "ai" },
  { label: "Not AI Generated", value: "not_ai" },
];

// Enhanced AI options with icons and descriptions
const aiOptionsEnhanced = [
  { label: "All Sources", value: "", icon: "globe", description: "Show meals from all sources" },
  { label: "AI Generated", value: "ai", icon: "sparkles", description: "Meals created by artificial intelligence" },
  { label: "Manual", value: "not_ai", icon: "person", description: "User-created meals" },
];

const defaultFilters = [
  { type: "calories", greaterThan: "", lessThan: "" },
  { type: "fat", greaterThan: "", lessThan: "" },
  { type: "protein", greaterThan: "", lessThan: "" },
  { type: "carbohydrates", greaterThan: "", lessThan: "" },
];

const OtherMeals: React.FC = () => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const [filters, setFilters] = useState(defaultFilters);
  const [tempFilters, setTempFilters] = useState(defaultFilters);

  const [aiFilter, setAiFilter] = useState<string>("");
  const [dietaryRestrictionFilter, setDietaryRestrictionFilter] = useState<string>("");
  const [cuisineFilter, setCuisineFilter] = useState<string>("");

  const [tempAiFilter, setTempAiFilter] = useState<string>(aiFilter);
  const [tempDietaryRestrictionFilter, setTempDietaryRestrictionFilter] = useState<string>(dietaryRestrictionFilter);
  const [tempCuisineFilter, setTempCuisineFilter] = useState<string>(cuisineFilter);

  // Modal state for enhanced pickers
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [isFilterModalLoading, setIsFilterModalLoading] = useState(false);
  const [isFilterButtonLoading, setIsFilterButtonLoading] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [hasMoreMeals, setHasMoreMeals] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [filteredMealsReady, setFilteredMealsReady] = useState<boolean>(false);
  const MEALS_PER_PAGE = 20; // Load 20 meals at a time

  const { theme } = useTheme();
  const router = useRouter();

  const isFilterActive =
    aiFilter !== "" ||
    dietaryRestrictionFilter !== "" ||
    cuisineFilter !== "" ||
    filters.some(f => f.greaterThan !== "" || f.lessThan !== "");

  // Load saved filters on component mount
  useEffect(() => {
    // Defer to improve navigation speed
    const timer = setTimeout(() => {
      loadSavedFilters();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const loadSavedFilters = async () => {
    try {
      const savedFilters = await AsyncStorage.getItem('otherMealsFilters');
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        setAiFilter(parsedFilters.aiFilter || "");
        setDietaryRestrictionFilter(parsedFilters.dietaryRestrictionFilter || "");
        setCuisineFilter(parsedFilters.cuisineFilter || "");
        setFilters(parsedFilters.filters || defaultFilters);
      }
    } catch (error) {
      console.warn('Failed to load saved filters:', error);
    }
  };

  const saveFilters = async () => {
    try {
      const filtersToSave = {
        aiFilter,
        dietaryRestrictionFilter,
        cuisineFilter,
        filters,
      };
      await AsyncStorage.setItem('otherMealsFilters', JSON.stringify(filtersToSave));
    } catch (error) {
      console.warn('Failed to save filters:', error);
    }
  };

  // Fetch all public meals from Supabase with pagination
  const fetchMeals = useCallback(async (showLoading = true, loadMore = false) => {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      if (showLoading && !loadMore) {
        setLoading(true);
        setCurrentPage(0);
        setHasMoreMeals(true);
      } else if (loadMore) {
        setLoadingMore(true);
      }
      
      if (!loadMore) {
        setFilteredMealsReady(false);
      }
      
      setError(null);
      
      const pageToLoad = loadMore ? currentPage + 1 : 0;
      const offset = pageToLoad * MEALS_PER_PAGE;

      // 1. Fetch public meals with pagination
      let query = supabase
        .from("meals")
        .select("*")
        .eq("visibility", true)
        .order("id", { ascending: false }) // Order by newest first
        .range(offset, offset + MEALS_PER_PAGE - 1)
        .abortSignal(controller.signal);

      if (dietaryRestrictionFilter) query = query.eq("dietary_restrictions", dietaryRestrictionFilter);
      if (aiFilter === "ai") query = query.eq("created_by_ai", true);
      if (aiFilter === "not_ai") query = query.eq("created_by_ai", false);
      if (cuisineFilter) query = query.eq("cuisine", cuisineFilter);

      const { data: mealsData, error: mealsError } = await query;
      clearTimeout(timeoutId);
      
      if (mealsError) throw mealsError;

      const newMeals = mealsData || [];

      // 2. Fetch user profiles for the new meals
      const userIds = Array.from(new Set(newMeals.map(meal => meal.user_id)));
      let userIdToUsername: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id,username")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        (profilesData || []).forEach(profile => {
          userIdToUsername[profile.id] = profile.username;
        });
      }

      // 3. Fetch review counts for the new meals
      const mealIds = newMeals.map(meal => meal.id);
      let mealIdToReviewCount: Record<string, number> = {};
      if (mealIds.length > 0) {
        const { data: reviewCounts, error: reviewError } = await supabase
          .from("reviews")
          .select("meal_id")
          .in("meal_id", mealIds);

        if (reviewError) throw reviewError;

        // Count reviews per meal
        (reviewCounts || []).forEach(review => {
          mealIdToReviewCount[review.meal_id] = (mealIdToReviewCount[review.meal_id] || 0) + 1;
        });
      }

      // 4. Combine meals, usernames, and review counts
      const mealsWithUsernames = newMeals.map(meal => ({
        ...meal,
        userName: userIdToUsername[meal.user_id] || "Unknown",
        averageRating: 0,
        reviewCount: mealIdToReviewCount[meal.id] || 0,
      }));

      if (loadMore) {
        setMeals(prevMeals => [...prevMeals, ...mealsWithUsernames]);
        setCurrentPage(pageToLoad);
      } else {
        setMeals(mealsWithUsernames);
        setCurrentPage(0);
      }
      
      // Check if we have more meals to load
      setHasMoreMeals(newMeals.length === MEALS_PER_PAGE);
      setRetryCount(0);
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error fetching meals:", error);
      
      // Handle specific error types
      let errorMessage = "Failed to load meals. Please try again.";
      
      if (error && typeof error === 'object') {
        const errorObj = error as any;
        
        // AbortError from timeout
        if (errorObj.name === 'AbortError') {
          errorMessage = "Request timed out. Please check your internet connection and try again.";
        }
        // Network timeout errors
        else if (errorObj.message?.includes('timeout') || 
            errorObj.message?.includes('Network request timed out') ||
            errorObj.details?.includes('Network request timed out')) {
          errorMessage = "Request timed out. Please check your internet connection and try again.";
        }
        // Network connection errors
        else if (errorObj.message?.includes('network') || 
                 errorObj.message?.includes('fetch')) {
          errorMessage = "Network error. Please check your internet connection.";
        }
        // Supabase specific errors
        else if (errorObj.code) {
          errorMessage = `Database error: ${errorObj.message || 'Unknown error occurred'}`;
        }
      }
      
      setError(errorMessage);
      
      // Auto-retry for network timeouts (up to 2 times)
      if (retryCount < 2 && (errorMessage.includes('timeout') || errorMessage.includes('timed out'))) {
        console.log(`Auto-retrying due to timeout, attempt ${retryCount + 1}/2`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchMeals(showLoading, loadMore);
        }, 2000); // Wait 2 seconds before retry
        return;
      }
      
    } finally {
      if (showLoading && !loadMore) {
        setLoading(false);
      }
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [dietaryRestrictionFilter, aiFilter, cuisineFilter, currentPage, retryCount]);

  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: wait 1s, 2s, 4s, etc.
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
    
    setTimeout(() => {
      fetchMeals();
    }, delay);
  }, [retryCount, fetchMeals]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRetryCount(0);
    fetchMeals(false);
  }, [fetchMeals]);

  const loadMoreMeals = useCallback(() => {
    if (!loadingMore && hasMoreMeals && filteredMealsReady) {
      fetchMeals(false, true);
    }
  }, [loadingMore, hasMoreMeals, filteredMealsReady, fetchMeals]);

  useEffect(() => {
    // Reset pagination when filters change - defer for better performance
    const timer = setTimeout(() => {
      setCurrentPage(0);
      setHasMoreMeals(true);
      fetchMeals();
    }, 50);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietaryRestrictionFilter, aiFilter, cuisineFilter]);

  useEffect(() => {
    const filtered = meals.filter((meal) => {
      const passesFilters = filters.every((filter) => {
        const greaterThanValue = parseFloat(filter.greaterThan);
        const lessThanValue = parseFloat(filter.lessThan);

        if (filter.type in meal) {
          const mealValue = parseFloat(meal[filter.type as keyof Meal] as unknown as string);

          if (!isNaN(greaterThanValue) && mealValue <= greaterThanValue) {
            return false;
          }

          if (!isNaN(lessThanValue) && mealValue >= lessThanValue) {
            return false;
          }
        }

        return true;
      });

      const passesSearch =
        !searchQuery ||
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (meal.userName && meal.userName.toLowerCase().includes(searchQuery.toLowerCase()));

      return passesFilters && passesSearch;
    });

    setFilteredMeals(filtered);
    // Only set filteredMealsReady to true if we're not in initial loading state
    if (!loading || meals.length > 0) {
      setFilteredMealsReady(true);
    }
    
    // Auto-load more if we have few visible results and more data is available
    if (filtered.length < 10 && hasMoreMeals && !loadingMore && meals.length > 0) {
      setTimeout(() => loadMoreMeals(), 100); // Small delay to avoid rapid calls
    }
  }, [searchQuery, filters, meals, hasMoreMeals, loadingMore, loadMoreMeals, loading]);

  const onMealSelect = (meal: Meal) => {
    router.push(`/other-meals/${meal.id}/other-meals-info`);
  };

  const applyFilters = async () => {
    setIsFilterButtonLoading(true);
    
    try {
      // Animate modal close first for immediate feedback
      setIsFilterModalVisible(false);
      
      // Small delay for UX, then apply filters
      setTimeout(async () => {
        setFilters(tempFilters);
        setAiFilter(tempAiFilter);
        setDietaryRestrictionFilter(tempDietaryRestrictionFilter);
        setCuisineFilter(tempCuisineFilter);
        
        await saveFilters();
        setIsFilterButtonLoading(false);
      }, 100);
    } catch (error) {
      console.error('Error applying filters:', error);
      setIsFilterButtonLoading(false);
    }
  };

  const clearFilters = async () => {
    setIsFilterButtonLoading(true);
    
    try {
      // Clear temp filters immediately for visual feedback
      setTempFilters(defaultFilters);
      setTempAiFilter("");
      setTempDietaryRestrictionFilter("");
      setTempCuisineFilter("");
      
      // Small delay then clear actual filters and close modal
      setTimeout(async () => {
        setFilters(defaultFilters);
        setAiFilter("");
        setDietaryRestrictionFilter("");
        setCuisineFilter("");
        setSearchQuery("");
        setIsFilterModalVisible(false);
        
        try {
          await AsyncStorage.removeItem('otherMealsFilters');
        } catch (error) {
          console.warn('Failed to clear saved filters:', error);
        }
        
        setIsFilterButtonLoading(false);
      }, 100);
    } catch (error) {
      console.error('Error clearing filters:', error);
      setIsFilterButtonLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const openFilterModal = useCallback(() => {
    setIsFilterButtonLoading(true);
    setIsFilterModalLoading(true);
    
    // Pre-set temp filters immediately to avoid delay
    setTempAiFilter(aiFilter);
    setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
    setTempCuisineFilter(cuisineFilter);
    
    // Open modal immediately
    setIsFilterModalVisible(true);
    setIsFilterModalLoading(false);
    setIsFilterButtonLoading(false);
  }, [aiFilter, dietaryRestrictionFilter, cuisineFilter]);

  if (loading && meals.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.centerContent, { backgroundColor: theme.background, flex: 1 }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading meals...</Text>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRetry}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
              {retryCount > 0 && (
                <Text style={[styles.retryText, { color: theme.subtext }]}>
                  Retry attempt {retryCount}/3
                </Text>
              )}
            </View>
          )}
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && !loading && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="alert-circle" size={20} color={theme.danger} />
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !loading && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Ionicons name="time" size={16} color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      {/* Search and Filter Bar */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.subtext} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchBar, { color: theme.text }]}
            placeholder="Search meals, descriptions, or users..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { 
              backgroundColor: isFilterActive ? theme.primary : theme.card,
              borderColor: theme.border,
              opacity: (isFilterModalLoading || isFilterButtonLoading) ? 0.7 : 1,
              paddingVertical: isSmallScreen ? 8 : 10,
              paddingHorizontal: isSmallScreen ? 12 : 16
            }
          ]}
          onPress={openFilterModal}
          disabled={isFilterModalLoading || isFilterButtonLoading}
        >
          {(isFilterModalLoading || isFilterButtonLoading) ? (
            <ActivityIndicator size={isSmallScreen ? 16 : 20} color={isFilterActive ? theme.buttonText : theme.text} />
          ) : (
            <Ionicons 
              name="filter" 
              size={isSmallScreen ? 16 : 20}
              color={isFilterActive ? theme.buttonText : theme.text} 
            />
          )}
          <Text style={[
            styles.filterButtonText, 
            { 
              color: isFilterActive ? theme.buttonText : theme.text,
              fontSize: responsiveFontSizes.body
            }
          ]}>
            {(isFilterModalLoading || isFilterButtonLoading) ? "Loading..." : "Filter"}
          </Text>
          {isFilterActive && !isFilterModalLoading && !isFilterButtonLoading && (
            <View style={[styles.filterActiveDot, { backgroundColor: theme.warning }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Weekly Meals Button */}
      <View style={[styles.actionCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
        <TouchableOpacity
          style={[styles.weeklyMealsButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/competition/current-meals")}
        >
          <Ionicons name="trophy" size={20} color={theme.buttonText} />
          <Text style={[styles.weeklyMealsButtonText, { color: theme.buttonText }]}>
            Weekly Meals Competition
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.buttonText} />
        </TouchableOpacity>
      </View>

      {/* Meals Grid */}
      <FlatList
        data={filteredMeals}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        onEndReached={loadMoreMeals}
        onEndReachedThreshold={0.3}
        ListFooterComponent={() => (
          loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.loadingMoreText, { color: theme.subtext }]}>
                Loading more meals...
              </Text>
            </View>
          ) : !hasMoreMeals && filteredMeals.length > 0 ? (
            <View style={styles.endOfListContainer}>
              <Text style={[styles.endOfListText, { color: theme.subtext }]}>
                You&apos;ve reached the end of available meals!
              </Text>
            </View>
          ) : null
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.mealCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}
            onPress={() => onMealSelect(item)}
          >
            {/* Meal Image */}
            <View style={styles.imageContainer}>
              {item.picture && typeof item.picture === "string" ? (
                <Image 
                  source={{ 
                    uri: item.picture.startsWith('\\x') 
                      ? item.picture.slice(2).match(/.{2}/g)?.map((hex: string) => String.fromCharCode(parseInt(hex, 16))).join('') || ''
                      : item.picture 
                  }} 
                  style={styles.mealImage} 
                />
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: theme.border }]}>
                  <Ionicons name="image" size={32} color={theme.subtext} />
                </View>
              )}
              
              {/* AI Generated Tag */}
              {item.created_by_ai === true && (
                <View style={styles.aiTag}>
                  <Ionicons name="sparkles" size={10} color="#fff" />
                  <Text style={styles.aiTagText}>AI</Text>
                </View>
              )}
            </View>

            {/* Meal Info */}
            <View style={styles.mealInfo}>
              <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              
              <Text style={[styles.mealDescription, { color: theme.subtext }]} numberOfLines={3}>
                {item.description}
              </Text>

              {/* Nutrition Info */}
              <View style={styles.nutritionInfo}>
                <View style={styles.nutritionItem}>
                  <Ionicons name="flame-outline" size={12} color="#FF8C00" />
                  <Text style={[styles.nutritionValue, { color: theme.subtext }]}>
                    {item.calories || 0}
                  </Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Ionicons name="barbell-outline" size={12} color="#FF0000" />
                  <Text style={[styles.nutritionValue, { color: theme.subtext }]}>
                    {item.protein || 0}g
                  </Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Ionicons name="analytics-outline" size={12} color="#0066FF" />
                  <Text style={[styles.nutritionValue, { color: theme.subtext }]}>
                    {item.carbohydrates || 0}g
                  </Text>
                </View>
              </View>

              {/* User and Rating Row */}
              <View style={styles.bottomRow}>
                <View style={styles.userContainer}>
                  <Ionicons name="person-circle" size={14} color={theme.subtext} />
                  <Text style={[styles.userName, { color: theme.subtext }]} numberOfLines={1}>
                    {item.userName}
                  </Text>
                </View>
                
                <View style={styles.ratingContainer}>
                  <View style={styles.starsContainer}>
                    {[...Array(5)].map((_, index) => (
                      <Icon
                        key={index}
                        name="star"
                        size={10}
                        color={index < Math.floor(item.averageRating) ? "#FFD700" : "#CCCCCC"}
                      />
                    ))}
                  </View>
                  <Text style={[styles.reviewCount, { color: theme.subtext }]}>
                    ({item.reviewCount})
                  </Text>
                </View>
              </View>

              {/* Tags */}
              {(item.dietary_restrictions || item.cuisine) && (
                <View style={styles.tagsContainer}>
                  {item.dietary_restrictions && (
                    <View style={[styles.tag, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
                      <Text style={[styles.tagText, { color: theme.success }]}>
                        {item.dietary_restrictions}
                      </Text>
                    </View>
                  )}
                  {item.cuisine && (
                    <View style={[styles.tag, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                      <Text style={[styles.tagText, { color: theme.primary }]}>
                        {item.cuisine}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.mealsGrid}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      <Modal visible={isFilterModalVisible} transparent animationType="slide">
        {isFilterModalVisible && (
          <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
            <ScrollView 
              style={styles.modalScrollView} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <Ionicons name="filter" size={28} color={theme.primary} />
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Filter Meals</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: theme.background }]}
                  onPress={() => {
                    setTempAiFilter(aiFilter);
                    setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
                    setTempCuisineFilter(cuisineFilter);
                    setIsFilterModalVisible(false);
                  }}
                >
                  <Ionicons name="close" size={20} color={theme.subtext} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
                Refine your meal search with these filters
              </Text>

              {/* Quick Filter Chips */}
              <View style={styles.quickFiltersSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  <Ionicons name="flash" size={18} color={theme.primary} /> Quick Filters
                </Text>
                <View style={styles.quickFiltersContainer}>
                  <TouchableOpacity
                    style={[
                      styles.quickFilterChip,
                      { 
                        backgroundColor: tempAiFilter === "ai" ? theme.aiAccent : theme.background,
                        borderColor: tempAiFilter === "ai" ? theme.aiAccent : theme.border
                      }
                    ]}
                    onPress={() => setTempAiFilter(tempAiFilter === "ai" ? "" : "ai")}
                  >
                    <Ionicons 
                      name="sparkles" 
                      size={16} 
                      color={tempAiFilter === "ai" ? theme.buttonText : theme.text} 
                    />
                    <Text style={[
                      styles.quickFilterChipText, 
                      { color: tempAiFilter === "ai" ? theme.buttonText : theme.text }
                    ]}>
                      AI Generated
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.quickFilterChip,
                      { 
                        backgroundColor: tempAiFilter === "not_ai" ? theme.success : theme.background,
                        borderColor: tempAiFilter === "not_ai" ? theme.success : theme.border
                      }
                    ]}
                    onPress={() => setTempAiFilter(tempAiFilter === "not_ai" ? "" : "not_ai")}
                  >
                    <Ionicons 
                      name="person" 
                      size={16} 
                      color={tempAiFilter === "not_ai" ? theme.buttonText : theme.text} 
                    />
                    <Text style={[
                      styles.quickFilterChipText, 
                      { color: tempAiFilter === "not_ai" ? theme.buttonText : theme.text }
                    ]}>
                      Manual
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nutrition Filters */}
              <View style={[styles.filterSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  <Ionicons name="nutrition" size={18} color={theme.primary} /> Nutrition Ranges
                </Text>
                {tempFilters.map((filter, index) => (
                  <View key={index} style={styles.nutritionRow}>
                    <Text style={[styles.nutritionLabel, { color: theme.text }]}>
                      {filter.type.charAt(0).toUpperCase() + filter.type.slice(1)}
                    </Text>
                    <View style={styles.rangeInputs}>
                      <View style={[styles.inputContainer, { borderColor: theme.border }]}>
                        <Text style={[styles.inputLabel, { color: theme.subtext }]}>Min</Text>
                        <TextInput
                          style={[styles.rangeInput, { color: theme.text }]}
                          placeholder="0"
                          placeholderTextColor={theme.placeholder}
                          value={filter.greaterThan}
                          onChangeText={(text) => {
                            const updatedFilters = [...tempFilters];
                            updatedFilters[index].greaterThan = text;
                            setTempFilters(updatedFilters);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[styles.inputContainer, { borderColor: theme.border }]}>
                        <Text style={[styles.inputLabel, { color: theme.subtext }]}>Max</Text>
                        <TextInput
                          style={[styles.rangeInput, { color: theme.text }]}
                          placeholder="999"
                          placeholderTextColor={theme.placeholder}
                          value={filter.lessThan}
                          onChangeText={(text) => {
                            const updatedFilters = [...tempFilters];
                            updatedFilters[index].lessThan = text;
                            setTempFilters(updatedFilters);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Dietary Restrictions */}
              <View style={[styles.filterSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  <Ionicons name="leaf" size={18} color={theme.success} /> Dietary Restrictions
                </Text>
                <TouchableOpacity
                  style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => {
                    setIsFilterModalVisible(false);
                    setTimeout(() => setShowDietaryModal(true), 10);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerText, { 
                    color: tempDietaryRestrictionFilter ? theme.text : theme.placeholder 
                  }]}>
                    {tempDietaryRestrictionFilter || "All Dietary Restrictions"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.text} style={styles.pickerIcon} />
                </TouchableOpacity>
              </View>

              {/* Cuisine */}
              <View style={[styles.filterSection, { borderBottomWidth: 0 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  <Ionicons name="globe" size={18} color={theme.warning} /> Cuisine Type
                </Text>
                <TouchableOpacity
                  style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => {
                    setIsFilterModalVisible(false);
                    setTimeout(() => setShowCuisineModal(true), 10);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerText, { 
                    color: tempCuisineFilter ? theme.text : theme.placeholder 
                  }]}>
                    {tempCuisineFilter || "All Cuisines"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.text} style={styles.pickerIcon} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.clearModalButton, 
                  { 
                    backgroundColor: theme.button, 
                    borderColor: theme.border,
                    paddingVertical: isSmallScreen ? 10 : 12,
                    paddingHorizontal: isSmallScreen ? 12 : 16
                  }
                ]} 
                onPress={clearFilters}
              >
                <Ionicons name="refresh" size={18} color={theme.text} />
                <Text style={[
                  styles.modalButtonText, 
                  { 
                    color: theme.text,
                    fontSize: responsiveFontSizes.body
                  }
                ]}>Clear All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.applyButton, 
                  { 
                    backgroundColor: theme.primary,
                    paddingVertical: isSmallScreen ? 10 : 12,
                    paddingHorizontal: isSmallScreen ? 16 : 20
                  }
                ]} 
                onPress={applyFilters}
              >
                <Ionicons name="checkmark" size={18} color={theme.buttonText} />
                <Text style={[
                  styles.modalButtonText, 
                  { 
                    color: theme.buttonText,
                    fontSize: responsiveFontSizes.body
                  }
                ]}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        )}
      </Modal>

      {/* Dietary Restrictions Modal */}
      <Modal
        visible={showDietaryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDietaryModal(false);
          setTimeout(() => setIsFilterModalVisible(true), 10);
        }}
      >
        {showDietaryModal && (
          <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                <Ionicons name="leaf" size={20} color={theme.success} /> Select Dietary Restrictions
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowDietaryModal(false);
                  setTimeout(() => setIsFilterModalVisible(true), 10);
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.optionsList} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              keyboardShouldPersistTaps="handled"
            >
              {dietaryFilterOptionsEnhanced.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionItem,
                    { borderBottomColor: theme.border },
                    tempDietaryRestrictionFilter === option.value && { backgroundColor: theme.primary + '15' }
                  ]}
                  onPress={() => {
                    setTempDietaryRestrictionFilter(option.value);
                    setShowDietaryModal(false);
                    setTimeout(() => setIsFilterModalVisible(true), 10);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name={option.icon as any} size={24} color={theme.primary} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: theme.subtext }]}>{option.description}</Text>
                  </View>
                  {tempDietaryRestrictionFilter === option.value && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        )}
      </Modal>

      {/* Cuisine Modal */}
      <Modal
        visible={showCuisineModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCuisineModal(false);
          setTimeout(() => setIsFilterModalVisible(true), 10);
        }}
      >
        {showCuisineModal && (
          <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                <Ionicons name="globe" size={20} color={theme.warning} /> Select Cuisine Type
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowCuisineModal(false);
                  setTimeout(() => setIsFilterModalVisible(true), 10);
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.optionsList} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              keyboardShouldPersistTaps="handled"
            >
              {cuisineFilterOptionsEnhanced.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionItem,
                    { borderBottomColor: theme.border },
                    tempCuisineFilter === option.value && { backgroundColor: theme.primary + '15' }
                  ]}
                  onPress={() => {
                    setTempCuisineFilter(option.value);
                    setShowCuisineModal(false);
                    setTimeout(() => setIsFilterModalVisible(true), 10);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name={option.icon as any} size={24} color={theme.primary} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: theme.subtext }]}>{option.description}</Text>
                  </View>
                  {tempCuisineFilter === option.value && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        )}
      </Modal>

      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50, // Added more top padding
  },
  
  // Header Card Styles
  headerCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },

  // Search Bar Styles (matching meals.tsx)
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchBar: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Action Card Styles
  actionCard: {
    margin: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weeklyMealsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  weeklyMealsButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Meal Card Styles
  mealCard: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  mealImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  mealInfo: {
    padding: 10,
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  mealDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  
  // Nutrition Info Styles
  nutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nutritionValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Bottom Row Styles
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  userName: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewCount: {
    fontSize: 10,
    marginLeft: 3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '500',
  },

  // Grid Layout
  mealsGrid: {
    paddingBottom: 100,
    paddingHorizontal: 10,
  },

  // Loading States
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },

  // Error Handling
  errorContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 5,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryText: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  // Quick Filters Section
  quickFiltersSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  quickFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Filter Section Styles
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Nutrition Filter Styles
  nutritionRow: {
    marginBottom: 12,
  },
  nutritionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  rangeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  rangeInput: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontSize: 16,
    minHeight: 20,
  },

  // Picker Styles
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    paddingRight: 12,
  },
  pickerInput: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    paddingRight: 40,
    minHeight: 56,
  },
  pickerIcon: {
    marginLeft: 8,
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearModalButton: {
    borderWidth: 1,
  },
  applyButton: {
    // Primary button styling applied via backgroundColor
  },

  // Legacy styles (keeping for compatibility during migration)
  mealItem: {
    flex: 1,
    margin: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  mealPicture: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  mealPicturePlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mealPicturePlaceholderText: {
    fontSize: 12,
    color: "#888",
  },
  mealUser: {
    fontSize: 12,
  },
  modalContent: {
    width: "93%",
    height: "70%",
    padding: 16,
    borderRadius: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  filterLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    fontSize: 14,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  
  // Enhanced modal styles for picker modals
  optionsList: {
    flex: 1,
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
  // Pagination styles
  loadingMoreContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  endOfListContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default React.memo(OtherMeals);
