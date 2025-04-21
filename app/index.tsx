import React, { useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import MealPlanCalendar from "@/components/MealPlanCalendar";
import LoginScreen from "@/components/LoginScreen";
import SignUpScreen from "@/components/SignUpScreen";
import AccountScreen from "@/components/AccountScreen";
import ForgotPasswordScreen from "@/components/ForgotPasswordScreen";
import OtherMeals from "@/components/OtherMeals";
import MealDetails from "@/components/MealDetails";
import CreateReview from "@/components/CreateReview";
import ViewReviews from "@/components/ViewReviews";
import CreateMealScreen from "@/components/CreateMealScreen";
import MyMeals from "@/components/MyMeals";
import MyMealInfo from "@/components/MyMealInfo";
import MealPlanDetails from "@/components/MealPlanDetails";
import AddMealToDate from "@/components/AddMealToDate";
import Icon from "react-native-vector-icons/FontAwesome";
import { Meal } from "@/types/types";

function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isAccountScreen, setIsAccountScreen] = useState(false);
  const [isForgotPasswordScreen, setIsForgotPasswordScreen] = useState(false);
  const [isOtherMealsScreen, setIsOtherMealsScreen] = useState(false);
  const [isMyMealsScreen, setIsMyMealsScreen] = useState(false);
  const [isMealPlanDetailsScreen, setIsMealPlanDetailsScreen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isCreatingReview, setIsCreatingReview] = useState(false);
  const [isViewingReviews, setIsViewingReviews] = useState(false);
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [isAddMealToDate, setIsAddMealToDate] = useState(false); // New state for AddMealToDate screen
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // Track the selected date

  const handleLogin = () => setIsLoggedIn(true);

  const handleNavigateToSignUp = () => setIsSigningUp(true);

  const handleSignUp = () => setIsSigningUp(false);

  const handleNavigateToLogin = () => {
    setIsSigningUp(false);
    setIsForgotPasswordScreen(false);
  };

  const handleNavigateToAccount = () => setIsAccountScreen(true);

  const handleBackToCalendar = () => {
    setIsAccountScreen(false);
    setIsOtherMealsScreen(false);
    setIsMyMealsScreen(false);
    setIsMealPlanDetailsScreen(false);
    setIsAddMealToDate(false); // Reset AddMealToDate screen state
    setSelectedMeal(null);
    setSelectedDate(null); // Reset selected date
    setIsCreatingMeal(false);
  };

  const handleNavigateToForgotPassword = () => setIsForgotPasswordScreen(true);

  const handleBackToLogin = () => setIsForgotPasswordScreen(false);

  const handleNavigateToOtherMeals = () => {
    setIsAccountScreen(false);
    setIsOtherMealsScreen(true);
    setIsMyMealsScreen(false);
    setSelectedMeal(null);
  };

  const handleNavigateToMyMeals = () => {
    setIsAccountScreen(false);
    setIsOtherMealsScreen(false);
    setIsMyMealsScreen(true);
    setSelectedMeal(null);
  };

  const handleNavigateToMealPlanDetails = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsMealPlanDetailsScreen(true);
  };

  const handleNavigateToMealDetails = (meal: Meal): void => setSelectedMeal(meal);

  const handleNavigateToMyMealInfo = (meal: Meal): void => setSelectedMeal(meal);

  const handleAddReview = (meal: Meal): void => {
    setSelectedMeal(meal);
    setIsCreatingReview(true);
  };

  const handleViewReviews = (meal: Meal): void => {
    setSelectedMeal(meal);
    setIsViewingReviews(true);
  };

  const handleReviewSubmit = () => {
    setIsCreatingReview(false);
    setSelectedMeal(null);
  };

  const handleNavigateToCreateMeal = () => {
    setIsCreatingMeal(true);
  };

  const handleNavigateToAddMealToDate = (date: string) => {
    setSelectedDate(date); // Set the selected date
    setIsAddMealToDate(true); // Navigate to AddMealToDate screen
  };

  return (
    <View style={styles.container}>
      {isLoggedIn ? (
        isCreatingMeal ? (
          <CreateMealScreen
            route={{ params: { selectedDay: "2023-04-07" } }}
            navigation={{ goBack: handleBackToCalendar }}
          />
        ) : isCreatingReview && selectedMeal ? (
          <CreateReview
            meal={selectedMeal}
            onReviewSubmit={handleReviewSubmit}
            onCancel={() => setIsCreatingReview(false)}
          />
        ) : isViewingReviews && selectedMeal ? (
          <ViewReviews
            meal={selectedMeal}
            onBack={() => setIsViewingReviews(false)}
          />
        ) : isMealPlanDetailsScreen && selectedMeal ? (
          <MealPlanDetails
            meal={selectedMeal}
            onBack={handleBackToCalendar}
          />
        ) : isAddMealToDate && selectedDate ? (
          <AddMealToDate
            route={{ params: { date: selectedDate } }}
            navigation={{ goBack: handleBackToCalendar }}
          />
        ) : selectedMeal ? (
          isOtherMealsScreen ? (
            <MealDetails
              meal={selectedMeal}
              onBack={() => setSelectedMeal(null)}
              onAddReview={handleAddReview}
              onViewReviews={handleViewReviews}
            />
          ) : (
            <MyMealInfo
              meal={selectedMeal}
              onBack={() => setSelectedMeal(null)}
            />
          )
        ) : isAccountScreen ? (
          <>
            <AccountScreen onLogout={() => setIsLoggedIn(false)} />
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.barButton} onPress={handleBackToCalendar}>
                <Icon name="calendar" size={24} color="#000" />
                <Text style={styles.barButtonText}>Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToMyMeals}>
                <Icon name="cutlery" size={24} color="#000" />
                <Text style={styles.barButtonText}>My Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToOtherMeals}>
                <Icon name="users" size={24} color="#000" />
                <Text style={styles.barButtonText}>Discover Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToAccount}>
                <Icon name="user" size={24} color="#000" />
                <Text style={styles.barButtonText}>Account</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : isOtherMealsScreen ? (
          <>
            <OtherMeals onMealSelect={handleNavigateToMealDetails} />
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.barButton} onPress={handleBackToCalendar}>
                <Icon name="calendar" size={24} color="#000" />
                <Text style={styles.barButtonText}>Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToMyMeals}>
                <Icon name="cutlery" size={24} color="#000" />
                <Text style={styles.barButtonText}>My Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToOtherMeals}>
                <Icon name="users" size={24} color="#000" />
                <Text style={styles.barButtonText}>Discover Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToAccount}>
                <Icon name="user" size={24} color="#000" />
                <Text style={styles.barButtonText}>Account</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : isMyMealsScreen ? (
          <>
            <MyMeals onMealSelect={handleNavigateToMyMealInfo} />
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.barButton} onPress={handleBackToCalendar}>
                <Icon name="calendar" size={24} color="#000" />
                <Text style={styles.barButtonText}>Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToMyMeals}>
                <Icon name="cutlery" size={24} color="#000" />
                <Text style={styles.barButtonText}>My Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToOtherMeals}>
                <Icon name="users" size={24} color="#000" />
                <Text style={styles.barButtonText}>Discover Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToAccount}>
                <Icon name="user" size={24} color="#000" />
                <Text style={styles.barButtonText}>Account</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.calendarContainer}>
            <MealPlanCalendar
              onNavigateToCreateMeal={handleNavigateToCreateMeal}
              onMealSelect={handleNavigateToMealPlanDetails}
              onNavigateToAddMeal={handleNavigateToAddMealToDate}
            />
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.barButton} onPress={handleBackToCalendar}>
                <Icon name="calendar" size={24} color="#000" />
                <Text style={styles.barButtonText}>Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToMyMeals}>
                <Icon name="cutlery" size={24} color="#000" />
                <Text style={styles.barButtonText}>My Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToOtherMeals}>
                <Icon name="users" size={24} color="#000" />
                <Text style={styles.barButtonText}>Discover Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.barButton} onPress={handleNavigateToAccount}>
                <Icon name="user" size={24} color="#000" />
                <Text style={styles.barButtonText}>Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : isSigningUp ? (
        <SignUpScreen onSignUp={handleSignUp} onNavigateToLogin={handleNavigateToLogin} />
      ) : isForgotPasswordScreen ? (
        <ForgotPasswordScreen onBackToLogin={handleBackToLogin} />
      ) : (
        <LoginScreen
          onLogin={handleLogin}
          onNavigateToSignUp={handleNavigateToSignUp}
          onNavigateForgotPassword={handleNavigateToForgotPassword}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 25,
  },
  calendarContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "stretch",
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    height: 60,
    backgroundColor: "#f8f8f8",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    position: "absolute",
    bottom: 0,
  },
  barButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  barButtonText: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default Index;