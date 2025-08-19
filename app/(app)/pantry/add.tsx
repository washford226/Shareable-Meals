import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const AddPantryItem = () => {
  const { theme } = useTheme();
  const router = useRouter();

  const [food, setFood] = useState(""); // Updated to match the database schema
  const [quantity, setQuantity] = useState(""); // Optional field
  const [unit, setUnit] = useState("");
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleAddItem = useCallback(async () => {
    // Validation
    if (!food.trim()) {
      const errorMessage = "Food name is required.";
      setError(errorMessage);
      return;
    }

    if (food.trim().length > 100) {
      const errorMessage = "Food name must be 100 characters or less.";
      setError(errorMessage);
      return;
    }

    if (quantity && isNaN(parseFloat(quantity))) {
      const errorMessage = "Quantity must be a valid number.";
      setError(errorMessage);
      return;
    }

    if (quantity && parseFloat(quantity) <= 0) {
      const errorMessage = "Quantity must be greater than 0.";
      setError(errorMessage);
      return;
    }

    if (unit.length > 50) {
      const errorMessage = "Unit must be 50 characters or less.";
      setError(errorMessage);
      return;
    }

    if (expirationDate && expirationDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      const errorMessage = "Expiration date cannot be in the past.";
      setError(errorMessage);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { error } = await supabase.from("pantry").insert([
        {
          user_id: userId,
          food: food.trim(),
          quantity: quantity ? parseFloat(quantity) : null,
          unit: unit.trim() || null,
          expiration_date: expirationDate ? expirationDate.toISOString().split("T")[0] : null,
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Pantry item added successfully!", [
        { text: "OK", onPress: () => router.push("/pantry/pantry") }
      ]);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error adding pantry item:", error);
      const errorMessage = error.message || "Failed to add pantry item. Please try again later.";
      setError(errorMessage);
      
      // Auto-retry logic for network errors (not validation errors)
      if (!error.message?.includes("authenticated") && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          handleAddItem();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [food, quantity, unit, expirationDate, retryCount, router]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    handleAddItem();
  }, [handleAddItem]);

  // Clear error when user makes changes
  const handleFoodChange = useCallback((text: string) => {
    setFood(text);
    if (error) setError(null);
  }, [error]);

  const handleQuantityChange = useCallback((text: string) => {
    setQuantity(text);
    if (error) setError(null);
  }, [error]);

  const handleUnitChange = useCallback((text: string) => {
    setUnit(text);
    if (error) setError(null);
  }, [error]);

  const handleDateChange = useCallback((event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setExpirationDate(date);
      if (error) setError(null);
    }
  }, [error]);

  // Check if form is valid
  const isFormValid = useCallback(() => {
    return food.trim().length > 0 && 
           food.trim().length <= 100 && 
           (!quantity || (!isNaN(parseFloat(quantity)) && parseFloat(quantity) > 0)) &&
           unit.length <= 50 &&
           (!expirationDate || expirationDate >= new Date(new Date().setHours(0, 0, 0, 0)));
  }, [food, quantity, unit, expirationDate]);

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
    >
      {/* Enhanced Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: theme.danger,
          shadowColor: theme.shadow,
        }]}>
          <Text style={[styles.errorBannerText, { color: theme.buttonTextPrimary }]}>
            ❌ {error}
          </Text>
          {!error.includes("authenticated") && (
            <TouchableOpacity
              style={[styles.errorBannerButton, { backgroundColor: theme.background }]}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={[styles.errorBannerButtonText, { color: theme.danger }]}>
                🔄 Retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Enhanced Retry Banner */}
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
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={[styles.title, { color: theme.text }]}>
          ➕ Add Pantry Item
        </Text>
        <Text style={[{ fontSize: 16, color: theme.textSecondary, textAlign: 'center' }]}>
          Track your ingredients and expiration dates
        </Text>
      </View>

      {/* Enhanced Food Name Section */}
      <View style={[styles.formCard, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <View style={styles.formHeader}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            🥘 Food Name *
          </Text>
          <Text style={[styles.characterCount, { color: theme.textSecondary }]}>
            {food.length}/100
          </Text>
        </View>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error && (food.length === 0 || food.length > 100) ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.background,
            }
          ]}
          placeholder="Enter food name (e.g., Milk, Chicken Breast)"
          placeholderTextColor={theme.textSecondary}
          value={food}
          onChangeText={handleFoodChange}
          maxLength={100}
        />
        {error && (food.length === 0 || food.length > 100) && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {food.length === 0 ? "Food name is required" : "Must be 100 characters or less"}
          </Text>
        )}
      </View>

      {/* Enhanced Quantity Section */}
      <View style={[styles.formCard, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>
          📊 Quantity (Optional)
        </Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error && quantity && (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.background,
            }
          ]}
          placeholder="Enter quantity (e.g., 2, 1.5)"
          placeholderTextColor={theme.textSecondary}
          keyboardType="numeric"
          value={quantity}
          onChangeText={handleQuantityChange}
        />
        {error && quantity && (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            Quantity must be a valid number greater than 0
          </Text>
        )}
      </View>

      {/* Enhanced Unit Section */}
      <View style={[styles.formCard, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <View style={styles.formHeader}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            📏 Unit (Optional)
          </Text>
          <Text style={[styles.characterCount, { color: theme.textSecondary }]}>
            {unit.length}/50
          </Text>
        </View>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error && unit.length > 50 ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.background,
            }
          ]}
          placeholder="Enter unit (e.g., grams, cups, pieces)"
          placeholderTextColor={theme.textSecondary}
          value={unit}
          onChangeText={handleUnitChange}
          maxLength={50}
        />
        {error && unit.length > 50 && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            Unit must be 50 characters or less
          </Text>
        )}
      </View>

      {/* Enhanced Expiration Date Section */}
      <View style={[styles.formCard, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>
          📅 Expiration Date (Optional)
        </Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton, 
            { 
              borderColor: error && expirationDate && expirationDate < new Date(new Date().setHours(0, 0, 0, 0)) ? theme.danger : theme.border,
              backgroundColor: theme.background,
            }
          ]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={{ color: expirationDate ? theme.text : theme.textSecondary }}>
            {expirationDate ? `📅 ${expirationDate.toDateString()}` : "📅 Select Expiration Date"}
          </Text>
        </TouchableOpacity>
        
        {expirationDate && (
          <TouchableOpacity
            style={[styles.clearDateButton, { 
              backgroundColor: theme.background,
              borderColor: theme.border,
            }]}
            onPress={() => {
              setExpirationDate(null);
              if (error) setError(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.clearDateText, { color: theme.textSecondary }]}>
              🗑️ Clear Date
            </Text>
          </TouchableOpacity>
        )}
        
        {error && expirationDate && expirationDate < new Date(new Date().setHours(0, 0, 0, 0)) && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            Expiration date cannot be in the past
          </Text>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={expirationDate || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.addButton, 
            { 
              backgroundColor: isFormValid() ? theme.primary : theme.border,
              opacity: isFormValid() ? 1 : 0.5,
              shadowColor: theme.shadow,
            }
          ]}
          onPress={handleAddItem}
          disabled={loading || !isFormValid()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonTextPrimary} />
          ) : (
            <Text style={[styles.addButtonText, { color: theme.buttonTextPrimary }]}>
              ➕ Add to Pantry
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { 
            backgroundColor: theme.background,
            borderColor: theme.border,
          }]}
          onPress={() => router.push("/pantry/pantry")}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={[styles.cancelButtonText, { color: theme.text }]}>
            ← Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
    fontWeight: '600',
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: 'center',
  },
  
  // Enhanced Form Styles
  formCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
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
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 4,
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
  },
  clearDateButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 32,
    gap: 16,
  },
  addButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AddPantryItem;
