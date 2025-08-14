create table public.competition_submissions (
  id serial not null,
  user_id uuid not null,
  competition_id integer not null,
  meal_id integer not null,
  submitted_at timestamp with time zone null default now(),
  constraint competition_submissions_pkey primary key (id),
  constraint unique_submission_per_user unique (user_id, competition_id, meal_id),
  constraint competition_submissions_competition_id_fkey foreign KEY (competition_id) references weekly_competitions (competition_id) on delete CASCADE,
  constraint competition_submissions_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint competition_submissions_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.competition_themes (
  theme_id serial not null,
  theme_name character varying(50) not null,
  description text null,
  constraint competition_themes_pkey primary key (theme_id),
  constraint competition_themes_theme_name_key unique (theme_name)
) TABLESPACE pg_default;

create table public.macro_meals (
  id serial not null,
  user_id uuid not null,
  meal_name text null,
  calories double precision null,
  protein double precision null,
  carbs double precision null,
  fat double precision null,
  created_at timestamp with time zone null default now(),
  constraint macro_meals_pkey primary key (id),
  constraint macro_meals_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.meal_ingredients (
  meal_ingredient_id serial not null,
  meal_id integer not null,
  raw_name character varying(255) null,
  quantity double precision null default 1.0,
  unit character varying(50) null,
  constraint meal_ingredients_pkey primary key (meal_ingredient_id),
  constraint meal_ingredients_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.meal_plan (
  meal_plan_id serial not null,
  meal_id integer not null,
  user_id uuid not null,
  date date not null,
  meal_type public.meal_type_enum not null,
  constraint meal_plan_pkey primary key (meal_plan_id),
  constraint meal_plan_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint meal_plan_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.meal_votes (
  vote_id serial not null,
  user_id uuid not null,
  meal_id integer not null,
  competition_id integer not null,
  created_at timestamp with time zone null default now(),
  constraint meal_votes_pkey primary key (vote_id),
  constraint unique_vote_per_user unique (user_id, competition_id, meal_id),
  constraint meal_votes_competition_id_fkey foreign KEY (competition_id) references weekly_competitions (competition_id) on delete CASCADE,
  constraint meal_votes_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint meal_votes_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.meals (
  id serial not null,
  user_id uuid not null,
  name character varying(255) not null,
  description text not null,
  calories integer null,
  protein integer null,
  carbohydrates integer null,
  fat integer null,
  instructions text null,
  "recipeLink" character varying(255) null,
  created_by_ai boolean null default false,
  created_by character varying(255) null,
  favorite boolean null default false,
  dietary_restrictions character varying(255) null,
  servings integer null default 1,
  cuisine character varying(100) null,
  picture bytea null,
  visibility boolean null default true,
  created_at timestamp with time zone null default now(),
  forever_invis boolean not null default false,
  "AI_Macros" boolean null,
  "Edamam_macros" boolean null,
  constraint meals_pkey primary key (id),
  constraint meals_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.pantry (
  pantry_id serial not null,
  user_id uuid not null,
  food text not null,
  quantity double precision null,
  unit character varying(50) null,
  expiration_date date null,
  added_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint pantry_pkey primary key (pantry_id),
  constraint pantry_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.reports (
  report_id serial not null,
  user_id uuid not null,
  meal_id integer not null,
  reason character varying(255) not null,
  status text not null default 'Pending'::text,
  created_at timestamp with time zone null default now(),
  constraint reports_pkey primary key (report_id),
  constraint reports_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint reports_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.reviews (
  review_id serial not null,
  meal_id integer not null,
  user_id uuid not null,
  rating numeric not null,
  comment text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint reviews_pkey primary key (review_id),
  constraint reviews_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint reviews_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint reviews_rating_check check (
    (
      (rating >= (1)::numeric)
      and (rating <= (5)::numeric)
    )
  )
) TABLESPACE pg_default;

create table public.user_grocery_items (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  raw_name text null,
  quantity numeric null,
  unit text null,
  checked boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_grocery_items_pkey primary key (id),
  constraint user_grocery_items_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.user_profiles (
  id uuid not null,
  username character varying(50) not null,
  profile_picture bytea null,
  calories_goal integer null default 2000,
  protein_goal integer null default 80,
  carbohydrates_goal integer null default 300,
  fat_goal integer null default 60,
  dietary_restrictions character varying(255) null,
  allergies character varying(255) null,
  created_at timestamp with time zone null default now(),
  is_admin boolean not null default false,
  ban boolean not null default false,
  ai_usage_count integer not null default 0,
  ai_usage_last_date date null,
  scanner_usage_count integer not null,
  scanner_usage_last_date date null,
  macro_calculation_uses integer not null default 0,
  macro_calculation_uses_last_date date null,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_username_key unique (username),
  constraint user_profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.weekly_competitions (
  competition_id serial not null,
  theme_id integer not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'upcoming'::text,
  created_at timestamp with time zone null default now(),
  constraint weekly_competitions_pkey primary key (competition_id),
  constraint fk_theme_id foreign KEY (theme_id) references competition_themes (theme_id)
) TABLESPACE pg_default;

create table public.weekly_winners (
  winner_id serial not null,
  competition_id integer not null,
  meal_id integer not null,
  user_id uuid null,
  total_votes integer not null,
  declared_at timestamp with time zone null default now(),
  notes text null,
  constraint weekly_winners_pkey primary key (winner_id),
  constraint weekly_winners_competition_id_key unique (competition_id),
  constraint weekly_winners_competition_id_fkey foreign KEY (competition_id) references weekly_competitions (competition_id) on delete CASCADE,
  constraint weekly_winners_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint weekly_winners_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete set null
) TABLESPACE pg_default;