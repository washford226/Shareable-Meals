-- Create the database
CREATE DATABASE IF NOT EXISTS balance_bytes;

-- Use the database
USE balance_bytes;

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    profile_picture BLOB,
    calories_goal INT, -- Changed to INT for numeric validation
    dietary_restrictions VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the categories table (moved before Foods table)
CREATE TABLE Categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE, -- Added UNIQUE constraint
    description TEXT DEFAULT NULL
);

-- Create the foods table
CREATE TABLE Foods (
    food_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE, -- Added UNIQUE constraint
    description TEXT DEFAULT NULL,
    category_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE SET NULL
);

-- Create the meals table
CREATE TABLE IF NOT EXISTS meals (
    id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    calories INT NOT NULL,
    protein INT NOT NULL,
    carbohydrates INT NOT NULL,
    fat INT NOT NULL,
    visibility BOOLEAN DEFAULT TRUE, -- True for public, false for private
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create the nutrients table
CREATE TABLE Nutrients (
    nutrient_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE, -- Added UNIQUE constraint
    unit VARCHAR(50) NOT NULL,  -- (e.g., grams, milligrams, IU)
    description TEXT DEFAULT NULL
);

-- Create the food nutrient table
CREATE TABLE Food_Nutrient (
    food_id INT,
    nutrient_id INT,
    amount FLOAT NOT NULL,  -- Changed to FLOAT for flexibility
    PRIMARY KEY (food_id, nutrient_id),
    FOREIGN KEY (food_id) REFERENCES Foods(food_id) ON DELETE CASCADE,
    FOREIGN KEY (nutrient_id) REFERENCES Nutrients(nutrient_id) ON DELETE CASCADE
);

-- Create the portions table
CREATE TABLE Portions (
    portion_id INT PRIMARY KEY AUTO_INCREMENT,
    food_id INT,
    weight_in_grams FLOAT,  -- Changed to FLOAT for flexibility
    serving_size VARCHAR(255),  -- E.g., 1 cup, 1 slice
    FOREIGN KEY (food_id) REFERENCES Foods(food_id) ON DELETE CASCADE
);

-- Create the reviews table
CREATE TABLE Reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT, -- Unique identifier for each review
    meal_id INT NOT NULL, -- Foreign key to the meals table
    user_id INT NOT NULL, -- Foreign key to the users table
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5), -- Rating between 1 and 5
    comment TEXT DEFAULT NULL, -- Optional comment for the review
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for when the review was created
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Timestamp for updates
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE, -- Cascade delete if the meal is deleted
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Cascade delete if the user is deleted
);

-- Create the meal_plan table
CREATE TABLE Meal_Plan (
    meal_plan_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique identifier for each entry
    meal_id INT NOT NULL, -- Foreign key to the meals table
    user_id INT NOT NULL, -- Foreign key to the users table
    date DATE NOT NULL, -- The specific date the meal is planned for
    meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Other') NOT NULL, -- Type of meal
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE -- Cascade delete if the meal is deleted
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Cascade delete if the user is deleted
);

CREATE TABLE IF NOT EXISTS REPORTS (
    report_id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    user_id INT NOT NULL,
    meal_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status ENUM('Pending', 'Reviewed', 'Resolved') DEFAULT 'Pending', -- Track report status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);