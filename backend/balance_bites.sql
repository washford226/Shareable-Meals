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
    calories_goal INT DEFAULT 2000,
    protein_goal INT DEFAULT 80,
    carbohydrates_goal INT DEFAULT 300,
    fat_goal INT DEFAULT 60,
    dietary_restrictions VARCHAR(255),
    allergies VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    created_by_ai BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255) DEFAULT FALSE,
    favorite BOOLEAN DEFAULT FALSE,
    dietary_restrictions VARCHAR(255),
    servings INT DEFAULT 1,
    cuisine VARCHAR(100) DEFAULT NULL,
    picture BLOB,
    visibility BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Pantry table
CREATE TABLE IF NOT EXISTS Pantry (
    pantry_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    food TEXT NOT NULL,
    quantity FLOAT DEFAULT NULL,
    unit VARCHAR(50) DEFAULT NULL,
    expiration_date DATE DEFAULT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Foods
CREATE TABLE IF NOT EXISTS Foods (
    food_id INT PRIMARY KEY AUTO_INCREMENT,
    fdc_id INT UNIQUE,
    data_type VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    publication_date DATE
);

-- Nutrients
CREATE TABLE IF NOT EXISTS Nutrients (
    nutrient_id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    nutrient_nbr VARCHAR(20),
    description TEXT DEFAULT NULL
);

-- Food_Nutrient
CREATE TABLE IF NOT EXISTS Food_Nutrient (
    id INT PRIMARY KEY,
    food_id INT,
    fdc_id INT,
    nutrient_id INT,
    amount FLOAT NOT NULL,
    data_points INT DEFAULT NULL,
    derivation_id VARCHAR(20) DEFAULT NULL,
    min FLOAT DEFAULT NULL,
    max FLOAT DEFAULT NULL,
    median FLOAT DEFAULT NULL,
    footnote TEXT DEFAULT NULL,
    min_year_acquired VARCHAR(10) DEFAULT NULL,
    FOREIGN KEY (food_id) REFERENCES Foods(food_id) ON DELETE CASCADE,
    FOREIGN KEY (nutrient_id) REFERENCES Nutrients(nutrient_id) ON DELETE CASCADE
);

-- Portions
CREATE TABLE IF NOT EXISTS Portions (
    portion_id INT PRIMARY KEY,
    food_id INT,
    fdc_id INT,
    seq_num VARCHAR(10),
    amount FLOAT,
    measure_unit_id INT,
    portion_description VARCHAR(255),
    modifier VARCHAR(255),
    weight_in_grams FLOAT,
    data_points INT DEFAULT NULL,
    footnote TEXT DEFAULT NULL,
    min_year_acquired VARCHAR(10) DEFAULT NULL,
    FOREIGN KEY (food_id) REFERENCES Foods(food_id) ON DELETE CASCADE
);

-- Measure Unit
CREATE TABLE IF NOT EXISTS Measure_Unit (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

-- Food Calorie Conversion Factor
CREATE TABLE IF NOT EXISTS Food_Calorie_Conversion_Factor (
    food_nutrient_conversion_factor_id INT PRIMARY KEY,
    protein_value FLOAT,
    fat_value FLOAT,
    carbohydrate_value FLOAT
);

-- Food Protein Conversion Factor
CREATE TABLE IF NOT EXISTS Food_Protein_Conversion_Factor (
    food_nutrient_conversion_factor_id INT PRIMARY KEY,
    value FLOAT
);

-- Food Nutrient Conversion Factor
CREATE TABLE IF NOT EXISTS Food_Nutrient_Conversion_Factor (
    id INT PRIMARY KEY,
    fdc_id INT
);

-- meal_ingredients
CREATE TABLE IF NOT EXISTS meal_ingredients (
    meal_ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
    meal_id INT NOT NULL,
    raw_name VARCHAR(255),
    food_id INT NOT NULL,
    quantity FLOAT DEFAULT 1.0,
    unit VARCHAR(50) DEFAULT NULL,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES Foods(food_id) ON DELETE CASCADE
);

-- Reviews
CREATE TABLE IF NOT EXISTS Reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    meal_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Meal Plan
CREATE TABLE IF NOT EXISTS Meal_Plan (
    meal_plan_id INT AUTO_INCREMENT PRIMARY KEY,
    meal_id INT NOT NULL,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Other') NOT NULL,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reports
CREATE TABLE IF NOT EXISTS REPORTS (
    report_id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    user_id INT NOT NULL,
    meal_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status ENUM('Pending', 'Reviewed', 'Resolved') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

-- Password resets
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Weekly Competitions
CREATE TABLE IF NOT EXISTS weekly_competitions (
    competition_id INT AUTO_INCREMENT PRIMARY KEY,
    theme VARCHAR(50) NOT NULL DEFAULT 'open',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competition Themes
CREATE TABLE IF NOT EXISTS competition_themes (
    theme_id INT AUTO_INCREMENT PRIMARY KEY,
    theme_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Meal Votes
CREATE TABLE IF NOT EXISTS meal_votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    meal_id INT NOT NULL,
    competition_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (user_id, competition_id, meal_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
    FOREIGN KEY (competition_id) REFERENCES weekly_competitions(competition_id) ON DELETE CASCADE
);

-- Weekly Winners
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
    DECLARE current_competition_id INT DEFAULT NULL;
    DECLARE winning_meal_id INT DEFAULT NULL;
    DECLARE total_votes INT DEFAULT 0;
    DECLARE current_theme VARCHAR(50);
    DECLARE next_theme VARCHAR(50);

    -- Get the current competition that ends today
    SELECT competition_id, theme 
    INTO current_competition_id, current_theme
    FROM weekly_competitions
    WHERE end_date = CURRENT_DATE
    LIMIT 1;

    -- Proceed only if competition exists
    IF current_competition_id IS NOT NULL THEN

        -- Determine the winning meal and total votes
        SELECT meal_id, COUNT(*) 
        INTO winning_meal_id, total_votes
        FROM meal_votes
        WHERE competition_id = current_competition_id
        GROUP BY meal_id
        ORDER BY COUNT(*) DESC
        LIMIT 1;

        -- Insert winner if found
        IF winning_meal_id IS NOT NULL THEN
            INSERT INTO weekly_winners (competition_id, meal_id, total_votes)
            VALUES (current_competition_id, winning_meal_id, total_votes);
        END IF;

        -- Get next theme in alphabetical order after current theme
        SELECT theme_name 
        INTO next_theme
        FROM competition_themes
        WHERE theme_name > current_theme
        ORDER BY theme_name
        LIMIT 1;

        -- If no next theme, restart from the first theme
        IF next_theme IS NULL THEN
            SELECT theme_name
            INTO next_theme
            FROM competition_themes
            ORDER BY theme_name
            LIMIT 1;
        END IF;

        -- Create new weekly competition for next theme
        INSERT INTO weekly_competitions (start_date, end_date, theme)
        VALUES (
            DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY),
            DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY),
            next_theme
        );

        -- Delete old votes for the ended competition
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
