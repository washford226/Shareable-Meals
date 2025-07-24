import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const PantryScreen = () => {
  const { theme } = useTheme();
  const router = useRouter();

  interface PantryItem {
    pantry_id: number;
    food: string;
    quantity: number | null;
    unit?: string;
    expiration_date?: string;
  }

  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Fetch pantry items from Supabase
  const fetchPantryItems = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("pantry")
        .select("*")
        .eq("user_id", userId)
        .order("expiration_date", { ascending: true });

      if (error) {
        throw error;
      }

      setPantryItems(data || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error fetching pantry items:", error);
      const errorMessage = error.message || "Failed to fetch pantry items. Please try again later.";
      setError(errorMessage);
      setPantryItems([]);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchPantryItems(false);
        }, delay);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [retryCount]);

  // Delete a pantry item from Supabase
  const deletePantryItem = useCallback(async (pantry_id: number) => {
    // Safety check - don't try to delete if pantry_id is invalid
    if (!pantry_id || typeof pantry_id !== 'number') {
      Alert.alert("Error", "Invalid item ID. Cannot delete item.");
      return;
    }
    
    try {
      setDeletingId(pantry_id);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { error } = await supabase
        .from("pantry")
        .delete()
        .eq("pantry_id", pantry_id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      // Optimistic update - remove item from local state immediately
      setPantryItems(prev => prev.filter(item => item.pantry_id !== pantry_id));
      
      Alert.alert("Success", "Pantry item deleted successfully.");
    } catch (error: any) {
      console.error("Error deleting pantry item:", error);
      const errorMessage = error.message || "Failed to delete pantry item. Please try again later.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
      
      // Refresh data to ensure consistency
      fetchPantryItems(false);
    } finally {
      setDeletingId(null);
    }
  }, [fetchPantryItems]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchPantryItems(true);
  }, [fetchPantryItems]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRetryCount(0);
    await fetchPantryItems(false);
    setRefreshing(false);
  }, [fetchPantryItems]);

  // Check if item is expired or expiring soon
  const getExpirationStatus = useCallback((expirationDate: string | undefined) => {
    if (!expirationDate) return 'none';
    
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'expiring';
    return 'fresh';
  }, []);

  useEffect(() => {
    fetchPantryItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { 
            backgroundColor: theme.danger,
            shadowColor: theme.shadow,
          }]}>
            <Text style={[styles.errorBannerText, { color: theme.buttonTextPrimary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.errorBannerButton, { backgroundColor: theme.background }]}
              onPress={handleRetry}
            >
              <Text style={[styles.errorBannerButtonText, { color: theme.danger }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Retry Banner */}
        {retryCount > 0 && (
          <View style={[styles.retryBanner, { 
            backgroundColor: theme.warning,
            shadowColor: theme.shadow,
          }]}>
            <Text style={[styles.retryBannerText, { color: theme.buttonTextPrimary }]}>
              📡 Retry attempt {retryCount}/3
            </Text>
          </View>
        )}

        <View style={styles.centerContent}>
          <Text style={[styles.emptyIcon, { color: theme.primary }]}>
            🥫
          </Text>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading your pantry...
          </Text>
          
          {error && (
            <TouchableOpacity
              style={[styles.retryButton, { 
                backgroundColor: theme.primary, 
                marginTop: 24,
                shadowColor: theme.shadow,
              }]}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={[styles.retryButtonText, { color: theme.buttonTextPrimary }]}>
                🔄 Try Again
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: theme.danger,
          shadowColor: theme.shadow,
        }]}>
          <Text style={[styles.errorBannerText, { color: theme.buttonTextPrimary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.background }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.danger }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && (
        <View style={[styles.retryBanner, { 
          backgroundColor: theme.warning,
          shadowColor: theme.shadow,
        }]}>
          <Text style={[styles.retryBannerText, { color: theme.buttonTextPrimary }]}>
            📡 Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      {/* Enhanced Header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={[styles.title, { color: theme.text }]}>
          🥫 My Pantry
        </Text>
        <Text style={[{ fontSize: 16, color: theme.textSecondary, textAlign: 'center' }]}>
          Track your ingredients and expiration dates
        </Text>
      </View>
      
      <FlatList
        data={pantryItems.filter(item => item.pantry_id && typeof item.pantry_id === 'number')}
        keyExtractor={(item, index) => item.pantry_id ? item.pantry_id.toString() : `pantry-item-${index}`}
        renderItem={({ item }) => {
          const expirationStatus = getExpirationStatus(item.expiration_date);
          const isDeleting = deletingId === item.pantry_id;
          
          return (
            <View style={[
              styles.itemContainer, 
              { 
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
              expirationStatus === 'expired' && { borderColor: theme.danger, borderWidth: 2 },
              expirationStatus === 'expiring' && { borderColor: theme.warning, borderWidth: 2 }
            ]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemMainInfo}>
                  <Text style={[styles.itemText, { color: theme.text }]}>
                    🥘 {item.food}
                  </Text>
                  {(item.quantity !== null || item.unit) && (
                    <Text style={[styles.quantityText, { color: theme.textSecondary }]}>
                      {item.quantity ?? ""} {item.unit || ""}
                    </Text>
                  )}
                </View>
                
                <View style={styles.statusContainer}>
                  {expirationStatus === 'expired' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.danger }]}>
                      <Text style={[styles.statusText, { color: theme.buttonTextPrimary }]}>EXPIRED</Text>
                    </View>
                  )}
                  {expirationStatus === 'expiring' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
                      <Text style={[styles.statusText, { color: theme.buttonTextPrimary }]}>EXPIRING</Text>
                    </View>
                  )}
                  {expirationStatus === 'fresh' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.success }]}>
                      <Text style={[styles.statusText, { color: theme.buttonTextPrimary }]}>FRESH</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {item.expiration_date && (
                <View style={styles.expirationContainer}>
                  <Text style={[styles.expirationLabel, { color: theme.textSecondary }]}>
                    Expires:
                  </Text>
                  <Text style={[
                    styles.expirationText, 
                    { 
                      color: expirationStatus === 'expired' ? theme.danger :
                             expirationStatus === 'expiring' ? theme.warning : 
                             expirationStatus === 'fresh' ? theme.success : theme.textSecondary 
                    }
                  ]}>
                    {new Date(item.expiration_date).toLocaleDateString()}
                  </Text>
                </View>
              )}
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.editButton, { 
                    backgroundColor: theme.primary,
                    shadowColor: theme.shadow,
                  }]}
                  onPress={() => {
                    if (item.pantry_id && typeof item.pantry_id === 'number') {
                      router.push(`/pantry/${item.pantry_id}/edit`);
                    } else {
                      Alert.alert("Error", "Invalid item ID. Cannot edit item.");
                    }
                  }}
                  disabled={isDeleting}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.editButtonText, { color: theme.buttonTextPrimary }]}>
                    ✏️ Edit
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.deleteButton, 
                    { 
                      backgroundColor: theme.danger, 
                      opacity: isDeleting ? 0.5 : 1,
                      shadowColor: theme.shadow,
                    }
                  ]}
                  onPress={() => {
                    if (!item.pantry_id || typeof item.pantry_id !== 'number') {
                      Alert.alert("Error", "Invalid item ID. Cannot delete item.");
                      return;
                    }
                    Alert.alert(
                      "Delete Item",
                      `Are you sure you want to delete "${item.food}"?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", onPress: () => deletePantryItem(item.pantry_id), style: "destructive" },
                      ]
                    );
                  }}
                  disabled={isDeleting}
                  activeOpacity={0.8}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={theme.buttonTextPrimary} />
                  ) : (
                    <Text style={[styles.deleteButtonText, { color: theme.buttonTextPrimary }]}>
                      🗑️ Delete
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Text style={[styles.emptyIcon, { color: theme.textSecondary }]}>
              🥫
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {error ? "Unable to load pantry items" : "Your pantry is empty"}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              {error ? "Please try again" : "Add some ingredients to get started!"}
            </Text>
            {!error && (
              <TouchableOpacity
                style={[styles.emptyActionButton, { 
                  backgroundColor: theme.primary,
                  shadowColor: theme.shadow,
                }]}
                onPress={() => router.push("/pantry/add")}
                activeOpacity={0.8}
              >
                <Text style={[styles.emptyActionButtonText, { color: theme.buttonTextPrimary }]}>
                  ➕ Add First Item
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      
      <TouchableOpacity
        style={[styles.addButton, { 
          backgroundColor: theme.primary,
          shadowColor: theme.shadow,
        }]}
        onPress={() => router.push("/pantry/add")}
        activeOpacity={0.8}
      >
        <Text style={[styles.addButtonText, { color: theme.buttonTextPrimary }]}>
          ➕ Add Item
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.backButton, { 
          backgroundColor: theme.background,
          borderColor: theme.border,
        }]}
        onPress={() => router.push("/meal-plan/calendar")}
        activeOpacity={0.8}
      >
        <Text style={[styles.backButtonText, { color: theme.text }]}>
          ← Back to Calendar
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: 'center',
  },
  
  // Enhanced Item Styles
  itemContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemText: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
  },
  expirationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expirationLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  expirationText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  
  // Enhanced Empty State
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyActionButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyActionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Enhanced Footer Buttons
  addButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  backButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PantryScreen;
