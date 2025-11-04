import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';

interface Meal {
  id: string;
  name: string;
  description?: string;
  meal_picture_url?: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  meal_type?: string;
  cuisine?: string;
  dietary_restrictions?: string;
  created_at: string;
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: theme.fonts.title2,
    fontFamily: theme.fontFamily.heading,
  },
  subtitle: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginTop: 2,
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
    padding: 16,
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
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: theme.fonts.caption,
    fontFamily: theme.fontFamily.body,
    marginBottom: 8,
    lineHeight: 16,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
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
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.heading,
  },
  modalSubtitle: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginBottom: 24,
    textAlign: 'center',
  },
  mealTypeOptions: {
    gap: 12,
    marginBottom: 24,
  },
  mealTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  mealTypeLabel: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
    marginLeft: 12,
  },
  addButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.heading,
  },
});

export default function AddToCalendarPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'>('breakfast');

  // Calculate tab bar height for proper content padding
  const tabBarHeight = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10) + (Platform.OS === 'ios' ? 65 : 60);

  const mealTypes = [
    { key: 'breakfast', label: 'Breakfast', icon: 'sunny' },
    { key: 'lunch', label: 'Lunch', icon: 'restaurant' },
    { key: 'dinner', label: 'Dinner', icon: 'moon' },
    { key: 'snack', label: 'Snack', icon: 'nutrition' },
    { key: 'dessert', label: 'Dessert', icon: 'ice-cream' },
  ] as const;

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
          meal_picture_url
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  }, [fetchMeals]);

  const handleMealSelect = (meal: Meal) => {
    setSelectedMeal(meal);
    setShowMealTypeModal(true);
  };

  const addMealToPlan = async () => {
    if (!selectedMeal || !date) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert into meal_plan table
      const { error } = await supabase.from('meal_plan').insert({
        user_id: user.id,
        meal_id: parseInt(selectedMeal.id),
        date: date,
        meal_type: selectedMealType,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success', 
        `${selectedMeal.name} has been added to your meal plan for ${format(new Date(date), 'MMMM d, yyyy')}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowMealTypeModal(false);
              setSelectedMeal(null);
              // Force a refresh by navigating back then to calendar
              router.back();
              setTimeout(() => {
                router.replace('/' as never);
              }, 100);
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error adding meal to plan:', error);
      Alert.alert('Error', 'Failed to add meal to your plan');
    }
  };

  const renderMealItem = ({ item }: { item: Meal }) => {
    if (!item || !item.id || !item.name) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[styles.mealItem, { backgroundColor: theme.card }]}
        onPress={() => handleMealSelect(item)}
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
            {item.name}
          </Text>
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
                  {item.calories} cal
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
        <Ionicons name="add-circle" size={24} color={theme.primary} />
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
        No meals available
      </Text>
      <Text style={[
        styles.emptySubtitle, 
        { 
          color: theme.textSecondary,
          fontSize: theme.fonts.body,
          fontFamily: theme.fontFamily.body
        }
      ]}>
        Create some meals first to add them to your calendar
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/(main)/create-meal')}
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[
            styles.title, 
            { 
              color: theme.text,
              fontSize: theme.fonts.title2,
              fontFamily: theme.fontFamily.heading
            }
          ]}>
            Add to Calendar
          </Text>
          <Text style={[
            styles.subtitle, 
            { 
              color: theme.textSecondary,
              fontSize: theme.fonts.subheadline,
              fontFamily: theme.fontFamily.body
            }
          ]}>
            {date ? format(new Date(date), 'MMMM d, yyyy') : 'Select a meal to add'}
          </Text>
        </View>
      </View>

      {/* Meals List */}
      <FlatList
        data={meals}
        renderItem={renderMealItem}
        keyExtractor={(item, index) => item?.id || index.toString()}
        contentContainerStyle={[
          meals.length === 0 ? styles.emptyListContainer : styles.listContainer,
          { paddingBottom: tabBarHeight + 20 }
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Meal Type Selection Modal */}
      <Modal
        visible={showMealTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMealTypeModal(false)}
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
                Select Meal Type
              </Text>
              <TouchableOpacity onPress={() => setShowMealTypeModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[
              styles.modalSubtitle, 
              { 
                color: theme.textSecondary,
                fontSize: theme.fonts.subheadline,
                fontFamily: theme.fontFamily.body
              }
            ]}>
              Adding "{selectedMeal?.name}" to {date ? format(new Date(date), 'MMMM d') : ''}
            </Text>

            <View style={styles.mealTypeOptions}>
              {mealTypes.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.mealTypeOption,
                    { backgroundColor: theme.cardSecondary },
                    selectedMealType === type.key && { backgroundColor: theme.primary }
                  ]}
                  onPress={() => setSelectedMealType(type.key)}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={24} 
                    color={selectedMealType === type.key ? theme.buttonTextPrimary : theme.text} 
                  />
                  <Text style={[
                    styles.mealTypeLabel,
                    { 
                      color: selectedMealType === type.key ? theme.buttonTextPrimary : theme.text,
                      fontSize: theme.fonts.body,
                      fontFamily: theme.fontFamily.heading
                    }
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={addMealToPlan}
            >
              <Text style={[
                styles.addButtonText, 
                { 
                  color: theme.buttonTextPrimary,
                  fontSize: theme.fonts.body,
                  fontFamily: theme.fontFamily.heading
                }
              ]}>
                Add to Meal Plan
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}