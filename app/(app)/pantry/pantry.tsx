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
    id: number;
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
  const deletePantryItem = useCallback(async (id: number) => {
    try {
      setDeletingId(id);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { error } = await supabase
        .from("pantry")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      // Optimistic update - remove item from local state immediately
      setPantryItems(prev => prev.filter(item => item.id !== id));
      
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
            backgroundColor: `${theme.danger}15`, 
            borderColor: theme.danger 
          }]}>
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
        {retryCount > 0 && (
          <View style={[styles.retryBanner, { 
            backgroundColor: `${theme.warning}15`, 
            borderColor: theme.warning 
          }]}>
            <Text style={[styles.retryBannerText, { color: theme.warning }]}>
              Retry attempt {retryCount}/3
            </Text>
          </View>
        )}

        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading your pantry...
          </Text>
          
          {error && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                Try Again
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
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
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
      {retryCount > 0 && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>My Pantry</Text>
      
      <FlatList
        data={pantryItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const expirationStatus = getExpirationStatus(item.expiration_date);
          const isDeleting = deletingId === item.id;
          
          return (
            <View style={[
              styles.itemContainer, 
              { backgroundColor: theme.card },
              expirationStatus === 'expired' && { borderColor: theme.danger, borderWidth: 2 },
              expirationStatus === 'expiring' && { borderColor: theme.warning, borderWidth: 2 }
            ]}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemText, { color: theme.text }]}>
                  {item.food}
                </Text>
                {expirationStatus === 'expired' && (
                  <View style={[styles.statusBadge, { backgroundColor: theme.danger }]}>
                    <Text style={[styles.statusText, { color: theme.buttonText }]}>EXPIRED</Text>
                  </View>
                )}
                {expirationStatus === 'expiring' && (
                  <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
                    <Text style={[styles.statusText, { color: theme.buttonText }]}>EXPIRING</Text>
                  </View>
                )}
              </View>
              
              {(item.quantity !== null || item.unit) && (
                <Text style={[styles.quantityText, { color: theme.subtext }]}>
                  Quantity: {item.quantity ?? ""} {item.unit || ""}
                </Text>
              )}
              
              {item.expiration_date && (
                <Text style={[
                  styles.expirationText, 
                  { 
                    color: expirationStatus === 'expired' ? theme.danger :
                           expirationStatus === 'expiring' ? theme.warning : theme.subtext 
                  }
                ]}>
                  Expires: {new Date(item.expiration_date).toLocaleDateString()}
                </Text>
              )}
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.primary }]}
                  onPress={() => router.push(`/pantry/${item.id}/edit`)}
                  disabled={isDeleting}
                >
                  <Text style={[styles.editButtonText, { color: theme.buttonText }]}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.deleteButton, 
                    { backgroundColor: theme.danger, opacity: isDeleting ? 0.5 : 1 }
                  ]}
                  onPress={() =>
                    Alert.alert(
                      "Delete Item",
                      `Are you sure you want to delete "${item.food}"?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", onPress: () => deletePantryItem(item.id), style: "destructive" },
                      ]
                    )
                  }
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={theme.buttonText} />
                  ) : (
                    <Text style={[styles.deleteButtonText, { color: theme.buttonText }]}>Delete</Text>
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
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              {error ? "Unable to load pantry items" : "Your pantry is empty. Add some items!"}
            </Text>
            {!error && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={() => router.push("/pantry/add")}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Add First Item
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/pantry/add")}
      >
        <Text style={[styles.addButtonText, { color: theme.buttonText }]}>Add Item</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.button }]}
        onPress={() => router.push("/meal-plan/calendar")}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  itemContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 14,
    marginBottom: 4,
  },
  expirationText: {
    fontSize: 14,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  addButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
  editButton: {
    flex: 1,
    marginRight: 8,
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default PantryScreen;
