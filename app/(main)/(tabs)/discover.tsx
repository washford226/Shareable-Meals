import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
  Dimensions,
  TextInput,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useRevenueCat } from '../../../context/RevenueCatContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { dietaryFilterOptions, cuisineFilterOptions, aiGenerationFilterOptions } from '../../../constants/dietaryOptions';
import { MEAL_TYPE_OPTIONS } from '../../../constants/filterOptions';
import { supabase } from '../../../utils/supabase';
import { createDynamicStyles, createMealStyles, getMealTypeColor, addTransparency } from '../../../utils/styleHelpers';
import { AdBanner } from '../../../components/AdBanner';
import { getResponsiveFontSize } from '../../../utils/responsiveUtils';

// Types for our data
interface Meal {
  id: string;
  name: string;
  description?: string;
  meal_picture_url?: string;
  author: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  cook_time?: string;
  meal_type?: string;
  cuisine?: string;
  dietary_restrictions?: string;
  created_at: string;
  like_count?: number;
  user_has_liked?: boolean;
  created_by_ai?: boolean;
  edamam_macros?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DiscoverPage() {
  const { theme } = useTheme();
  const { isPremium } = useRevenueCat();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  
  // Create dynamic styles using theme colors
  const dynamicStyles = createDynamicStyles(theme);
  const mealStyles = createMealStyles({
    ...theme,
    mealColors: theme.mealColors || {},
    mealAccent: theme.mealAccent || {},
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [featuredMeals, setFeaturedMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState({
    sortBy: 'newest' as 'newest' | 'most_liked' | 'popular',
    cookTimeFilter: [] as string[],
    calorieRange: [] as string[],
    proteinRange: [] as string[],
    carbRange: [] as string[],
    fatRange: [] as string[],
    mealTypes: [] as string[],
    cuisines: [] as string[],
    dietaryRestrictions: [] as string[],
    aiGenerated: [] as string[],
  });

  // Calculate tab bar height for proper content padding
  const tabBarHeight = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10) + (Platform.OS === 'ios' ? 65 : 60);

  // Helper function to toggle values in filter arrays
  const toggleArrayValue = (array: string[], value: string): string[] => {
    return array.includes(value)
      ? array.filter(item => item !== value)
      : [...array, value];
  };

  // Helper function to toggle array values in selectedFilters
  const toggleFilterArrayValue = (filterKey: keyof typeof selectedFilters, value: string) => {
    setSelectedFilters(prev => {
      const currentArray = prev[filterKey] as string[];
      const newArray = currentArray.includes(value) 
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [filterKey]: newArray };
    });
  };

  // Search and filter logic
  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...featuredMeals];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(meal =>
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply calorie range filter
    if (selectedFilters.calorieRange.length > 0) {
      filtered = filtered.filter(meal => {
        if (!meal.calories) return false;
        return selectedFilters.calorieRange.some(range => {
          switch (range) {
            case 'low': return meal.calories! < 400;
            case 'medium': return meal.calories! >= 400 && meal.calories! <= 700;
            case 'high': return meal.calories! > 700;
            default: return true;
          }
        });
      });
    }

    // Apply protein range filter
    if (selectedFilters.proteinRange.length > 0) {
      filtered = filtered.filter(meal => {
        if (!meal.protein) return false;
        return selectedFilters.proteinRange.some(range => {
          switch (range) {
            case 'low': return meal.protein! < 15;
            case 'medium': return meal.protein! >= 15 && meal.protein! <= 30;
            case 'high': return meal.protein! > 30;
            default: return true;
          }
        });
      });
    }

    // Apply carbohydrate range filter
    if (selectedFilters.carbRange.length > 0) {
      filtered = filtered.filter(meal => {
        if (!meal.carbohydrates) return false;
        return selectedFilters.carbRange.some(range => {
          switch (range) {
            case 'low': return meal.carbohydrates! < 30;
            case 'medium': return meal.carbohydrates! >= 30 && meal.carbohydrates! <= 60;
            case 'high': return meal.carbohydrates! > 60;
            default: return true;
          }
        });
      });
    }

    // Apply fat range filter
    if (selectedFilters.fatRange.length > 0) {
      filtered = filtered.filter(meal => {
        if (!meal.fat) return false;
        return selectedFilters.fatRange.some(range => {
          switch (range) {
            case 'low': return meal.fat! < 10;
            case 'medium': return meal.fat! >= 10 && meal.fat! <= 20;
            case 'high': return meal.fat! > 20;
            default: return true;
          }
        });
      });
    }

    // Apply meal type filter
    if (selectedFilters.mealTypes.length > 0) {
      filtered = filtered.filter(meal => 
        meal.meal_type && selectedFilters.mealTypes.includes(meal.meal_type)
      );
    }

    // Apply cuisine filter
    if (selectedFilters.cuisines.length > 0) {
      filtered = filtered.filter(meal => 
        selectedFilters.cuisines.some(cuisine => {
          // Check both the cuisine field and description
          const cuisineMatch = meal.cuisine?.toLowerCase().includes(cuisine.toLowerCase());
          const descriptionMatch = meal.description?.toLowerCase().includes(cuisine.toLowerCase());
          return cuisineMatch || descriptionMatch;
        })
      );
    }

    // Apply dietary restrictions filter
    if (selectedFilters.dietaryRestrictions.length > 0) {
      filtered = filtered.filter(meal => 
        selectedFilters.dietaryRestrictions.some(restriction => {
          // Check both the dietary_restrictions field and description
          const restrictionMatch = meal.dietary_restrictions?.toLowerCase().includes(restriction.toLowerCase());
          const descriptionMatch = meal.description?.toLowerCase().includes(restriction.toLowerCase());
          return restrictionMatch || descriptionMatch;
        })
      );
    }

    // Apply AI generated filter
    if (selectedFilters.aiGenerated.length > 0) {
      filtered = filtered.filter(meal => {
        if (selectedFilters.aiGenerated.includes('ai') && meal.created_by_ai) {
          return true;
        }
        if (selectedFilters.aiGenerated.includes('human') && !meal.created_by_ai) {
          return true;
        }
        return false;
      });
    }

    // Apply cook time filter
    if (selectedFilters.cookTimeFilter.length > 0) {
      filtered = filtered.filter(meal => {
        if (!meal.cook_time) return false;
        const cookTimeMinutes = parseInt(meal.cook_time.split(' ')[0]) || 0;
        return selectedFilters.cookTimeFilter.some(timeRange => {
          switch (timeRange) {
            case 'quick': return cookTimeMinutes <= 30;
            case 'medium': return cookTimeMinutes > 30 && cookTimeMinutes <= 60;
            case 'long': return cookTimeMinutes > 60;
            default: return true;
          }
        });
      });
    }

    // Apply sorting (client-side for filtered results)
    filtered.sort((a, b) => {
      switch (selectedFilters.sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'most_liked':
          return (b.like_count || 0) - (a.like_count || 0);
        case 'popular':
          // Sort by like count for popular (you could enhance this with recent likes)
          return (b.like_count || 0) - (a.like_count || 0);
        default:
          return 0;
      }
    });

    setFilteredMeals(filtered);
  }, [featuredMeals, searchQuery, selectedFilters]);

