import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Image, 
  Switch, 
  StyleSheet, 
  ActivityIndicator,
  ScrollView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import BottomNav from 'components/bottomNav';
import { useRouter } from 'expo-router';
import { supabase } from 'utils/supabase';
import { cachedDataService } from 'utils/cachedDataService';
import CacheDebugComponent from 'components/CacheDebugComponent';

const AccountScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [caloriesGoal, setCaloriesGoal] = useState<number | null>(null);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [navigationLoading, setNavigationLoading] = useState<string | null>(null);
  const [showCacheDebug, setShowCacheDebug] = useState<boolean>(false);

  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw new Error(`Authentication error: ${userError.message}`);
      }
      
      if (!userData?.user) {
        throw new Error('No authenticated user found');
      }
      
      const userId = userData.user.id;

      // Use cached data service for faster loading
      const data = await cachedDataService.getUserProfile(userId);

      if (!data) {
        throw new Error('User profile not found');
      }

      // Set user data with fallback values
      setUsername(data.username || 'Unknown User');
      setCaloriesGoal(data.calories_goal);
      setDietaryRestrictions(data.dietary_restrictions || 'None specified');
      setEmail(userData.user.email || 'No email provided');
      setAllergies(data.allergies || 'None specified');
      
      // Handle profile picture - convert hex bytes to string if needed
      let profilePictureUri = data.profile_picture;
      if (profilePictureUri && typeof profilePictureUri === 'string' && profilePictureUri.startsWith('\\x')) {
        // Convert hex bytes back to string
        const hexString = profilePictureUri.slice(2); // Remove \x prefix
        const bytes = hexString.match(/.{1,2}/g) || [];
        profilePictureUri = bytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
      }
      
      setProfilePicture(profilePictureUri);
      setIsAdmin(data.is_admin || false);
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // If authentication error, redirect to login
      if (errorMessage.includes('Authentication') || errorMessage.includes('No authenticated user')) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]);
      } else {
        Alert.alert('Error', `Failed to load user data: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleLogout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(`Logout failed: ${error.message}`);
      }
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to logout';
      Alert.alert('Logout Error', errorMessage);
    }
  }, [router]);

  const handleNavigation = useCallback((path: string, label: string) => {
    setNavigationLoading(label);
    // Navigate immediately without waiting
    router.push(path as any);
    // Clear loading state after a short delay for visual feedback
    setTimeout(() => setNavigationLoading(null), 300);
  }, [router]);

  const handleDeleteAccount = useCallback(async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Get current user
              const { data: userData, error: userError } = await supabase.auth.getUser();
              if (userError) {
                throw new Error(`Authentication error: ${userError.message}`);
              }
              
              if (!userData?.user) {
                throw new Error('No authenticated user found');
              }
              
              const userId = userData.user.id;

              // Call the edge function to delete both user profile and auth user
              const { data, error } = await supabase.functions.invoke('Delete_User', {
                body: { user_id: userId },
              });

              console.log('Edge function response:', { data, error });

              if (error) {
                console.error('Edge function error details:', error);
                throw new Error(`Failed to delete account: ${error.message || JSON.stringify(error)}`);
              }

              if (data && data.error) {
                console.error('Edge function returned error in data:', data.error);
                throw new Error(`Failed to delete account: ${data.error}`);
              }

              // Sign out the user (in case the edge function didn't handle it)
              await supabase.auth.signOut();

              Alert.alert("Success", "Account deleted successfully", [
                { text: 'OK', onPress: () => router.replace('/login') }
              ]);
              
            } catch (error) {
              console.error("Error deleting account:", error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete account';
              Alert.alert("Error", errorMessage);
            }
          },
        },
      ]
    );
  }, [router]);

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <View style={styles.headerLeft} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Account
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading your profile...
          </Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <View style={styles.headerLeft} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Account
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.centerContent}>
          <View style={[styles.errorCard, { backgroundColor: theme.card }]}>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={48} color={theme.danger} />
              <Text style={[styles.errorTitle, { color: theme.text }]}>
                Failed to Load Profile
              </Text>
              <Text style={[styles.errorSubtext, { color: theme.subtext }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setError(null);
                  fetchUserData();
                }}
              >
                <Ionicons name="refresh" size={16} color={theme.buttonText} />
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Account
        </Text>
        <TouchableOpacity
          style={[styles.headerActionButton, { backgroundColor: theme.card }]}
          onPress={() => handleNavigation('./edit-user', 'Edit User')}
          disabled={navigationLoading === 'Edit User'}
        >
          {navigationLoading === 'Edit User' ? (
            <ActivityIndicator size={16} color={theme.text} />
          ) : (
            <Ionicons name="pencil" size={20} color={theme.text} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <View style={styles.profileHeader}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
            ) : (
              <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.primary }]}>
                <Ionicons name="person" size={40} color={theme.buttonText} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]}>{username}</Text>
              <Text style={[styles.profileEmail, { color: theme.subtext }]}>{email}</Text>
              {isAdmin && (
                <View style={[styles.adminBadge, { backgroundColor: theme.primary }]}>
                  <Ionicons name="shield-checkmark" size={12} color={theme.buttonText} />
                  <Text style={[styles.adminBadgeText, { color: theme.buttonText }]}>
                    Admin
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Meal Plan Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="restaurant" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Meal Plan
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <View style={styles.infoItemHeader}>
              <Ionicons name="flame" size={16} color={theme.warning} />
              <Text style={[styles.infoItemLabel, { color: theme.text }]}>
                Calories Goal
              </Text>
            </View>
            <Text style={[styles.infoItemValue, { color: theme.subtext }]}>
              {caloriesGoal ? `${caloriesGoal} kcal` : 'Not set'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoItemHeader}>
              <Ionicons name="leaf" size={16} color={theme.primary} />
              <Text style={[styles.infoItemLabel, { color: theme.text }]}>
                Dietary Restrictions
              </Text>
            </View>
            <Text style={[styles.infoItemValue, { color: theme.subtext }]}>
              {dietaryRestrictions}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoItemHeader}>
              <Ionicons name="warning" size={16} color={theme.warning} />
              <Text style={[styles.infoItemLabel, { color: theme.text }]}>
                Allergies
              </Text>
            </View>
            <Text style={[styles.infoItemValue, { color: theme.subtext }]}>
              {allergies}
            </Text>
          </View>
        </View>

        {/* Settings Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Settings
            </Text>
          </View>

          {/* Dark Mode Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Ionicons 
                name={theme.background === '#0f172a' ? 'moon' : 'sunny'} 
                size={16} 
                color={theme.text} 
              />
              <Text style={[styles.settingItemLabel, { color: theme.text }]}>
                {theme.background === '#0f172a' ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <Switch
              value={theme.background === '#0f172a'}
              onValueChange={toggleTheme}
              thumbColor={theme.buttonText}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
        </View>

        {/* Actions Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="options" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Actions
            </Text>
          </View>

          {/* Edit User Information */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleNavigation('./edit-user', 'Edit Information')}
            disabled={navigationLoading === 'Edit Information'}
          >
            <View style={styles.actionItemLeft}>
              {navigationLoading === 'Edit Information' ? (
                <ActivityIndicator size={16} color={theme.primary} />
              ) : (
                <Ionicons name="pencil" size={16} color={theme.primary} />
              )}
              <Text style={[styles.actionItemLabel, { color: theme.text }]}>
                Edit Information
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
          </TouchableOpacity>

          {/* Support */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={async () => {
              try {
                const supported = await Linking.canOpenURL('https://www.shareablemeals.com/support');
                if (supported) {
                  await Linking.openURL('https://www.shareablemeals.com/support');
                } else {
                  Alert.alert('Error', 'Unable to open support page. Please check your internet connection.');
                }
              } catch (error) {
                console.error('Error opening support URL:', error);
                Alert.alert('Error', 'Unable to open support page. Please try again.');
              }
            }}
          >
            <View style={styles.actionItemLeft}>
              <Ionicons name="help-circle" size={16} color={theme.primary} />
              <Text style={[styles.actionItemLabel, { color: theme.text }]}>
                Support
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.subtext} />
          </TouchableOpacity>

          {/* Admin Panel - Only show for admins */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleNavigation('./admin-reports', 'Admin Reports')}
              disabled={navigationLoading === 'Admin Reports'}
            >
              <View style={styles.actionItemLeft}>
                {navigationLoading === 'Admin Reports' ? (
                  <ActivityIndicator size={16} color={theme.primary} />
                ) : (
                  <Ionicons name="shield-checkmark" size={16} color={theme.primary} />
                )}
                <Text style={[styles.actionItemLabel, { color: theme.text }]}>
                  Admin Reports
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
            </TouchableOpacity>
          )}

          {/* Cache Debug - Show for admins */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setShowCacheDebug(!showCacheDebug)}
            >
              <View style={styles.actionItemLeft}>
                <Ionicons 
                  name={showCacheDebug ? "analytics" : "analytics-outline"} 
                  size={16} 
                  color={theme.primary} 
                />
                <Text style={[styles.actionItemLabel, { color: theme.text }]}>
                  Cache Debug
                </Text>
              </View>
              <Ionicons 
                name={showCacheDebug ? "chevron-down" : "chevron-forward"} 
                size={16} 
                color={theme.subtext} 
              />
            </TouchableOpacity>
          )}

          {/* Cache Debug Component */}
          {showCacheDebug && (
            <CacheDebugComponent 
              visible={showCacheDebug} 
              onClose={() => setShowCacheDebug(false)} 
            />
          )}

          {/* Logout */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleLogout}
          >
            <View style={styles.actionItemLeft}>
              <Ionicons name="log-out" size={16} color={theme.warning} />
              <Text style={[styles.actionItemLabel, { color: theme.warning }]}>
                Logout
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleDeleteAccount}
          >
            <View style={styles.actionItemLeft}>
              <Ionicons name="trash" size={16} color={theme.danger} />
              <Text style={[styles.actionItemLabel, { color: theme.danger }]}>
                Delete Account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      <BottomNav />
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
    paddingTop: 44, // Account for status bar
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLeft: {
    width: 44, // Match action button width for centering
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    width: 44, // Match left side width for centering
  },

  // Scroll Container
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Account for bottom nav
  },

  // Error State
  errorCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorContent: {
    alignItems: 'center',
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Profile Card
  profileCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profilePicturePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Section Cards
  sectionCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Info Items
  infoItem: {
    marginBottom: 16,
  },
  infoItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  infoItemLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoItemValue: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Setting Items
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingItemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Action Items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionItemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Center Content
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Legacy styles (keeping for compatibility)
  themeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  switch: {
    transform: [{ scaleX: 1.5 }, { scaleY: 1.5 }],
  },
  borderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  editButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  adminButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  adminButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  profilePicturePlaceholderText: {
    color: 'white',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  leftAlignText: {
    fontSize: 16,
  },
  centeredRow: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  email: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default React.memo(AccountScreen);
