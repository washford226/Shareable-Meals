import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../utils/supabase";
import { useTheme } from "../../context/ThemeContext";

const SignUpScreen = () => {
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signUpError) {
        Alert.alert('Error', signUpError.message);
        return;
      }

      if (!signUpData?.user) {
        Alert.alert('Error', 'Failed to create account');
        return;
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert([{
          id: signUpData.user.id,
          username: username.trim(),
          calories_goal: 2000,
          protein_goal: 80,
          carbohydrates_goal: 300,
          fat_goal: 60,
          scanner_usage_count: 0,
        }]);

      if (profileError) {
        console.error("Profile creation error:", profileError);
        Alert.alert("Error", "Failed to create user profile");
        return;
      }

      Alert.alert(
        "Success", 
        "Account created successfully! Please check your email to verify your account.",
        [{ text: "OK", onPress: () => router.replace("/login") }]
      );

    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
            <Ionicons name="person-add" size={48} color={theme.buttonTextPrimary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Join us to start your meal planning journey
          </Text>
        </View>

        {/* Sign Up Card */}
        <View style={[styles.signupCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-add" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Account Information
            </Text>
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Username
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Choose a username"
                placeholderTextColor={theme.placeholder}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Email Address
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text,
                  backgroundColor: theme.background,
                  paddingRight: 48
                }]}
                placeholder="Create a password"
                placeholderTextColor={theme.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.passwordToggle, { backgroundColor: theme.background }]}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                disabled={loading}
              >
                <Ionicons 
                  name={isPasswordVisible ? "eye-off" : "eye"} 
                  size={16} 
                  color={theme.subtext} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Confirm Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="checkmark-circle" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!isPasswordVisible}
                editable={!loading}
              />
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signupButton, { backgroundColor: theme.primary }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonTextPrimary} />
            ) : (
              <Text style={[styles.signupButtonText, { color: theme.buttonTextPrimary }]}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Card */}
        <View style={[styles.loginCard, { backgroundColor: theme.card }]}>
          <View style={styles.loginContent}>
            <Text style={[styles.loginText, { color: theme.text }]}>
              Already have an account?
            </Text>
            <TouchableOpacity
              style={[styles.loginButton, { borderColor: theme.primary }]}
              onPress={() => router.replace("/login")}
              disabled={loading}
            >
              <Text style={[styles.loginButtonText, { color: theme.primary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  signupCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingLeft: 40,
    paddingRight: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
    borderRadius: 4,
  },
  signupButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginCard: {
    borderRadius: 16,
    padding: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  loginContent: {
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    marginBottom: 16,
  },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignUpScreen;