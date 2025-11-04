import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import {
  CUISINE_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  MEAL_TYPE_OPTIONS,
  CALORIE_RANGES,
  PROTEIN_RANGES,
  CARB_RANGES,
  FAT_RANGES,
  SORT_OPTIONS,
} from '../../../constants/filterOptions';

interface Meal {
  id: string;
  name: string;
  description?: string;
  meal_picture_url?: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  rating?: number;
  meal_type?: string;
  cuisine?: string;
  dietary_restrictions?: string;
  created_at: string;
  created_by_ai?: boolean;
  edamam_macros?: boolean;
}

export default function MyMealsPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState({
    sortBy: 'newest' as 'newest' | 'oldest' | 'name',
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

  // Helper function to toggle array values
  const toggleArrayValue = (filterKey: keyof typeof selectedFilters, value: string) => {
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
    let filtered = [...meals];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(meal =>
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.cuisine?.toLowerCase().includes(searchQuery.toLowerCase())
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
        meal.cuisine && selectedFilters.cuisines.includes(meal.cuisine)
      );
    }

    // Apply dietary restrictions filter
    if (selectedFilters.dietaryRestrictions.length > 0) {
      filtered = filtered.filter(meal => 
        meal.dietary_restrictions && selectedFilters.dietaryRestrictions.includes(meal.dietary_restrictions)
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

    // Apply sorting
    filtered.sort((a, b) => {
      switch (selectedFilters.sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredMeals(filtered);
  }, [meals, searchQuery, selectedFilters]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  const fetchMeals = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view your meals.");
        return;
      }

      // Fetch meals from Supabase
      const { data: mealsData, error } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          description,
          calories,
          protein,
          carbohydrates,
          fat,
          meal_type,
          cuisine,
          dietary_restrictions,
          created_at,
          meal_picture_url,
          created_by_ai,
          "Edamam_macros"
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform data to match interface
      const transformedMeals: Meal[] = (mealsData || []).map(meal => ({
        id: meal.id.toString(),
        name: meal.name || '',
        description: meal.description || '',
        calories: meal.calories || undefined,
        protein: meal.protein || undefined,
        carbohydrates: meal.carbohydrates || undefined,
        fat: meal.fat || undefined,
        meal_type: meal.meal_type || undefined,
        cuisine: meal.cuisine || undefined,
        dietary_restrictions: meal.dietary_restrictions || undefined,
        created_at: meal.created_at,
        meal_picture_url: meal.meal_picture_url || undefined,
        rating: 0, // TODO: Calculate from reviews if needed
        created_by_ai: meal.created_by_ai || false,
        edamam_macros: meal["Edamam_macros"] || false,
      }));

      setMeals(transformedMeals);

    } catch (error) {
      console.error('Error fetching meals:', error);
      Alert.alert('Error', 'Failed to load your meals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  // Refresh meals when the screen comes into focus (e.g., after creating a new meal)
  useFocusEffect(
    useCallback(() => {
      fetchMeals();
    }, [fetchMeals])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  }, [fetchMeals]);

  const handleCreateMeal = () => {
    router.push('../create-meal');
  };

  const handleMealMenu = (mealId: string) => {
    setSelectedMealForMenu(mealId);
  };

  const handleEditMeal = (mealId: string) => {
    setSelectedMealForMenu(null);
    router.push(`/(main)/create-meal/edit?mealId=${mealId}` as any);
  };

  const handleDuplicateMeal = async (meal: Meal) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('meals').insert({
        name: `${meal.name} (Copy)`,
        description: meal.description,
        calories: meal.calories,
        protein: meal.protein,
        carbohydrates: meal.carbohydrates,
        fat: meal.fat,
        meal_type: meal.meal_type,
        cuisine: meal.cuisine,
        user_id: user.id,
      });

      if (error) throw error;

      Alert.alert('Success', 'Meal duplicated successfully!');
      fetchMeals(); // Refresh the list
    } catch (error) {
      console.error('Error duplicating meal:', error);
      Alert.alert('Error', 'Failed to duplicate meal');
    }
    setSelectedMealForMenu(null);
  };

  const handleDeleteMeal = (mealId: string) => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => deleteMeal(mealId) 
        },
      ]
    );
    setSelectedMealForMenu(null);
  };

  const deleteMeal = async (mealId: string) => {
    try {
      const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealId);

      if (error) throw error;

      Alert.alert('Success', 'Meal deleted successfully');
      fetchMeals(); // Refresh the list
    } catch (error) {
      console.error('Error deleting meal:', error);
      Alert.alert('Error', 'Failed to delete meal');
    }
  };

  const renderMealItem = ({ item }: { item: Meal }) => {
    // Safety check for item
    if (!item || !item.id || !item.name) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[styles.mealItem, { backgroundColor: theme.card }]}
        onPress={() => {
          router.push(`../meal-info/my-meals?mealId=${item.id}`);
        }}
        activeOpacity={0.8}
      >
        {item.meal_picture_url && (
          <View style={[styles.mealImage, { backgroundColor: theme.cardSecondary }]}>
            <Image 
              source={{ uri: item.meal_picture_url }} 
              style={styles.mealImagePhoto}
            />
          </View>
        )}
        <View style={[styles.mealInfo, { marginLeft: item.meal_picture_url ? 16 : 0 }]}>
          <Text style={[
            styles.mealName, 
            { 
              color: theme.text,
              fontSize: theme.fonts.callout,
              fontFamily: theme.fontFamily.heading
            }
          ]} numberOfLines={1}>
            {item.name || 'Unnamed Meal'}
          </Text>
          
          {/* AI and Edamam Badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            {item.created_by_ai && (
              <View style={{
                backgroundColor: theme.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginRight: 6,
                marginBottom: 4,
              }}>
                <Text style={{
                  color: theme.buttonTextPrimary || '#ffffff',
                  fontSize: theme.fonts.tiny,
                  fontFamily: theme.fontFamily.heading,
                }}>
                  AI
                </Text>
              </View>
            )}
            {item.edamam_macros && (
              <Image 
                source={require('../../../assets/images/Edamam_Badge_Transparent.png')}
                style={{ width: 40, height: 12, marginBottom: 4 }}
                resizeMode="contain"
              />
            )}
          </View>
          
          {item.description && (
            <Text style={[
              styles.mealDescription, 
              { 
                color: theme.textSecondary,
                fontSize: theme.fonts.footnote,
                fontFamily: theme.fontFamily.body
              }
            ]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          {/* Macros Row */}
          <View style={styles.macrosRow}>
            {item.calories && (
              <View style={styles.macroItem}>
                <Ionicons name="flash" size={12} color={theme.primary} />
                <Text style={[
                  styles.macroText, 
                  { 
                    color: theme.textSecondary,
                    fontSize: theme.fonts.caption,
                    fontFamily: theme.fontFamily.body
                  }
                ]}>
                  {item.calories}
                </Text>
              </View>
            )}
            {item.protein && (
              <View style={styles.macroItem}>
                <Ionicons name="barbell" size={12} color={theme.success} />
                <Text style={[
                  styles.macroText, 
                  { 
                    color: theme.textSecondary,
                    fontSize: theme.fonts.caption,
                    fontFamily: theme.fontFamily.body
                  }
                ]}>
                  {item.protein}g
                </Text>
              </View>
            )}
            {item.carbohydrates && (
              <View style={styles.macroItem}>
                <Ionicons name="leaf" size={12} color={theme.warning} />
                <Text style={[
                  styles.macroText, 
                  { 
                    color: theme.textSecondary,
                    fontSize: theme.fonts.caption,
                    fontFamily: theme.fontFamily.body
                  }
                ]}>
                  {item.carbohydrates}g
                </Text>
              </View>
            )}
            {item.fat && (
              <View style={styles.macroItem}>
                <Ionicons name="water" size={12} color="#FFD700" />
                <Text style={[
                  styles.macroText, 
                  { 
                    color: theme.textSecondary,
                    fontSize: theme.fonts.caption,
                    fontFamily: theme.fontFamily.body
                  }
                ]}>
                  {item.fat}g
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => handleMealMenu(item.id)}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="restaurant-outline" size={64} color={theme.textSecondary} />
      <Text style={[
        styles.emptyTitle, 
        { 
          color: theme.text,
          fontSize: theme.fonts.headline,
          fontFamily: theme.fontFamily.heading
        }
      ]}>
        No meals yet
      </Text>
      <Text style={[
        styles.emptySubtitle, 
        { 
          color: theme.textSecondary,
          fontSize: theme.fonts.body,
          fontFamily: theme.fontFamily.body
        }
      ]}>
        Create your first meal to get started
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={handleCreateMeal}
      >
        <Text style={[
          styles.createButtonText, 
          { 
            color: theme.buttonTextPrimary,
            fontSize: theme.fonts.body,
            fontFamily: theme.fontFamily.heading
          }
        ]}>
          Create Meal
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[
            styles.loadingText, 
            { 
              color: theme.textSecondary,
              fontSize: theme.fonts.body,
              fontFamily: theme.fontFamily.body
            }
          ]}>
            Loading your meals...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[
          styles.title, 
          { 
            color: theme.text,
            fontSize: theme.fonts.largeTitle,
            fontFamily: theme.fontFamily.heading
          }
        ]}>
          My Meals
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={handleCreateMeal}
        >
          <Ionicons name="add" size={20} color={theme.buttonTextPrimary} />
        </TouchableOpacity>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchFilterContainer}>
        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[
              styles.searchInput, 
              { 
                color: theme.text,
                fontSize: theme.fonts.body,
                fontFamily: theme.fontFamily.body
              }
            ]}
            placeholder="Search your meals..."
            placeholderTextColor={theme.textSecondary}
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
          style={[styles.filterButton, { backgroundColor: theme.card }]}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="filter" size={20} color={theme.primary} />
          {(selectedFilters.calorieRange.length > 0 || 
            selectedFilters.proteinRange.length > 0 ||
            selectedFilters.carbRange.length > 0 ||
            selectedFilters.fatRange.length > 0 ||
            selectedFilters.mealTypes.length > 0 ||
            selectedFilters.cuisines.length > 0 ||
            selectedFilters.dietaryRestrictions.length > 0 ||
            selectedFilters.aiGenerated.length > 0 ||
            selectedFilters.sortBy !== 'newest') && (
            <View style={[styles.filterIndicator, { backgroundColor: theme.primary }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Meals List */}
      <FlatList
        data={filteredMeals}
        renderItem={renderMealItem}
        keyExtractor={(item, index) => item?.id || index.toString()}
        contentContainerStyle={[
          filteredMeals.length === 0 ? styles.emptyListContainer : styles.listContainer,
          { paddingBottom: tabBarHeight + 20 } // Add padding for tab bar
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

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
                Filter & Sort
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Sort By Section */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                  Sort By
                </Text>
                {(['newest', 'oldest', 'name'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.filterOption}
                    onPress={() => setSelectedFilters(prev => ({ ...prev, sortBy: option }))}
                  >
                    <Text style={[styles.filterOptionText, { color: theme.text }]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                    <Ionicons
                      name={selectedFilters.sortBy === option ? 'radio-button-on' : 'radio-button-off'}
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
                    onPress={() => toggleArrayValue('calorieRange', option.key)}
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
                    onPress={() => toggleArrayValue('proteinRange', option.key)}
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

              {/* Carbohydrate Range Section */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                  Carbohydrate Range
                </Text>
                {([
                  { key: 'low', label: 'Low (< 30g)' },
                  { key: 'medium', label: 'Medium (30-60g)' },
                  { key: 'high', label: 'High (> 60g)' },
                ] as const).map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.filterOption}
                    onPress={() => toggleArrayValue('carbRange', option.key)}
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
                    onPress={() => toggleArrayValue('fatRange', option.key)}
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
                    onPress={() => toggleArrayValue('mealTypes', mealType)}
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
                {CUISINE_OPTIONS.map((cuisine) => (
                  <TouchableOpacity
                    key={cuisine}
                    style={styles.filterOption}
                    onPress={() => toggleArrayValue('cuisines', cuisine)}
                  >
                    <Text style={[styles.filterOptionText, { color: theme.text }]}>
                      {cuisine}
                    </Text>
                    <Ionicons
                      name={selectedFilters.cuisines.includes(cuisine) ? 'checkbox' : 'checkbox-outline'}
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
                {DIETARY_RESTRICTION_OPTIONS.map((restriction) => (
                  <TouchableOpacity
                    key={restriction}
                    style={styles.filterOption}
                    onPress={() => toggleArrayValue('dietaryRestrictions', restriction)}
                  >
                    <Text style={[styles.filterOptionText, { color: theme.text }]}>
                      {restriction}
                    </Text>
                    <Ionicons
                      name={selectedFilters.dietaryRestrictions.includes(restriction) ? 'checkbox' : 'checkbox-outline'}
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
                {[
                  { key: 'ai', label: 'AI Generated' },
                  { key: 'human', label: 'Manually Created' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.filterOption}
                    onPress={() => toggleArrayValue('aiGenerated', option.key)}
                  >
                    <Text style={[styles.filterOptionText, { color: theme.text }]}>
                      {option.label}
                    </Text>
                    <Ionicons 
                      name={selectedFilters.aiGenerated.includes(option.key) ? "checkbox" : "checkbox-outline"} 
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

      {/* Meal Options Modal */}
      <Modal
        visible={selectedMealForMenu !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedMealForMenu(null)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMealForMenu(null)}
        >
          <View style={[styles.menuContent, { backgroundColor: theme.card }]}>
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => handleEditMeal(selectedMealForMenu!)}
            >
              <Ionicons name="create-outline" size={20} color={theme.primary} />
              <Text style={[
                styles.menuOptionText, 
                { 
                  color: theme.text,
                  fontSize: theme.fonts.body,
                  fontFamily: theme.fontFamily.body
                }
              ]}>
                Edit Meal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                const meal = meals.find(m => m.id === selectedMealForMenu);
                if (meal) handleDuplicateMeal(meal);
              }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.info} />
              <Text style={[
                styles.menuOptionText, 
                { 
                  color: theme.text,
                  fontSize: theme.fonts.body,
                  fontFamily: theme.fontFamily.body
                }
              ]}>
                Duplicate
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => handleDeleteMeal(selectedMealForMenu!)}
            >
              <Ionicons name="trash-outline" size={20} color={theme.danger} />
              <Text style={[
                styles.menuOptionText, 
                { 
                  color: theme.danger,
                  fontSize: theme.fonts.body,
                  fontFamily: theme.fontFamily.body
                }
              ]}>
                Delete Meal
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
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
    paddingVertical: 20,
  },
  title: {
    fontSize: theme.fonts.largeTitle,
    fontFamily: theme.fontFamily.heading,
    letterSpacing: 0.5,
  },
  addButton: {
    width: 48,
    height: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flex: 1,
  },
  mealItem: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
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
    width: 70,
    height: 70,
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
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 6,
    lineHeight: 22,
  },
  mealDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginBottom: 8,
    lineHeight: 18,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.medium,
  },
  mealStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.medium,
    marginLeft: 6,
  },
  dateText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    opacity: 0.75,
  },
  moreButton: {
    padding: 12,
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.heading,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
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
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    width: 200,
    borderRadius: 8,
    padding: 8,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuOptionText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
});