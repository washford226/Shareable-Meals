import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Dimensions,
  Animated,
  RefreshControl,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import { testStorageBucket } from '../../../utils/testStorage';
import { uploadProfileImage } from '../../../utils/profileImageUtils';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SettingsItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'navigation' | 'toggle';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

interface UserData {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  username?: string;
  profile_picture?: string;
}

interface UserStats {
  mealsCreated: number;
  daysPlanned: number;
}

export default function ProfilePage() {
  const { theme, themeVariant, fontFamily, fontSize, setThemeVariant, setFontFamily, setFontSize, isLightCategory, isDarkCategory } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    mealsCreated: 0,
    daysPlanned: 0,
  });
  const [imageLoadError, setImageLoadError] = useState(false);

  // Calculate tab bar height for proper content padding
  const tabBarHeight = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10) + (Platform.OS === 'ios' ? 65 : 60);

  const handleUploadProfilePicture = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        if (!userData?.id) {
          Alert.alert('Error', 'User ID not found');
          return;
        }

        // Show loading state
        setLoading(true);

        // Upload to Supabase Storage
        const uploadedUrl = await uploadProfileImage(userData.id, imageUri);
        
        setLoading(false);
        
        if (uploadedUrl) {
          // Update local state
          setUserData(prev => prev ? {
            ...prev,
            profile_picture: uploadedUrl
          } : null);
          
          // Reset image load error state
          setImageLoadError(false);
          
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to upload profile picture. Please check your internet connection and try again.');
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to view your profile.");
        return;
      }

      // Fetch user profile data from user_profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('username, profile_picture_url')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      // Set user data
      const userInfo: UserData = {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || 'User',
        avatar_url: user.user_metadata?.avatar_url,
        created_at: user.created_at,
        username: profileData?.username || 'User',
        profile_picture: profileData?.profile_picture_url || undefined,
      };
      setUserData(userInfo);

      // Calculate user statistics
      await calculateUserStats(user.id);

    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateUserStats = async (userId: string) => {
    try {
      // Get total meals created by user
      const { data: userMeals, error: mealsError } = await supabase
        .from('meals')
        .select('id, calories, created_at')
        .eq('user_id', userId);

      if (mealsError) {
        console.error('Error fetching meals:', mealsError);
      }

      // Get meal plan data to count planned days
      const { data: mealPlans, error: plansError } = await supabase
        .from('meal_plan')
        .select('date')
        .eq('user_id', userId);

      if (plansError) {
        console.error('Error fetching meal plans:', plansError);
      }

      // Calculate statistics
      const mealsCreated = userMeals?.length || 0;

      // Get unique days planned
      const uniqueDays = new Set(mealPlans?.map(plan => plan.date) || []);
      const daysPlanned = uniqueDays.size;

      const stats: UserStats = {
        mealsCreated,
        daysPlanned,
      };

      setUserStats(stats);
    } catch (error) {
      console.error('Error calculating user stats:', error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  }, [fetchUserData]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                Alert.alert('Error', 'Failed to sign out');
                console.error('Sign out error:', error);
              } else {
                // Navigate to auth screen
                router.replace('/(auth)/login');
              }
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: Account deletion would require careful implementation
              // to remove all user data from all tables
              Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const settingsData: SettingsItem[] = [
    // Appearance & Themes
    {
      id: 'theme-settings',
      title: 'Theme & Appearance',
      subtitle: `${themeVariant.charAt(0).toUpperCase() + themeVariant.slice(1)} theme, ${fontFamily} font, ${fontSize} size`,
      icon: 'color-palette',
      type: 'navigation',
      onPress: () => {
        router.push('/(main)/account/theme-settings' as any);
      },
    },
    // Account & Data
    {
      id: 'edit-profile',
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      icon: 'person-circle',
      type: 'navigation',
      onPress: () => {
        router.push('/(main)/account/edit-profile' as any);
      },
    },
    {
      id: 'edit-email-password',
      title: 'Email & Password',
      subtitle: 'Change your email and password',
      icon: 'key',
      type: 'navigation',
      onPress: () => {
        router.push('/(main)/account/edit-email' as any);
      },
    },
    {
      id: 'subscription',
      title: 'Premium Subscription',
      subtitle: 'Manage your premium features',
      icon: 'diamond',
      type: 'navigation',
      onPress: async () => {
        try {
          // For iOS, this would typically open the App Store subscription management
          // For Android, it would open Google Play subscription management
          if (Platform.OS === 'ios') {
            const url = 'https://apps.apple.com/account/subscriptions';
            const supported = await Linking.canOpenURL(url);
            if (supported) {
              await Linking.openURL(url);
            } else {
              Alert.alert('Error', 'Unable to open subscription management');
            }
          } else {
            // Android Play Store subscriptions
            const url = 'https://play.google.com/store/account/subscriptions';
            const supported = await Linking.canOpenURL(url);
            if (supported) {
              await Linking.openURL(url);
            } else {
              Alert.alert('Error', 'Unable to open subscription management');
            }
          }
        } catch (error) {
          console.error('Error opening subscription management:', error);
          Alert.alert('Error', 'Unable to open subscription management');
        }
      },
    },
    {
      id: 'privacy',
      title: 'Privacy & Data',
      subtitle: 'View our privacy policy',
      icon: 'shield-checkmark',
      type: 'navigation',
      onPress: async () => {
        try {
          const url = 'https://www.shareablemeals.com/privacy';
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
          } else {
            Alert.alert('Error', 'Unable to open privacy policy');
          }
        } catch (error) {
          console.error('Error opening privacy policy:', error);
          Alert.alert('Error', 'Unable to open privacy policy');
        }
      },
    },
    {
      id: 'support',
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      icon: 'help-circle',
      type: 'navigation',
      onPress: async () => {
        try {
          const url = 'https://www.shareablemeals.com/support';
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
          } else {
            Alert.alert('Error', 'Unable to open support page');
          }
        } catch (error) {
          console.error('Error opening support page:', error);
          Alert.alert('Error', 'Unable to open support page');
        }
      },
    },
    {
      id: 'about',
      title: 'About',
      subtitle: 'App version and information',
      icon: 'information-circle',
      type: 'navigation',
      onPress: async () => {
        Alert.alert(
          'About Shareable Meals', 
          'Version 1.0.4\n\nDeveloped for meal planning and nutrition tracking.\n\nVisit shareablemeals.com for more information.',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Visit Website', 
              style: 'default',
              onPress: async () => {
                try {
                  const url = 'https://www.shareablemeals.com';
                  const supported = await Linking.canOpenURL(url);
                  if (supported) {
                    await Linking.openURL(url);
                  }
                } catch (error) {
                  console.error('Error opening website:', error);
                }
              }
            }
          ]
        );
      },
    },
  ];

  const renderSettingsItem = (item: SettingsItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.settingsItem, { backgroundColor: theme.card }]}
      onPress={item.onPress}
      disabled={item.type === 'toggle'}
      activeOpacity={item.type === 'toggle' ? 1 : 0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.cardSecondary }]}>
        <Ionicons name={item.icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: theme.text, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
          {item.title}
        </Text>
        {item.subtitle && (
          <Text style={[styles.itemSubtitle, { color: theme.textSecondary, fontSize: theme.fonts.footnote, fontFamily: theme.fontFamily.body }]}>
            {item.subtitle}
          </Text>
        )}
      </View>
      {item.type === 'toggle' ? (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={theme.card}
        />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary, fontSize: theme.fonts.body, fontFamily: theme.fontFamily.body }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text, fontSize: theme.fonts.largeTitle, fontFamily: theme.fontFamily.heading }]}>
            Profile
          </Text>
        </View>

        {/* User Info */}
        <View style={[styles.userCard, { backgroundColor: theme.card }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            {userData?.profile_picture && !imageLoadError ? (
              <Image 
                source={{ uri: userData.profile_picture }} 
                style={styles.avatarImage}
                onError={(error) => {
                  console.log('Failed to load profile picture:', error.nativeEvent.error);
                  setImageLoadError(true);
                }}
                onLoad={() => {
                  setImageLoadError(false);
                }}
              />
            ) : (
              <Ionicons name="person" size={32} color={theme.buttonTextPrimary} />
            )}
            {loading && (
              <View style={[styles.loadingOverlay, { backgroundColor: theme.background + '80' }]}>
                <Ionicons name="cloud-upload" size={24} color={theme.primary} />
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.text, fontSize: theme.fonts.title2, fontFamily: theme.fontFamily.heading }]}>
              {userData?.username || 'User'}
            </Text>
            <Text style={[styles.userEmail, { color: theme.textSecondary, fontSize: theme.fonts.body, fontFamily: theme.fontFamily.body }]}>
              {userData?.email || 'No email'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              Alert.alert(
                'Update Profile Picture',
                'Choose an option',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Change Picture', 
                    onPress: handleUploadProfilePicture 
                  }
                ]
              );
            }}
            disabled={loading}
          >
            <Ionicons name="pencil" size={16} color={loading ? theme.textSecondary : theme.text} />
          </TouchableOpacity>
        </View>

        {/* Enhanced Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statItem, { backgroundColor: theme.card }]}>
            <View style={[styles.statIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="restaurant" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.statNumber, { color: theme.text, fontSize: theme.fonts.title1, fontFamily: theme.fontFamily.heading }]}>
              {userStats.mealsCreated}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary, fontSize: theme.fonts.caption, fontFamily: theme.fontFamily.body }]}>
              Meals Created
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: theme.card }]}>
            <View style={[styles.statIcon, { backgroundColor: theme.success + '20' }]}>
              <Ionicons name="calendar" size={20} color={theme.success} />
            </View>
            <Text style={[styles.statNumber, { color: theme.text, fontSize: theme.fonts.title1, fontFamily: theme.fontFamily.heading }]}>
              {userStats.daysPlanned}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary, fontSize: theme.fonts.caption, fontFamily: theme.fontFamily.body }]}>
              Days Planned
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsContainer}>
          {settingsData.map(renderSettingsItem)}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: theme.card }]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out" size={20} color={theme.danger} />
            <Text style={[styles.dangerText, { color: theme.danger, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: theme.card }]}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash" size={20} color={theme.danger} />
            <Text style={[styles.dangerText, { color: theme.danger, fontSize: theme.fonts.callout, fontFamily: theme.fontFamily.body }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontFamily: theme.fontFamily.bold,
    ...theme.fonts.largeTitle,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: theme.fontFamily.semiBold,
    ...theme.fonts.headline,
    marginBottom: 4,
  },
  userEmail: {
    ...theme.fonts.subheadline,
  },
  editButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 12,
    justifyContent: 'space-evenly',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  statNumber: {
    fontFamily: theme.fontFamily.bold,
    ...theme.fonts.title,
    marginBottom: 4,
  },
  statLabel: {
    textAlign: 'center',
    ...theme.fonts.subheadline,
  },
  settingsContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: theme.fontFamily.medium,
    ...theme.fonts.body,
    marginBottom: 2,
  },
  itemSubtitle: {
    ...theme.fonts.caption,
  },
  dangerZone: {
    marginHorizontal: 20,
    marginBottom: 40,
    gap: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  dangerText: {
    fontFamily: theme.fontFamily.medium,
    ...theme.fonts.body,
  },
  // Enhanced stat styles
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...theme.fonts.body,
  },
});