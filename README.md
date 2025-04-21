## Meal Plan App

This is a full-stack application for managing meal plans, including features like user authentication, dietary restrictions, calorie goals, and profile management.

---

### **Get Started**

#### 1. Install Dependencies

Install the required dependencies for both the backend and frontend.

```bash
# Install dependencies
npm install
 # For the time picker you nead this, Otherwise everything breaks
 npx expo install @react-native-community/datetimepicker

```

#### 2. Set Up the Database

Make sure you have MySQL installed and running. Create a database and the required tables:

```sql
CREATE DATABASE meal_plan_app;

USE meal_plan_app;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    calories_goal INT DEFAULT NULL,
    dietary_restrictions TEXT DEFAULT NULL,
    profile_picture BLOB DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

... -- (Check SQl file for all tables)
```

#### 3. Configure Environment Variables

Make sure that the env file is correct with all of your data:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=meal_plan_app
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
```

Replace `yourpassword`, `your_jwt_secret`, `your_email@gmail.com`, and `your_email_password` with your actual database credentials and email configuration.

#### 4. Start the Backend Server

Navigate to the `backend` directory and start the server:

```bash
cd backend
npm run server
```

#### 5. Start the Frontend App

Navigate to the `frontend` directory and start the app:

```bash
npx expo start
```
Run on an Android emulator for the best experience. 
If running on the web, please note that errors may not display properly and could cause the server to stop unexpectedly. 
Exercise caution and ensure all inputs and actions are correct when using the web version.
---



### **Features**
### **Features**
- **User Authentication**: Login, signup, and JWT-based authorization.
- **Profile Management**: Edit dietary restrictions, calorie goals, and profile picture.
- **Forgot Password**: Reset password functionality via email.
- **Meal Plan Calendar**: 
  - View meals in a calendar format for easy weekly planning.
  - Add, edit, or delete meals directly from the calendar.
- **Meal Management**:
  - Save meals for quick access and reuse in the future.
  - Create, edit, and delete meals with ingredients, descriptions, and images.
  - Upload pictures of meals for better visualization.
- **Community Features**:
  - Discover meals created by other users (Community Meals).
  - Upload meals to a shared database for others to view and add to their meal plans.
  - Add and view reviews for meals to see which meals are popular and well-rated.
  - Leave comments on other users' meals to discuss recipes and share feedback.
- **Search and Filters**:
  - Search meals by name or ingredients.
  - Filter meals by category (e.g., vegetarian, low-calorie, high-protein).
- **Nutritional Tracking**:
  - View calorie counts for each meal to track nutritional intake.
  - Set and track daily calorie goals.
- **Cooking Assistance**:
  - View ingredients and step-by-step cooking instructions for each meal.
  - Zoom in on meal images for better presentation details.
- **Theming**:
  - Light and dark mode support for a personalized experience.
- **Reporting**:
  - Report meals that are inappropriate or violate community guidelines.
- **Responsive Design**:
  - Optimized for Android emulator and functional on the web (with some limitations). 


---

### **Troubleshooting**
- **Database Connection Issues:** Ensure your `.env` file is correctly configured and the MySQL server is running.
- **Expo Issues:** If `npx expo start` fails, ensure you have Expo CLI installed globally:
  ```bash
  npm install -g expo-cli
  ```
- **Backend Errors:** Use tools like Postman to test API endpoints and debug issues.


---

### **License**
This project is licensed under the MIT License.