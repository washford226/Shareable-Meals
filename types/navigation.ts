// types/navigation.ts
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Meal } from './types'; // Adjust the import path as needed

export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    ForgotPassword: undefined;
    MealPlanCalendar: undefined;
    MyMeals: undefined;
    CreateMealScreen: { selectedDay?: string }; // <-- fix here
    MealDetails: { mealId: number };
    MyMealInfo: undefined;
    AccountScreen: undefined;
    AddMealToDate: { date: string };
    MealPlanDetails: undefined;
    ViewReviews: { mealId: number };
    OtherMeals: undefined;
    CreateReview: { meal: Meal };
};


export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