  // Function to fetch popular meals recently (for when you implement the separate likes table)
  const fetchPopularMealsRecently = async () => {
    try {
      // This will be used when you implement the separate meal_likes table
      // const { data, error } = await supabase.rpc('get_popular_meals_recently', { days_back: 30 });
      // For now, just return regular most liked meals
      return null;
    } catch (error) {
      console.error('Error fetching popular meals:', error);
      return null;
    }
  };

  // Function to toggle like on a meal
  const toggleLike = async (mealId: string, currentlyLiked: boolean) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to like meals');
      return;
    }

    // Optimistically update the UI immediately
    const updateMealLike = (meals: Meal[]) => 
      meals.map(meal => 
        meal.id === mealId 
          ? {
              ...meal,
              user_has_liked: !currentlyLiked,
              like_count: currentlyLiked 
                ? Math.max(0, (meal.like_count || 0) - 1)
                : (meal.like_count || 0) + 1
            }
          : meal
      );

    // Update both featured and filtered meals immediately
    setFeaturedMeals(prev => updateMealLike(prev));
    setFilteredMeals(prev => updateMealLike(prev));

    try {
      if (currentlyLiked) {
        // Remove like
        const { error } = await supabase
          .from('meal_likes')
          .delete()
          .eq('meal_id', parseInt(mealId))
          .eq('user_id', currentUser);

        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('meal_likes')
          .insert([
            {
              meal_id: parseInt(mealId),
              user_id: currentUser,
            }
          ]);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      
      // Revert the optimistic update on error
      const revertMealLike = (meals: Meal[]) => 
        meals.map(meal => 
          meal.id === mealId 
            ? {
                ...meal,
                user_has_liked: currentlyLiked,
                like_count: currentlyLiked 
                  ? (meal.like_count || 0) + 1
                  : Math.max(0, (meal.like_count || 0) - 1)
              }
            : meal
        );

      setFeaturedMeals(prev => revertMealLike(prev));
      setFilteredMeals(prev => revertMealLike(prev));
      
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user?.id || null);
      
      // Fetch public meals from Supabase - separate queries to avoid JOIN issues
      let mealsQuery = supabase
        .from('meals')
        .select(`
          id,
          name,
          description,
          calories,
          protein,
          carbohydrates,
          fat,
          cook_time,
          meal_type,
          cuisine,
          dietary_restrictions,
          created_at,
          meal_picture_url,
          user_id,
          like_count,
          created_by_ai,
          "Edamam_macros"
        `)
        .eq('visibility', true)
        .limit(20);

      // Apply initial sorting for database-level optimization
      if (selectedFilters.sortBy === 'newest') {
        mealsQuery = mealsQuery.order('created_at', { ascending: false });
      } else if (selectedFilters.sortBy === 'most_liked') {
        mealsQuery = mealsQuery.order('like_count', { ascending: false });
      } else if (selectedFilters.sortBy === 'popular') {
        mealsQuery = mealsQuery.order('like_count', { ascending: false });
      } else {
        mealsQuery = mealsQuery.order('created_at', { ascending: false });
      }

      const { data: mealsData, error } = await mealsQuery;

      if (error) {
        throw error;
      }

      // Fetch user profiles separately to get usernames
      let userProfiles: { [key: string]: string } = {};
      if (mealsData && mealsData.length > 0) {
        const userIds = Array.from(new Set(mealsData.map(meal => meal.user_id)));
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', userIds);

        if (profilesData) {
          userProfiles = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile.username;
            return acc;
          }, {} as { [key: string]: string });
        }
      }

      // Get user's like status if logged in
      let userLikes: { [key: string]: boolean } = {};
      if (user && mealsData && mealsData.length > 0) {
        const mealIds = mealsData.map(meal => meal.id);
        const { data: userLikesData } = await supabase
          .from('meal_likes')
          .select('meal_id')
          .in('meal_id', mealIds)
          .eq('user_id', user.id);

        if (userLikesData) {
          userLikes = userLikesData.reduce((acc, like) => {
            acc[like.meal_id] = true;
            return acc;
          }, {} as { [key: string]: boolean });
        }
      }

      // Transform data to match interface
      const transformedMeals: Meal[] = (mealsData || []).map(meal => ({
        id: meal.id.toString(),
        name: meal.name,
        description: meal.description,
        meal_picture_url: meal.meal_picture_url,
        author: userProfiles[meal.user_id] || 'Anonymous',
        calories: meal.calories,
        protein: meal.protein,
        carbohydrates: meal.carbohydrates,
        fat: meal.fat,
        cook_time: meal.cook_time,
        meal_type: meal.meal_type,
        cuisine: meal.cuisine,
        dietary_restrictions: meal.dietary_restrictions,
        created_at: meal.created_at,
        like_count: meal.like_count || 0,
        user_has_liked: userLikes[meal.id] || false,
        created_by_ai: meal.created_by_ai || false,
        edamam_macros: meal["Edamam_macros"] || false,
      }));

      setFeaturedMeals(transformedMeals);
    } catch (error) {
      console.error('Error fetching discover data:', error);
      
      // Set some fallback data so the UI isn't completely empty
      setFeaturedMeals([]);
      
      // Only show alert for actual network/server errors, not data structure issues
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as any).message;
        if (!errorMessage.includes('relationship') && !errorMessage.includes('schema cache')) {
          Alert.alert('Error', 'Failed to load content. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const renderMealItem = ({ item, index }: { item: Meal | { isAd: true; id: string }, index: number }) => {
    // If this is an ad item, render the ad banner
    if ('isAd' in item && item.isAd) {
      return <AdBanner key={`ad-${index}`} />;
    }

    // Otherwise render the meal item
    const meal = item as Meal;
    return (
      <TouchableOpacity
        style={[
          mealStyles.mealCard,
          {
            backgroundColor: theme.backgroundCard,
            borderRadius: 12,
            padding: 16,
            marginVertical: 8,
            marginHorizontal: 16,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
          }
        ]}
        onPress={() => {
          // Navigate to meal details page
          router.push(`/meal-info/discover?mealId=${meal.id}` as any);
        }}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row' }}>
          {meal.meal_picture_url && (
            <View style={mealStyles.mealImage}>
              <Image 
                source={{ uri: meal.meal_picture_url }} 
                style={{ width: 80, height: 80, borderRadius: 12 }}
              />
            </View>
          )}
          
          <View style={{ flex: 1, marginLeft: meal.meal_picture_url ? 12 : 0 }}>
            <Text style={[
              mealStyles.mealName, 
              {
                fontSize: theme.fonts.callout,
                fontFamily: theme.fontFamily.heading
              }
            ]} numberOfLines={1}>
              {meal.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <Text style={[
                dynamicStyles.caption, 
                { 
                  marginRight: 8,
                  fontSize: theme.fonts.caption,
                  fontFamily: theme.fontFamily.body,
                  color: theme.textSecondary,
                }
              ]}>
                by {meal.author}
              </Text>
              {meal.created_by_ai && (
                <View style={{
                  backgroundColor: theme.primary,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  marginRight: 6,
                }}>
                  <Text style={{
                    color: theme.buttonTextPrimary,
                    fontSize: theme.fonts.tiny,
                    fontFamily: theme.fontFamily.heading,
                  }}>
                    AI
                  </Text>
                </View>
              )}
              {meal.edamam_macros && (
                <Image 
                  source={require('../../../assets/images/Edamam_Badge_Transparent.png')}
                  style={{ width: 40, height: 12 }}
                  resizeMode="contain"
                />
              )}
            </View>
            
            {/* Description */}
            {meal.description && (
              <Text style={[
                mealStyles.mealDescription,
                {
                  fontSize: theme.fonts.footnote,
                  fontFamily: theme.fontFamily.body
                }
              ]} numberOfLines={2}>
                {meal.description}
              </Text>
            )}

            {/* Macros Row */}
            <View style={mealStyles.macroRow}>
              {meal.calories ? (
                <View style={mealStyles.macroItem}>
                  <Ionicons name="flash" size={12} color={theme.primary} />
                  <Text style={mealStyles.macroText}>
                    {meal.calories}
                  </Text>
                </View>
              ) : null}
              {meal.protein ? (
                <View style={mealStyles.macroItem}>
                  <Ionicons name="barbell" size={12} color={theme.success} />
                  <Text style={mealStyles.macroText}>
                    {meal.protein}g
                  </Text>
                </View>
              ) : null}
              {meal.carbohydrates ? (
                <View style={mealStyles.macroItem}>
                  <Ionicons name="leaf" size={12} color={theme.warning} />
                  <Text style={mealStyles.macroText}>
                    {meal.carbohydrates}g
                  </Text>
                </View>
              ) : null}
              {meal.fat ? (
                <View style={mealStyles.macroItem}>
                  <Ionicons name="water" size={12} color="#FFD700" />
                  <Text style={mealStyles.macroText}>
                    {meal.fat}g
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Bottom Row: Meal Type, Cook Time, and Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {meal.meal_type && (
                  <View style={[
                    mealStyles.mealTypeBadge,
                    { backgroundColor: getMealTypeColor(meal.meal_type, theme) }
                  ]}>
                    <Text style={mealStyles.mealTypeText}>
                      {meal.meal_type}
                    </Text>
                  </View>
                )}
                
                {meal.cook_time && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                    <Ionicons name="time" size={12} color={theme.textMuted} />
                    <Text style={[
                      dynamicStyles.footnote, 
                      { 
                        marginLeft: 4,
                        fontSize: theme.fonts.caption,
                        fontFamily: theme.fontFamily.body,
                      }
                    ]}>
                      {meal.cook_time}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {meal.like_count !== undefined && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons 
                      name={meal.user_has_liked ? "heart" : "heart-outline"} 
                      size={16} 
                      color={meal.user_has_liked ? theme.danger : theme.textMuted} 
                    />
                    <Text style={[
                      dynamicStyles.footnote, 
                      { 
                        marginLeft: 4,
                        fontSize: theme.fonts.caption,
                        fontFamily: theme.fontFamily.body,
                      }
                    ]}>
                      {meal.like_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Function to insert ads into the meal list every 15 items for free users
  const getMealsWithAds = useCallback((meals: Meal[]) => {
    if (isPremium) {
      return meals; // No ads for premium users
    }

    const mealsWithAds: (Meal | { isAd: true; id: string })[] = [];
    
    meals.forEach((meal, index) => {
      mealsWithAds.push(meal);
      
      // Insert ad every 15 meals (starting from 14, 29, 44, etc.)
      if ((index + 1) % 15 === 0) {
        mealsWithAds.push({
          isAd: true,
          id: `ad-${index}`,
        });
      }
    });
    
    return mealsWithAds;
  }, [isPremium]);
  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.loadingContainer}>
          <Text style={[
            dynamicStyles.caption, 
            { 
              color: theme.textSecondary,
              fontSize: theme.fonts.body,
              fontFamily: theme.fontFamily.body
            }
          ]}>
            Loading discover content...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView
        style={dynamicStyles.scrollView}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[
          dynamicStyles.header, 
          { 
            paddingBottom: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }
        ]}>
          <Text style={[
            dynamicStyles.title, 
            { 
              fontSize: theme.fonts.largeTitle, 
              fontFamily: theme.fontFamily.heading, 
              fontWeight: '800', 
              letterSpacing: 0.5 
            }
          ]}>
            Discover
          </Text>
          <TouchableOpacity
            style={[
              dynamicStyles.primaryButton,
              {
                flexDirection: 'row',
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderRadius: 20,
              }
            ]}
            onPress={() => router.push('/(main)/competition/current')}
          >
            <Ionicons name="trophy" size={20} color={theme.buttonTextPrimary} />
            <Text style={[
              dynamicStyles.primaryButtonText, 
              { 
                fontSize: theme.fonts.subheadline, 
                fontFamily: theme.fontFamily.heading, 
                marginLeft: 6 
              }
            ]}>
              Competition
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search and Filter Bar */}
        <View style={styles.searchFilterContainer}>
          <View style={[dynamicStyles.card, { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12, paddingVertical: 12 }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[
                dynamicStyles.input,
                {
                  flex: 1,
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  marginLeft: 8,
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                  fontSize: theme.fonts.body,
                  fontFamily: theme.fontFamily.body,
                }
              ]}
              placeholder="Search meals and creators..."
              placeholderTextColor={theme.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              dynamicStyles.card,
              {
                width: 50,
                height: 50,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={20} color={theme.primary} />
            {(selectedFilters.cookTimeFilter.length > 0 ||
            selectedFilters.calorieRange.length > 0 ||
            selectedFilters.proteinRange.length > 0 ||
            selectedFilters.carbRange.length > 0 ||
            selectedFilters.fatRange.length > 0 ||
            selectedFilters.mealTypes.length > 0 ||
            selectedFilters.cuisines.length > 0 ||
            selectedFilters.dietaryRestrictions.length > 0 ||
            selectedFilters.aiGenerated.length > 0 ||
            selectedFilters.sortBy !== 'newest') && (
            <View style={[
              styles.filterIndicator,
              {
                backgroundColor: theme.primary,
                position: 'absolute',
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 4,
              }
            ]} />
          )}
          </TouchableOpacity>
        </View>

        {/* Featured Meals Section */}
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle, 
            { 
              color: theme.text,
              fontSize: theme.fonts.title2,
              fontFamily: theme.fontFamily.heading
            }
          ]}>
            Featured Meals ({filteredMeals.length})
          </Text>
          {filteredMeals.length > 0 ? (
            <FlatList
              data={getMealsWithAds(filteredMeals)}
              renderItem={renderMealItem}
              keyExtractor={(item, index) => ('isAd' in item && item.isAd) ? `ad-${index}` : (item as Meal).id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
              <Text style={[
                styles.emptyStateTitle, 
                { 
                  color: theme.text,
                  fontSize: theme.fonts.headline,
                  fontFamily: theme.fontFamily.heading
                }
              ]}>
                No meals found
              </Text>
              <Text style={[
                styles.emptyStateSubtitle, 
                { 
                  color: theme.textSecondary,
                  fontSize: theme.fonts.body,
                  fontFamily: theme.fontFamily.body
                }
              ]}>
                {searchQuery.trim() ? 'Try adjusting your search or filters' : 'Check back later for new content'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[
              styles.modalTitle, 
              { 
                color: theme.text,
                fontSize: theme.fonts.title2,
                fontFamily: theme.fontFamily.heading
              }
            ]}>
              Filter & Sort Meals
            </Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Sort By Section */}
            <View style={styles.filterSection}>
              <Text style={[
                styles.filterSectionTitle, 
                { 
                  color: theme.text,
                  fontSize: theme.fonts.callout,
                  fontFamily: theme.fontFamily.heading
                }
              ]}>
                Sort By
              </Text>
              {([
                { key: 'newest', label: 'Newest' },
                { key: 'most_liked', label: 'Most Liked' },
                { key: 'popular', label: 'Popular Recently' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.filterOption}
                  onPress={() => setSelectedFilters(prev => ({ ...prev, sortBy: option.key }))}
                >
                  <Text style={[
                    styles.filterOptionText, 
                    { 
                      color: theme.text,
                      fontSize: theme.fonts.body,
                      fontFamily: theme.fontFamily.body
                    }
                  ]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.sortBy === option.key ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Calorie Range Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Calorie Range
              </Text>
              {([
                { key: 'low', label: 'Low (< 400 cal)' },
                { key: 'medium', label: 'Medium (400-700 cal)' },
                { key: 'high', label: 'High (> 700 cal)' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('calorieRange', option.key)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.calorieRange.includes(option.key) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Protein Range Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Protein Range
              </Text>
              {([
                { key: 'low', label: 'Low (< 15g)' },
                { key: 'medium', label: 'Medium (15-30g)' },
                { key: 'high', label: 'High (> 30g)' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('proteinRange', option.key)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.proteinRange.includes(option.key) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Carb Range Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Carb Range
              </Text>
              {([
                { key: 'low', label: 'Low (< 30g)' },
                { key: 'medium', label: 'Medium (30-60g)' },
                { key: 'high', label: 'High (> 60g)' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('carbRange', option.key)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.carbRange.includes(option.key) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Fat Range Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Fat Range
              </Text>
              {([
                { key: 'low', label: 'Low (< 10g)' },
                { key: 'medium', label: 'Medium (10-20g)' },
                { key: 'high', label: 'High (> 20g)' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('fatRange', option.key)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.fatRange.includes(option.key) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Meal Type Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Meal Type
              </Text>
              {MEAL_TYPE_OPTIONS.map((mealType) => (
                <TouchableOpacity
                  key={mealType}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('mealTypes', mealType)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                  </Text>
                  <Ionicons
                    name={selectedFilters.mealTypes.includes(mealType) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Cuisine Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Cuisine
              </Text>
              {cuisineFilterOptions.filter(option => option.value !== "").map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('cuisines', option.value)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.cuisines.includes(option.value) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Dietary Restrictions Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Dietary Restrictions
              </Text>
              {dietaryFilterOptions.filter(option => option.value !== "").map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('dietaryRestrictions', option.value)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.dietaryRestrictions.includes(option.value) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Cook Time Filter Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Cook Time
              </Text>
              {([
                { key: 'quick', label: 'Quick (≤ 30 min)' },
                { key: 'medium', label: 'Medium (30-60 min)' },
                { key: 'long', label: 'Long (> 60 min)' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('cookTimeFilter', option.key)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={selectedFilters.cookTimeFilter.includes(option.key) ? 'checkbox' : 'checkbox-outline'}
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* AI Generated Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                Creation Method
              </Text>
              {aiGenerationFilterOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() => toggleFilterArrayValue('aiGenerated', option.value)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Ionicons 
                    name={selectedFilters.aiGenerated.includes(option.value) ? "checkbox" : "checkbox-outline"} 
                    size={20} 
                    color={theme.primary} 
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: theme.textSecondary }]}
                onPress={() => {
                  setSelectedFilters({
                    sortBy: 'newest',
                    cookTimeFilter: [],
                    calorieRange: [],
                    proteinRange: [],
                    carbRange: [],
                    fatRange: [],
                    mealTypes: [],
                    cuisines: [],
                    dietaryRestrictions: [],
                    aiGenerated: [],
                  });
                }}
              >
                <Text style={[styles.resetButtonText, { color: theme.textSecondary }]}>
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={[styles.applyButtonText, { color: theme.buttonTextPrimary }]}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: theme.fonts.largeTitle,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  competitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  competitionButtonText: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: theme.fonts.title3,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  mealItem: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  mealImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  mealImagePhoto: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  mealInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mealName: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.body,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  mealAuthor: {
    fontSize: theme.fonts.callout,
    fontFamily: theme.fontFamily.body,
    marginBottom: 10,
    opacity: 0.75,
  },
  mealStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: theme.fonts.footnote,
    fontFamily: theme.fontFamily.body,
    marginLeft: 6,
    fontWeight: '500',
  },
  // New styles for enhanced meal card
  mealDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginBottom: 8,
    lineHeight: 18,
    opacity: 0.8,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  macroText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.medium,
    marginLeft: 4,
  },
  mealBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  likeCount: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.medium,
    marginLeft: 4,
  },
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Search and filter styles
  searchFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginLeft: 12,
    marginRight: 8,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
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
    paddingTop: 20,
    paddingBottom: 34,
    maxHeight: '80%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.heading,
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  filterOptionText: {
    fontSize: theme.fonts.callout,
    fontFamily: theme.fontFamily.body,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
  },
});