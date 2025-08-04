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
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const aiOptions = [
  { label: "All", value: "" },
  { label: "AI Generated", value: "ai" },
  { label: "Not AI Generated", value: "not_ai" },
];

const dietaryOptions = [
  { label: "All", value: "" },
  { label: "Vegetarian", value: "Vegetarian" },
  { label: "Vegan", value: "Vegan" },
  { label: "Gluten-Free", value: "Gluten-Free" },
  { label: "Keto", value: "Keto" },
  { label: "Paleo", value: "Paleo" },
];

const cuisineOptions = [
  { label: "All", value: "" },
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

  const { theme } = useTheme();
  const router = useRouter();

  const isFilterActive =
    aiFilter !== "" ||
    dietaryRestrictionFilter !== "" ||
    cuisineFilter !== "" ||
    filters.some(f => f.greaterThan !== "" || f.lessThan !== "");

  // Load saved filters on component mount
  useEffect(() => {
    loadSavedFilters();
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

  // Fetch all public meals from Supabase
  const fetchMeals = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // 1. Fetch all public meals
      let query = supabase
        .from("meals")
        .select("*")
        .eq("visibility", true);

      if (dietaryRestrictionFilter) query = query.eq("dietary_restrictions", dietaryRestrictionFilter);
      if (aiFilter === "ai") query = query.eq("created_by_ai", true);
      if (aiFilter === "not_ai") query = query.eq("created_by_ai", false);
      if (cuisineFilter) query = query.eq("cuisine", cuisineFilter);

      const { data: mealsData, error: mealsError } = await query;
      if (mealsError) throw mealsError;

      // 2. Fetch all user_profiles for those user_ids
      const userIds = Array.from(new Set((mealsData || []).map(meal => meal.user_id)));
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

      // 3. Fetch review counts for all meals
      const mealIds = (mealsData || []).map(meal => meal.id);
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
      const mealsWithUsernames = (mealsData || []).map(meal => ({
        ...meal,
        userName: userIdToUsername[meal.user_id] || "Unknown",
        averageRating: 0,
        reviewCount: mealIdToReviewCount[meal.id] || 0,
      }));

      // 5. Sort by review count (descending)
      mealsWithUsernames.sort((a, b) => b.reviewCount - a.reviewCount);

      setMeals(mealsWithUsernames);
      setFilteredMeals(mealsWithUsernames);
      setRetryCount(0);
    } catch (error) {
      console.error("Error fetching meals:", error);
      setError("Failed to load meals. Please check your connection and try again.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [dietaryRestrictionFilter, aiFilter, cuisineFilter]);

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

  useEffect(() => {
    fetchMeals();
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
  }, [searchQuery, filters, meals]);

  const onMealSelect = (meal: Meal) => {
    router.push(`/other-meals/${meal.id}/other-meals-info`);
  };

  const applyFilters = async () => {
    setFilters(tempFilters);
    setAiFilter(tempAiFilter);
    setDietaryRestrictionFilter(tempDietaryRestrictionFilter);
    setCuisineFilter(tempCuisineFilter);
    setIsFilterModalVisible(false);
    await saveFilters();
  };

  const clearFilters = async () => {
    setFilters(defaultFilters);
    setTempFilters(defaultFilters);
    setAiFilter("");
    setTempAiFilter("");
    setDietaryRestrictionFilter("");
    setTempDietaryRestrictionFilter("");
    setCuisineFilter("");
    setTempCuisineFilter("");
    setSearchQuery("");
    setIsFilterModalVisible(false);
    try {
      await AsyncStorage.removeItem('otherMealsFilters');
    } catch (error) {
      console.warn('Failed to clear saved filters:', error);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  if (loading) {
    return (
      <View style={[styles.centerContent, { backgroundColor: theme.background }]}>
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
              borderColor: theme.border
            }
          ]}
          onPress={() => {
            setTempAiFilter(aiFilter);
            setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
            setTempCuisineFilter(cuisineFilter);
            setIsFilterModalVisible(true);
          }}
        >
          <Ionicons 
            name="filter" 
            size={20} 
            color={isFilterActive ? theme.buttonText : theme.text} 
          />
          <Text style={[
            styles.filterButtonText, 
            { color: isFilterActive ? theme.buttonText : theme.text }
          ]}>
            Filter
          </Text>
          {isFilterActive && (
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
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
                <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <RNPickerSelect
                    onValueChange={setTempDietaryRestrictionFilter}
                    items={dietaryOptions}
                    value={tempDietaryRestrictionFilter}
                    style={{
                      inputIOS: [styles.pickerInput, { color: tempDietaryRestrictionFilter ? theme.text : theme.placeholder }],
                      inputAndroid: [styles.pickerInput, { color: tempDietaryRestrictionFilter ? theme.text : theme.placeholder }],
                      placeholder: { color: theme.placeholder },
                      iconContainer: styles.pickerIcon,
                    }}
                    useNativeAndroidPickerStyle={false}
                    Icon={() => <Ionicons name="chevron-down" size={20} color={theme.text} />}
                    placeholder={{ label: "All Dietary Restrictions", value: "" }}
                  />
                </View>
              </View>

              {/* Cuisine */}
              <View style={[styles.filterSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  <Ionicons name="globe" size={18} color={theme.warning} /> Cuisine Type
                </Text>
                <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <RNPickerSelect
                    onValueChange={setTempCuisineFilter}
                    items={cuisineOptions}
                    value={tempCuisineFilter}
                    style={{
                      inputIOS: [styles.pickerInput, { color: tempCuisineFilter ? theme.text : theme.placeholder }],
                      inputAndroid: [styles.pickerInput, { color: tempCuisineFilter ? theme.text : theme.placeholder }],
                      placeholder: { color: theme.placeholder },
                      iconContainer: styles.pickerIcon,
                    }}
                    useNativeAndroidPickerStyle={false}
                    Icon={() => <Ionicons name="chevron-down" size={20} color={theme.text} />}
                    placeholder={{ label: "All Cuisines", value: "" }}
                  />
                </View>
              </View>

              {/* AI Generation */}
              <View style={[styles.filterSection, { borderBottomWidth: 0 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  <Ionicons name="sparkles" size={18} color={theme.primary} /> AI Generation
                </Text>
                <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <RNPickerSelect
                    onValueChange={setTempAiFilter}
                    items={aiOptions}
                    value={tempAiFilter}
                    style={{
                      inputIOS: [styles.pickerInput, { color: tempAiFilter ? theme.text : theme.placeholder }],
                      inputAndroid: [styles.pickerInput, { color: tempAiFilter ? theme.text : theme.placeholder }],
                      placeholder: { color: theme.placeholder },
                      iconContainer: styles.pickerIcon,
                    }}
                    useNativeAndroidPickerStyle={false}
                    Icon={() => <Ionicons name="chevron-down" size={20} color={theme.text} />}
                    placeholder={{ label: "All Sources", value: "" }}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.clearModalButton, { backgroundColor: theme.button, borderColor: theme.border }]} 
                onPress={clearFilters}
              >
                <Ionicons name="refresh" size={18} color={theme.text} />
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Clear All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.applyButton, { backgroundColor: theme.primary }]} 
                onPress={applyFilters}
              >
                <Ionicons name="checkmark" size={18} color={theme.buttonText} />
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  },
  pickerInput: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    paddingRight: 40,
    minHeight: 56,
  },
  pickerIcon: {
    top: 18,
    right: 12,
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
});

export default OtherMeals;
