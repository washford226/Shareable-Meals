import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image, 
  ActivityIndicator, 
  ScrollView,
  RefreshControl,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import RNPickerSelect from 'react-native-picker-select';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from 'utils/supabase';
import { Ionicons } from '@expo/vector-icons';

const dietaryOptions = [
  { label: 'None', value: 'None' },
  { label: 'Vegetarian', value: 'Vegetarian' },
  { label: 'Vegan', value: 'Vegan' },
  { label: 'Gluten-Free', value: 'Gluten-Free' },
  { label: 'Keto', value: 'Keto' },
  { label: 'Paleo', value: 'Paleo' },
];

const EditUserScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [caloriesGoal, setCaloriesGoal] = useState<string>('');
  const [proteinGoal, setProteinGoal] = useState<string>('');
  const [carbsGoal, setCarbsGoal] = useState<string>('');
  const [fatGoal, setFatGoal] = useState<string>('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setFetchingUser(true);
        setError(null);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('User not authenticated. Please log in.');
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user data:', error);
        throw new Error(error.message || 'Failed to fetch user data');
      }

      if (data) {
        setUsername(data.username || '');
        setCaloriesGoal(data.calories_goal?.toString() || '');
        setProteinGoal(data.protein_goal?.toString() || '');
        setCarbsGoal(data.carbs_goal?.toString() || '');
        setFatGoal(data.fat_goal?.toString() || '');
        setDietaryRestrictions(data.dietary_restrictions || '');
        setAllergies(data.allergies || '');
        setProfilePicture(data.profile_picture || null);
      }
      
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error?.message || 'An unexpected error occurred while fetching user data';
      setError(errorMessage);
      
      if (error?.message?.includes('not authenticated')) {
        router.replace('/login');
        return;
      }
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchUserData(isRefresh);
        }, delay);
      }
    } finally {
      setFetchingUser(false);
      setRefreshing(false);
    }
  }, [retryCount, router]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchUserData();
  }, [fetchUserData]);

  const onRefresh = useCallback(() => {
    fetchUserData(true);
  }, [fetchUserData]);

  const updateUserField = useCallback(async (fields: Record<string, any>, successMsg: string, errorMsg: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('User not authenticated.');
      }
      const userId = userData.user.id;
      
      const { error } = await supabase.from('user_profiles').update(fields).eq('id', userId);
      if (error) {
        console.error('Error updating user field:', error);
        throw new Error(error.message || errorMsg);
      }
      
      Alert.alert('Success', successMsg);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateCaloriesGoal = async () => {
    if (!caloriesGoal) {
      Alert.alert('Error', 'Please enter a valid calorie goal.');
      return;
    }
    await updateUserField(
      { calories_goal: Number(caloriesGoal) },
      'Calorie goal updated successfully!',
      'Failed to update calorie goal.'
    );
  };

  const handleUpdateProteinGoal = async () => {
    if (!proteinGoal) {
      Alert.alert('Error', 'Please enter a valid protein goal.');
      return;
    }
    await updateUserField(
      { protein_goal: Number(proteinGoal) },
      'Protein goal updated successfully!',
      'Failed to update protein goal.'
    );
  };

  const handleUpdateCarbsGoal = async () => {
    if (!carbsGoal) {
      Alert.alert('Error', 'Please enter a valid carbs goal.');
      return;
    }
    await updateUserField(
      { carbohydrates_goal: Number(carbsGoal) },
      'Carbs goal updated successfully!',
      'Failed to update carbs goal.'
    );
  };

  const handleUpdateFatGoal = async () => {
    if (!fatGoal) {
      Alert.alert('Error', 'Please enter a valid fat goal.');
      return;
    }
    await updateUserField(
      { fat_goal: Number(fatGoal) },
      'Fat goal updated successfully!',
      'Failed to update fat goal.'
    );
  };

  const handleUpdateAllergies = async () => {
    if (!allergies) {
      Alert.alert('Error', 'Please enter your allergies.');
      return;
    }
    await updateUserField(
      { allergies },
      'Allergies updated successfully!',
      'Failed to update allergies.'
    );
  };

  const handleUpdateDietaryRestrictions = async () => {
    if (!dietaryRestrictions) {
      Alert.alert('Error', 'Please select dietary restrictions.');
      return;
    }
    await updateUserField(
      { dietary_restrictions: dietaryRestrictions },
      'Dietary restrictions updated successfully!',
      'Failed to update dietary restrictions.'
    );
  };

  const handleUpdateProfilePicture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8, // Reduce quality to manage file size
        base64: true, // Get base64 for storing in database
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const asset = result.assets[0];
        
        // For now, we'll store the local URI. In production, you might want to:
        // 1. Upload to Supabase Storage and store the public URL
        // 2. Or convert to base64 and store in the bytea field
        // 3. Or implement proper image storage service
        
        await updateUserField(
          { profile_picture: asset.uri }, // Using URI for now
          'Profile picture updated successfully!',
          'Failed to update profile picture.'
        );
        setProfilePicture(asset.uri);
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Edit Profile
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading profile data...
          </Text>
        </View>
      </View>
    );
  }

  if (error && !username) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Edit Profile
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.errorContainer}>
          <View style={[styles.errorCard, { backgroundColor: theme.card }]}>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={48} color={theme.danger} />
              <Text style={[styles.errorTitle, { color: theme.text }]}>
                Failed to Load Profile
              </Text>
              <Text style={[styles.errorText, { color: theme.subtext }]}>
                {error}
              </Text>
              <TouchableOpacity 
                style={[styles.errorButton, { backgroundColor: theme.primary }]}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={16} color={theme.buttonText} />
                <Text style={[styles.errorButtonText, { color: theme.buttonText }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { backgroundColor: theme.card }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Edit Profile
        </Text>
        <View style={styles.headerActions} />
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="alert-circle" size={16} color={theme.danger} />
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
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <ActivityIndicator size="small" color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retrying... (Attempt {retryCount}/3)
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Profile Picture
            </Text>
          </View>
          <View style={styles.profilePictureContainer}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
            ) : (
              <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.border }]}>
                <Ionicons name="person" size={40} color={theme.subtext} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.changePictureButton, { backgroundColor: theme.primary }]}
              onPress={handleUpdateProfilePicture}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <>
                  <Ionicons name="camera" size={16} color={theme.buttonText} />
                  <Text style={[styles.changePictureButtonText, { color: theme.buttonText }]}>
                    Change Picture
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Nutrition Goals Card */}
        <View style={[styles.nutritionCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="fitness" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Nutrition Goals
            </Text>
          </View>

          {/* Calorie Goal */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Daily Calorie Goal
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="2000"
                placeholderTextColor={theme.placeholder}
                value={caloriesGoal}
                onChangeText={setCaloriesGoal}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateCaloriesGoal}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Protein Goal */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Protein Goal (g)
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="150"
                placeholderTextColor={theme.placeholder}
                value={proteinGoal}
                onChangeText={setProteinGoal}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateProteinGoal}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Carbs Goal */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Carbohydrates Goal (g)
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="250"
                placeholderTextColor={theme.placeholder}
                value={carbsGoal}
                onChangeText={setCarbsGoal}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateCarbsGoal}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Fat Goal */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Fat Goal (g)
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="70"
                placeholderTextColor={theme.placeholder}
                value={fatGoal}
                onChangeText={setFatGoal}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateFatGoal}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Dietary Preferences Card */}
        <View style={[styles.dietaryCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="leaf" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Dietary Preferences
            </Text>
          </View>

          {/* Dietary Restrictions */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Dietary Restrictions
            </Text>
            <View style={styles.pickerContainer}>
              <RNPickerSelect
                onValueChange={(value) => setDietaryRestrictions(value)}
                items={dietaryOptions}
                placeholder={{
                  label: 'Select Dietary Restrictions',
                  value: null,
                }}
                style={{
                  inputIOS: [styles.pickerInput, { color: theme.text }],
                  inputAndroid: [styles.pickerInput, { color: theme.text }],
                }}
                value={dietaryRestrictions}
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateDietaryRestrictions}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Allergies */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Allergies
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="e.g., nuts, dairy, shellfish"
                placeholderTextColor={theme.placeholder}
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateAllergies}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Account Settings Card */}
        <View style={[styles.accountCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Account Settings
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.accountButton, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => router.push('/account/edit-email')}
          >
            <Ionicons name="mail" size={20} color={theme.text} />
            <Text style={[styles.accountButtonText, { color: theme.text }]}>
              Edit Email & Password
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    width: 40,
    height: 40,
  },

  // Banner Styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Content Styles
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  // Card Styles
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  nutritionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  dietaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  accountCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Profile Picture Styles
  profilePictureContainer: {
    alignItems: 'center',
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  profilePicturePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  changePictureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  changePictureButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Input Styles
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 14,
  },

  // Account Button Styles
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  accountButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 300,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  errorContent: {
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Legacy styles (keeping for compatibility)
  navigationButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    alignSelf: 'flex-start',
  },
  usernameText: {
    fontSize: 16,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    width: '100%',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  profilePicturePlaceholderText: {
    fontSize: 16,
  },
});

export default EditUserScreen;
