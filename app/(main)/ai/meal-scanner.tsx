import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useRevenueCat } from '../../../context/RevenueCatContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../utils/supabase';
import { Paywall } from '../../../components/Paywall';
import { 
  checkScannerUsage, 
  incrementScannerUsage, 
  getScannerUsageStatus 
} from '../../../utils/aiUsageUtils';

export default function MealScannerPage() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { isPremium } = useRevenueCat();
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [usageStatus, setUsageStatus] = useState<{ used: number; remaining: number; total: number } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Load scanner usage status
  const loadUsageStatus = async () => {
    try {
      const status = await getScannerUsageStatus();
      setUsageStatus(status);
    } catch (error) {
      console.error('Error loading scanner usage status:', error);
    }
  };

  // Load usage status on component mount
  useEffect(() => {
    loadUsageStatus();
  }, []);

  const requestCameraPermission = async () => {
    if (!permission) {
      return await requestPermission();
    }
    
    if (!permission.granted) {
      Alert.alert(
        'Camera Permission Required',
        'This app needs camera access to scan meals. Please grant permission in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Permission', onPress: requestPermission },
        ]
      );
      return false;
    }
    
    return true;
  };

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  const analyzeMealImage = async (imageUri: string) => {
    // Check if user has premium access first
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    // Check scanner usage limits for premium users (5 uses per day)
    const usageCheck = await checkScannerUsage();
    if (!usageCheck.canUse) {
      Alert.alert(
        "Daily Limit Reached", 
        usageCheck.message || "You have reached your daily scanner limit of 5 uses.",
        [
          { text: "OK", style: "default" }
        ]
      );
      return;
    }

    setAnalyzing(true);
    try {
      // Convert image to base64
      const base64Image = await convertImageToBase64(imageUri);
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'You must be logged in to scan meals');
        return;
      }

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('Meal_Scanner', {
        body: {
          image: base64Image,
          meal_date: new Date().toISOString().split('T')[0], // Today's date
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.data) {
        // Increment usage count after successful scan (for all premium users)
        await incrementScannerUsage();
        // Reload usage status to update UI
        await loadUsageStatus();

        const macros = data.data;
        Alert.alert(
          'Meal Analyzed Successfully!',
          `${macros.meal_name || 'Meal'}\n\n` +
          `Calories: ${macros.calories}\n` +
          `Protein: ${macros.protein}g\n` +
          `Carbs: ${macros.carbs}g\n` +
          `Fat: ${macros.fat}g\n\n` +
          `This meal has been saved to your macro tracker.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCapturedImage(null);
                setShowCamera(false);
              }
            }
          ]
        );
      } else {
        throw new Error('No data received from analysis');
      }
    } catch (error: any) {
      console.error('Error analyzing meal:', error);
      Alert.alert(
        'Analysis Failed',
        error.message || 'Failed to analyze the meal. Please try again.',
        [
          { text: 'Retry', onPress: () => analyzeMealImage(imageUri) },
          { text: 'Cancel', onPress: () => setCapturedImage(null) }
        ]
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    try {
      setScanning(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      if (photo?.uri) {
        setCapturedImage(photo.uri);
        setShowCamera(false);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setScanning(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to select images'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleScanMeal = async () => {
    // Check if user has premium access
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      setShowCamera(true);
    }
  };

  const handleGallerySelect = async () => {
    // Check if user has premium access
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
    }
  };

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
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: theme.text }]}>
            AI Meal Scanner
          </Text>
          {/* Usage Counter for Premium Users */}
          {isPremium && usageStatus && (
            <View style={[styles.usageCounter, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="scan" size={14} color={theme.primary} />
              <Text style={[styles.usageText, { color: theme.textSecondary }]}>
                {usageStatus.remaining} of {usageStatus.total} scans left today
              </Text>
            </View>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Usage Status Card for Premium Users */}
        {isPremium && usageStatus && (
          <View style={[styles.usageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.usageCardHeader}>
              <Ionicons name="scan" size={20} color={theme.primary} />
              <Text style={[styles.usageCardTitle, { color: theme.text }]}>
                Daily Scanner Usage
              </Text>
            </View>
            <View style={styles.usageCardContent}>
              <Text style={[styles.usageCardText, { color: theme.textSecondary }]}>
                You have <Text style={[styles.usageCardHighlight, { color: theme.primary }]}>{usageStatus.remaining}</Text> out of {usageStatus.total} scans remaining today
              </Text>
              <View style={[styles.usageProgressBar, { backgroundColor: theme.cardSecondary }]}>
                <View 
                  style={[
                    styles.usageProgressFill, 
                    { 
                      backgroundColor: theme.primary,
                      width: `${(usageStatus.used / usageStatus.total) * 100}%`
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        )}

        <View style={[styles.scanArea, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="camera" size={64} color={theme.textSecondary} />
          <Text style={[styles.scanTitle, { color: theme.text }]}>
            Scan Your Meal
          </Text>
          <Text style={[styles.scanDescription, { color: theme.textSecondary }]}>
            Point your camera at any meal to get instant nutrition analysis and calorie counting
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.scanButton,
            { backgroundColor: theme.primary },
            scanning && { opacity: 0.7 },
          ]}
          onPress={handleScanMeal}
          disabled={scanning}
        >
          <Ionicons
            name={scanning ? "hourglass" : "camera"}
            size={24}
            color={theme.buttonTextPrimary}
          />
          <Text style={[styles.scanButtonText, { color: theme.buttonTextPrimary }]}>
            {scanning ? 'Opening Camera...' : 'Take Photo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.galleryButton,
            { backgroundColor: theme.cardSecondary, borderColor: theme.border },
          ]}
          onPress={handleGallerySelect}
        >
          <Ionicons name="images" size={24} color={theme.text} />
          <Text style={[styles.galleryButtonText, { color: theme.text }]}>
            Choose from Gallery
          </Text>
        </TouchableOpacity>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="nutrition" size={24} color={theme.primary} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              Nutrition Analysis
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="calculator" size={24} color={theme.success} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              Calorie Counting
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flash" size={24} color={theme.warning} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              Instant Results
            </Text>
          </View>
        </View>
      </View>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          {permission?.granted ? (
            <>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
              />
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={[styles.cameraButton, { backgroundColor: theme.danger }]}
                  onPress={() => setShowCamera(false)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.captureButton, { backgroundColor: theme.primary }]}
                  onPress={takePicture}
                  disabled={scanning}
                >
                  {scanning ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="camera" size={32} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cameraButton, { backgroundColor: theme.cardSecondary }]}
                  onPress={handleGallerySelect}
                >
                  <Ionicons name="images" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.permissionContainer}>
              <Text style={[styles.permissionText, { color: theme.text }]}>
                Camera permission is required to scan meals
              </Text>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: theme.primary }]}
                onPress={requestCameraPermission}
              >
                <Text style={[styles.permissionButtonText, { color: theme.buttonTextPrimary }]}>
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={!!capturedImage} animationType="slide">
        <View style={[styles.previewContainer, { backgroundColor: theme.background }]}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCapturedImage(null)}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: theme.text }]}>
              Analyze Meal
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          )}

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.retakeButton, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}
              onPress={() => {
                setCapturedImage(null);
                setShowCamera(true);
              }}
            >
              <Ionicons name="camera" size={20} color={theme.text} />
              <Text style={[styles.retakeButtonText, { color: theme.text }]}>
                Retake
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.analyzeButton,
                { backgroundColor: theme.primary },
                analyzing && { opacity: 0.7 },
              ]}
              onPress={() => capturedImage && analyzeMealImage(capturedImage)}
              disabled={analyzing || !capturedImage}
            >
              {analyzing ? (
                <ActivityIndicator size="small" color={theme.buttonTextPrimary} />
              ) : (
                <Ionicons name="analytics" size={20} color={theme.buttonTextPrimary} />
              )}
              <Text style={[styles.analyzeButtonText, { color: theme.buttonTextPrimary }]}>
                {analyzing ? 'Analyzing...' : 'Analyze Meal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Paywall Modal */}
      <Paywall 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)}
        feature="Meal Scanner"
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  usageCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  usageText: {
    fontSize: theme.fonts.tiny,
    fontFamily: theme.fontFamily.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  usageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  usageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  usageCardTitle: {
    fontSize: theme.fonts.headline,
    fontFamily: theme.fontFamily.heading,
  },
  usageCardContent: {
    gap: 8,
  },
  usageCardText: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
  },
  usageCardHighlight: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.heading,
    fontWeight: '600',
  },
  usageProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  scanArea: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 32,
  },
  scanTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.heading,
    marginTop: 16,
    marginBottom: 8,
  },
  scanDescription: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
    gap: 8,
  },
  scanButtonText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
    gap: 8,
    borderWidth: 1,
  },
  galleryButtonText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
  featuresContainer: {
    gap: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
  },
  // Camera Modal Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  cameraButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
  // Preview Modal Styles
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  previewTitle: {
    fontSize: theme.fonts.large,
    fontFamily: theme.fontFamily.heading,
  },
  previewImage: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  retakeButtonText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
  analyzeButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  analyzeButtonText: {
    fontSize: theme.fonts.medium,
    fontFamily: theme.fontFamily.heading,
  },
});