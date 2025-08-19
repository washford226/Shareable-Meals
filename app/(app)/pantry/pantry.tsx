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
  Modal,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { checkScannerUsage, incrementScannerUsage, getScannerUsageStatus } from '../../../utils/aiUsageUtils';

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
  
  // Camera scanning states
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanningItems, setScanningItems] = useState(false);
  const [detectedItems, setDetectedItems] = useState<string[]>([]);
  const [scannerUsage, setScannerUsage] = useState<{ used: number; remaining: number; total: number } | null>(null);

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

  // Load scanner usage status
  const loadScannerUsage = useCallback(async () => {
    const usage = await getScannerUsageStatus();
    setScannerUsage(usage);
  }, []);

  // Camera functionality for pantry scanning
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
      console.log(`Resized image size: ${Math.round(base64.length * 0.75 / 1024)} KB`);
      
      return base64;
    } catch (error) {
      console.error('Error resizing image:', error);
      throw new Error('Failed to process image. Please try again.');
    }
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera permissions to scan pantry items.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const openCameraForPantryScan = async () => {
    // Check usage limit first
    const usageCheck = await checkScannerUsage();
    if (!usageCheck.canUse) {
      Alert.alert(
        'Scanner Limit Reached',
        usageCheck.message || 'You have reached your daily scanner limit.',
        [{ text: 'OK' }]
      );
      return;
    }

    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

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
          await scanPantryImage(processedBase64);
        }
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const scanPantryImage = async (base64Image: string) => {
    setScanningItems(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log(`Scanning image - Size: ${Math.round(base64Image.length * 0.75 / 1024)} KB`);

      // Create timeout promise
      const timeout = (ms: number) => 
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out - please try again')), ms)
        );

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch('https://zcnavyhdotofxjkxgcyl.supabase.co/functions/v1/Pantry_Scanner', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            image: base64Image,
          }),
        }),
        timeout(15000) // 15 second timeout
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.added) {
        // Increment usage count on successful scan
        await incrementScannerUsage();
        // Update local usage display
        await loadScannerUsage();
        
        setDetectedItems(result.added);
        setScanModalVisible(true);
        // Refresh the pantry list to show new items
        fetchPantryItems(false);
        console.log(`Successfully detected ${result.added.length} items`);
      } else {
        throw new Error(result.error || 'Failed to scan image');
      }
    } catch (error) {
      console.error('Error scanning pantry image:', error);
      Alert.alert(
        'Scan Failed',
        error instanceof Error ? error.message : 'Failed to scan pantry items. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setScanningItems(false);
    }
  };

  useEffect(() => {
    fetchPantryItems();
    loadScannerUsage();
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
      <View style={[styles.headerContainer, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
        <View style={styles.headerContent}>
          <View style={[styles.pantryIconContainer, { backgroundColor: theme.primaryLight }]}>
            <Text style={styles.pantryHeaderIcon}>🥫</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, { color: theme.text }]}>
              My Pantry
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Track your ingredients and expiration dates
            </Text>
          </View>
        </View>
        
        {scannerUsage && (
          <View style={[styles.usageIndicator, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="camera" size={16} color={theme.primary} />
            <Text style={[styles.usageIndicatorText, { color: theme.text }]}>
              {scannerUsage.remaining}/{scannerUsage.total} scans left
            </Text>
          </View>
        )}
      </View>
      
      <FlatList
        data={pantryItems.filter(item => item.pantry_id && typeof item.pantry_id === 'number')}
        keyExtractor={(item, index) => item.pantry_id ? item.pantry_id.toString() : `pantry-item-${index}`}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
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
                  <View style={styles.itemTitleContainer}>
                    <View style={[styles.itemIconBadge, { backgroundColor: theme.primaryLight }]}>
                      <Text style={styles.itemIconEmoji}>🥘</Text>
                    </View>
                    <Text style={[styles.itemText, { color: theme.text }]}>
                      {item.food}
                    </Text>
                  </View>
                  {(item.quantity !== null || item.unit) && (
                    <View style={styles.quantityContainer}>
                      <Ionicons name="scale-outline" size={14} color={theme.textSecondary} />
                      <Text style={[styles.quantityText, { color: theme.textSecondary }]}>
                        {item.quantity ?? ""} {item.unit || ""}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.statusContainer}>
                  {expirationStatus === 'expired' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.danger }]}>
                      <Ionicons name="alert-circle" size={12} color={theme.buttonTextPrimary} />
                      <Text style={[styles.statusText, { color: theme.buttonTextPrimary }]}>EXPIRED</Text>
                    </View>
                  )}
                  {expirationStatus === 'expiring' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
                      <Ionicons name="warning" size={12} color={theme.buttonTextPrimary} />
                      <Text style={[styles.statusText, { color: theme.buttonTextPrimary }]}>EXPIRING</Text>
                    </View>
                  )}
                  {expirationStatus === 'fresh' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.success }]}>
                      <Ionicons name="leaf" size={12} color={theme.buttonTextPrimary} />
                      <Text style={[styles.statusText, { color: theme.buttonTextPrimary }]}>FRESH</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {item.expiration_date && (
                <View style={styles.expirationContainer}>
                  <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
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
      
      {/* Action buttons container */}
      <View style={styles.actionButtonsContainer}>
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
          style={[
            styles.scanButton, 
            { 
              backgroundColor: scanningItems ? theme.successLight : theme.success,
              borderColor: theme.success,
              borderWidth: 2,
              opacity: scanningItems || (scannerUsage?.remaining === 0) ? 0.7 : 1
            }
          ]}
          onPress={openCameraForPantryScan}
          disabled={scanningItems || (scannerUsage?.remaining === 0)}
          activeOpacity={0.8}
        >
          <View style={styles.scanButtonWrapper}>
            {scanningItems ? (
              <>
                <ActivityIndicator size="small" color={theme.success} />
                <Text style={[styles.scanButtonProcessing, { color: theme.success }]}>
                  Analyzing...
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.scanIconContainer, { backgroundColor: theme.buttonTextPrimary }]}>
                  <Ionicons name="camera" size={18} color={theme.success} />
                  <Ionicons name="sparkles" size={12} color={theme.success} style={styles.aiSparkle} />
                </View>
                <View style={styles.scanButtonContent}>
                  <Text style={[styles.scanButtonText, { color: theme.buttonTextPrimary, fontSize: 15 }]}>
                    AI Scanner
                  </Text>
                  {scannerUsage && (
                    <View style={[styles.usageContainer, { backgroundColor: theme.buttonTextPrimary }]}>
                      <Text style={[styles.usageText, { color: theme.success }]}>
                        {scannerUsage.remaining}/{scannerUsage.total} left
                      </Text>
                    </View>
                  )}
                  {scannerUsage?.remaining === 0 && (
                    <Text style={[styles.limitReachedText, { color: theme.danger }]}>
                      Daily limit reached
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Enhanced Scan Results Modal */}
      <Modal
        visible={scanModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setScanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.enhancedModalContainer, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.scanSuccessIcon, { backgroundColor: theme.success }]}>
                <Ionicons name="checkmark" size={24} color={theme.buttonTextPrimary} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                🎉 Items Successfully Added!
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                AI detected and added {detectedItems.length} items to your pantry
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setScanModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={[styles.detectedItemsContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.detectedItemsTitle, { color: theme.text }]}>
                  Detected Items:
                </Text>
                
                {detectedItems.map((item, index) => (
                  <View
                    key={index}
                    style={[styles.enhancedDetectedItemRow, { 
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    }]}
                  >
                    <View style={styles.itemIconContainer}>
                      <Text style={styles.itemEmoji}>🥘</Text>
                    </View>
                    <Text style={[styles.detectedItemText, { color: theme.text }]}>
                      {item}
                    </Text>
                    <View style={[styles.checkmarkContainer, { backgroundColor: theme.successLight }]}>
                      <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                    </View>
                  </View>
                ))}
              </View>
              
              <View style={[styles.scanSuccessMessage, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
                <Ionicons name="information-circle" size={20} color={theme.success} />
                <Text style={[styles.scanSuccessText, { color: theme.success }]}>
                  All items have been automatically added to your pantry with default quantities. You can edit them individually if needed.
                </Text>
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.enhancedModalButton, { 
                  backgroundColor: theme.primary,
                  shadowColor: theme.shadow,
                }]}
                onPress={() => setScanModalVisible(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={20} color={theme.buttonTextPrimary} style={{ marginRight: 8 }} />
                <Text style={[styles.addAllButtonText, { color: theme.buttonTextPrimary }]}>
                  Perfect!
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    paddingTop: 45, // Add top padding to avoid status bar overlap
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Enhanced header styles
  headerContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pantryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  pantryHeaderIcon: {
    fontSize: 24,
  },
  headerTextContainer: {
    flex: 1,
  },
  usageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  usageIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
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
  itemTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  itemIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconEmoji: {
    fontSize: 16,
  },
  itemText: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
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
    gap: 6,
  },
  expirationLabel: {
    fontSize: 14,
    fontWeight: '500',
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
    flex: 1,
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
  
  // Camera scanning styles
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scanButtonContent: {
    alignItems: 'center',
  },
  usageText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.8,
  },
  detectedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  detectedItemText: {
    fontSize: 16,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Enhanced scanner button styles
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
  // Enhanced modal styles
  enhancedModalContainer: {
    width: '95%',
    maxHeight: '85%',
    borderRadius: 20,
    padding: 24,
    elevation: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  scanSuccessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  detectedItemsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  detectedItemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  enhancedDetectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: {
    fontSize: 18,
  },
  checkmarkContainer: {
    padding: 4,
    borderRadius: 12,
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
  enhancedModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default PantryScreen;
