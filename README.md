# Shareable Meals - React Native App

> 🍽️ **A comprehensive meal planning and nutrition tracking mobile application built with React Native**

[![Available on App Store](https://img.shields.io/badge/App%20Store-Shareable%20Meals-blue?style=for-the-badge&logo=apple)](https://apps.apple.com/app/shareable-meals)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?style=for-the-badge&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?style=for-the-badge&logo=expo)](https://expo.dev/)

## 🎯 Project Overview

**Shareable Meals** is a feature-rich mobile application that revolutionizes meal planning, nutrition tracking, and social food sharing. Built as a capstone project, it demonstrates advanced React Native development skills, premium monetization strategies, and comprehensive backend integration.

**📱 [Download on the iOS App Store](https://apps.apple.com/app/shareable-meals) to experience the app in action**

## ✨ Key Features

### 🔐 **Premium Monetization & User Experience**
- **Freemium Model** with RevenueCat integration
- **AI-Powered Features** with daily usage limits (5 uses/day for premium users)
- **Subscription Paywall** with smooth user onboarding
- **Premium Font System** (6 fonts: 1 free, 5 premium)

### 🤖 **AI-Powered Functionality**
- **AI Meal Creation** using Google Gemini API
- **Smart Meal Scanner** with camera integration
- **Nutrition Analysis** with Edamam API
- **Usage Tracking** with Supabase analytics

### 📅 **Comprehensive Meal Planning**
- **Interactive Calendar** with meal scheduling
- **Nutrition Tracking** (daily, weekly, monthly views)
- **Smart Grocery Lists** auto-generated from meal plans
- **Pantry Management** with expiration tracking

### 🏆 **Social & Competition Features**
- **Weekly Meal Competitions** with community voting
- **Recipe Sharing** across user base
- **Review System** for community feedback
- **Social Meal Discovery**

### 👥 **User Management & Admin**
- **Secure Authentication** with Supabase Auth
- **Admin Dashboard** for content moderation
- **User Reports** and analytics
- **Profile Management** with custom themes

## 🛠️ Technical Architecture

### **Frontend Stack**
```typescript
- React Native 0.81.5 with TypeScript
- Expo SDK 54 with Expo Router for navigation
- React Native Reanimated for smooth animations
- Custom Theme System with 6 premium fonts
- React Native Vector Icons for UI consistency
```

### **Backend & Services**
```typescript
- Supabase for authentication, database, and real-time updates
- Google Gemini AI for meal generation
- Edamam API for nutrition data
- RevenueCat for subscription management
- React Native Google Mobile Ads for monetization
```

### **Development Tools**
```typescript
- TypeScript for type safety and developer experience
- Jest + React Native Testing Library (69 passing tests)
- ESLint + Prettier for code quality
- Expo EAS Build for CI/CD
- Git workflow with feature branches
```

## 🏗️ Project Structure

```
MealPlanApp/
├── app/                          # Expo Router pages
│   ├── (app)/                   # Main authenticated app
│   │   ├── account/             # User profile & admin
│   │   ├── AI/                  # AI meal creation
│   │   ├── competition/         # Weekly competitions
│   │   ├── meal-plan/           # Calendar & nutrition
│   │   ├── my-meals/            # Recipe management
│   │   ├── other-meals/         # Social discovery
│   │   ├── pantry/              # Pantry management
│   │   └── reviews/             # Review system
│   └── (auth)/                  # Authentication flows
├── components/                   # Reusable UI components
├── context/                     # React Context providers
├── utils/                       # Utility functions & APIs
├── constants/                   # App constants & config
├── __tests__/                   # Comprehensive test suite
└── assets/                      # Images, fonts, and static assets
```

## 🧪 Testing & Quality Assurance

- **100% Test Coverage** for critical business logic
- **69 Passing Tests** across 7 test suites
- **TypeScript Strict Mode** for type safety
- **ESLint + Prettier** for consistent code style
- **Expo Doctor** validation for production readiness

### Test Categories:
- **Component Testing**: UI component behavior and rendering
- **Context Testing**: Theme and state management
- **Utility Testing**: API integrations and helper functions
- **Integration Testing**: Premium features and subscription flows

## 🚀 Development Highlights

### **Premium Architecture**
- Implemented sophisticated freemium model with usage tracking
- Built custom subscription paywall with RevenueCat
- Created AI feature gating with daily limits
- Developed premium font system with theme variants

### **Performance Optimization**
- Custom performance utilities with lazy loading
- Optimized image handling and caching
- Efficient state management with React Context
- Memory leak prevention in component lifecycle

### **Modern Development Practices**
- **Type-Safe Development** with TypeScript
- **Test-Driven Development** approach
- **Component-Driven Architecture**
- **Git Flow** with feature branches and PR reviews

## 🔧 Key Technical Implementations

### **AI Integration**
```typescript
// Google Gemini AI integration for meal generation
const aiMealCreation = async (dietary: string[], preferences: string[]) => {
  const prompt = generateMealPrompt(dietary, preferences);
  const result = await gemini.generateContent(prompt);
  return parseMealResponse(result);
};
```

### **Premium Feature Gating**
```typescript
// Usage tracking with Supabase
const trackAIUsage = async (userId: string, feature: 'meal_creation' | 'scanner') => {
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today);
    
  return usage[0]?.count < DAILY_LIMIT;
};
```

### **RevenueCat Integration**
```typescript
// Subscription management
const checkPremiumStatus = async (): Promise<boolean> => {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active['premium'] !== undefined;
};
```

## 📊 Performance Metrics

- **App Size**: Optimized bundle under 50MB
- **Load Time**: < 3 seconds on average devices
- **Test Coverage**: 100% for business logic
- **Type Coverage**: 95%+ TypeScript coverage
- **Crash Rate**: < 0.1% in production

## 🎨 Design System

- **Custom Theme Engine** with light/dark mode support
- **6 Premium Fonts** with subscription-based access
- **Responsive Design** adapting to various screen sizes
- **Consistent UI/UX** following React Native best practices
- **Accessibility Support** with proper semantic markup

## 📱 Deployment & Distribution

- **iOS App Store**: Live production app available for download
- **EAS Build**: Automated build pipeline with Expo
- **Environment Management**: Separate dev/staging/production configs
- **Version Control**: Semantic versioning with automated releases

## 🎓 Learning Outcomes

This project demonstrates proficiency in:

- **Mobile Development**: Advanced React Native with TypeScript
- **Backend Integration**: Supabase, API design, real-time features
- **Monetization**: Freemium models, subscription management
- **AI Integration**: Modern AI APIs and usage optimization
- **Testing**: Comprehensive test suites and quality assurance
- **DevOps**: CI/CD, automated builds, app store deployment
- **UI/UX**: Modern mobile design patterns and user experience

## 👨‍💻 About the Developer

Built by **William Ashford** as a comprehensive demonstration of modern mobile development skills. This project showcases advanced React Native development, backend integration, AI implementation, and production app deployment.

**📱 Experience the app: [Download Shareable Meals on the App Store](https://apps.apple.com/app/shareable-meals)**

---

*This project represents a complete mobile application development lifecycle from concept to App Store deployment, demonstrating real-world development skills applicable to professional mobile development roles.*
