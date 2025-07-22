import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Image, 
  Switch, 
  StyleSheet, 
  ActivityIndicator,
  ScrollView 
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import BottomNav from 'components/bottomNav';
import { useRouter } from 'expo-router';
import { supabase } from 'utils/supabase';

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

  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
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

        // Fetch user profile from 'user_profiles' table
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          throw new Error(`Failed to fetch user profile: ${error.message}`);
        }

        if (!data) {
          throw new Error('User profile not found');
        }

        // Set user data with fallback values
        setUsername(data.username || 'Unknown User');
        setCaloriesGoal(data.calories_goal);
        setDietaryRestrictions(data.dietary_restrictions || 'None specified');
        setEmail(data.email || 'No email provided');
        setAllergies(data.allergies || 'None specified');
        setProfilePicture(data.profile_picture);
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
    };

    fetchUserData();
  }, [router]);

  const handleLogout = async () => {
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
  };

  const handleDeleteAccount = async () => {
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

              // Note: supabase.auth.admin.deleteUser() requires service role key
              // For client-side deletion, we'll delete the profile and let RLS handle cleanup
              const { error: deleteProfileError } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', userId);

              if (deleteProfileError) {
                throw new Error(`Failed to delete profile: ${deleteProfileError.message}`);
              }

              // Sign out the user
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
  };

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading your profile...</Text>
        <BottomNav />
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>Failed to load profile</Text>
        <Text style={[styles.errorSubtext, { color: theme.subtext }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            setError(null);
            // Trigger re-fetch by calling useEffect logic
            const fetchData = async () => {
              try {
                setLoading(true);
                setError(null);
                
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw new Error(`Authentication error: ${userError.message}`);
                if (!userData?.user) throw new Error('No authenticated user found');
                
                const { data, error } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('id', userData.user.id)
                  .single();

                if (error) throw new Error(`Failed to fetch user profile: ${error.message}`);
                if (!data) throw new Error('User profile not found');

                setUsername(data.username || 'Unknown User');
                setCaloriesGoal(data.calories_goal);
                setDietaryRestrictions(data.dietary_restrictions || 'None specified');
                setEmail(data.email || 'No email provided');
                setAllergies(data.allergies || 'None specified');
                setProfilePicture(data.profile_picture);
                setIsAdmin(data.is_admin || false);
                
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                setError(errorMessage);
              } finally {
                setLoading(false);
              }
            };
            fetchData();
          }}
        >
          <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>Retry</Text>
        </TouchableOpacity>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
        ) : (
          <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.button }]}>
            <Text style={[styles.profilePicturePlaceholderText, { color: theme.text }]}>No Picture</Text>
          </View>
        )}
        <Text style={[styles.title, { color: theme.text, marginBottom: 4 }]}>{username}</Text>

        {/* Email */}
        <View style={styles.centeredRow}>
          <Text style={[styles.email, { color: theme.text, marginVertical: 4 }]}>{email}</Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.title, { color: theme.text }]}>Meal Plan</Text>
        </View>

        {/* Calories Goal */}
        <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 15 }]}>
          <Text style={[styles.leftAlignText, { color: theme.text, fontSize: 18 }]}>
            Calories Goal: {caloriesGoal ? `${caloriesGoal} kcal` : 'Not set'}
          </Text>
        </View>

        {/* Dietary Restrictions */}
        <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 15 }]}>
          <Text style={[styles.leftAlignText, { color: theme.text, fontSize: 18 }]}>
            Dietary Restrictions: {dietaryRestrictions}
          </Text>
        </View>

        {/* Allergies */}
        <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 15 }]}>
          <Text style={[styles.leftAlignText, { color: theme.text, fontSize: 18 }]}>
            Allergies: {allergies}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.title, { color: theme.text }]}>Themes</Text>
        </View>

        {/* Dark Mode Toggle */}
        <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={[styles.themeButtonText, { color: theme.text }]}>
            {theme.background === '#121212' ? 'Dark Mode' : 'Light Mode'}
          </Text>
          <Switch
            value={theme.background === '#121212'}
            onValueChange={toggleTheme}
            thumbColor={theme.primary}
            trackColor={{ false: theme.border, true: theme.primary }}
            style={styles.switch}
          />
        </View>

        {/* Edit User Information Button */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
          onPress={() => router.push('./edit-user')}
        >
          <Text style={[styles.editButtonText, { color: theme.text, alignSelf: 'flex-start' }]}>
            Edit Information
          </Text>
        </TouchableOpacity>

        {/* Admin Panel Button - Only show for admins */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: theme.primary, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
            onPress={() => router.push('./admin-reports')}
          >
            <Text style={[styles.adminButtonText, { color: theme.buttonText, alignSelf: 'flex-start' }]}>
              Admin Reports
            </Text>
          </TouchableOpacity>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutButtonText, { color: theme.buttonText, alignSelf: 'flex-start' }]}>Logout</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.deleteButtonText, { color: theme.danger, alignSelf: 'flex-start' }]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
      
      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
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
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default AccountScreen;
