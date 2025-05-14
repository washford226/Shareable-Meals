-- Create the database
CREATE DATABASE IF NOT EXISTS balance_bytes;

-- Use the database
USE balance_bytes;

SET GLOBAL event_scheduler = ON;

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    profile_picture BLOB,
    calories_goal INT, -- Changed to INT for numeric validation
    dietary_restrictions VARCHAR(255),
    allergies VARCHAR(255),
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
    calories INT DEFAULT NULL,
    protein INT DEFAULT NULL,
    carbohydrates INT DEFAULT NULL,
    fat INT DEFAULT NULL,
    instructions TEXT DEFAULT NULL,
    recipeLink VARCHAR(255) DEFAULT NULL,
    created_by_ai BOOLEAN DEFAULT FALSE, -- Indicates if the meal was created by AI
    created_by VARCHAR(255) DEFAULT NULL, -- Indicates who created the meal
    favorite BOOLEAN DEFAULT FALSE, -- Indicates if the meal is a favorite
    picture BLOB,
    visibility BOOLEAN DEFAULT TRUE, -- True for public, false for private
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create the pantry table
CREATE TABLE Pantry (
    pantry_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique identifier for each pantry item
    user_id INT NOT NULL, -- Foreign key to the users table
    food TEXT NOT NULL, -- Food item name
    quantity FLOAT Default Null, -- Quantity of the food item
    unit VARCHAR(50) DEFAULT NULL, -- Unit of measurement (e.g., grams, cups)
    expiration_date DATE DEFAULT NULL, -- Optional expiration date for the item
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for when the item was added
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Timestamp for updates
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Cascade delete if the user is deleted
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
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE, -- Cascade delete if the meal is deleted
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

CREATE TABLE IF NOT EXISTS weekly_competitions (
    competition_id INT AUTO_INCREMENT PRIMARY KEY,
    theme VARCHAR(50) NOT NULL DEFAULT 'open',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competition_themes (
    theme_id INT AUTO_INCREMENT PRIMARY KEY,
    theme_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);


CREATE TABLE IF NOT EXISTS meal_votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    meal_id INT NOT NULL,
    competition_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, competition_id, meal_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
    FOREIGN KEY (competition_id) REFERENCES weekly_competitions(competition_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weekly_winners (
    winner_id INT AUTO_INCREMENT PRIMARY KEY,
    competition_id INT NOT NULL UNIQUE,
    meal_id INT NOT NULL,
    total_votes INT NOT NULL,
    declared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competition_id) REFERENCES weekly_competitions(competition_id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

DELIMITER $$

CREATE PROCEDURE process_weekly_competition()
BEGIN
    DECLARE current_competition_id INT;
    DECLARE winning_meal_id INT DEFAULT NULL;
    DECLARE total_votes INT DEFAULT 0;
    DECLARE current_theme VARCHAR(50);
    DECLARE next_theme VARCHAR(50);

    -- 1. Get the current competition that ends today
    SELECT competition_id, theme INTO current_competition_id, current_theme
    FROM weekly_competitions
    WHERE end_date = CURRENT_DATE
    LIMIT 1;

    -- 2. Only proceed if a competition ends today
    IF current_competition_id IS NOT NULL THEN

        -- 3. Determine the winning meal
        SELECT meal_id, COUNT(*) INTO winning_meal_id, total_votes
        FROM meal_votes
        WHERE competition_id = current_competition_id
        GROUP BY meal_id
        ORDER BY COUNT(*) DESC
        LIMIT 1;

        -- 4. Insert winner
        IF winning_meal_id IS NOT NULL THEN
            INSERT INTO weekly_winners (competition_id, meal_id, total_votes)
            VALUES (current_competition_id, winning_meal_id, total_votes);
        END IF;

        -- 5. Get next theme in rotation
        SELECT theme_name INTO next_theme
        FROM competition_themes
        WHERE theme_name > current_theme
        ORDER BY theme_name
        LIMIT 1;

        -- If no next theme, restart rotation
        IF next_theme IS NULL THEN
            SELECT theme_name INTO next_theme
            FROM competition_themes
            ORDER BY theme_name
            LIMIT 1;
        END IF;

        -- 6. Create new competition with next theme
        INSERT INTO weekly_competitions (start_date, end_date, theme)
        VALUES (
            DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY),
            DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY),
            next_theme
        );

        -- 7. Clean up old votes
        DELETE FROM meal_votes
        WHERE competition_id = current_competition_id;

    END IF;
END$$

DELIMITER ;


DELIMITER $$

CREATE EVENT IF NOT EXISTS end_weekly_competition
ON SCHEDULE EVERY 1 WEEK
STARTS '2025-05-18 23:59:00'
DO
BEGIN
    CALL process_weekly_competition();
END$$

DELIMITER ;
