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
  meal_date date not null default CURRENT_DATE,
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

create table public.meal_likes (
  id serial not null,
  meal_id integer not null,
  user_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint meal_likes_pkey primary key (id),
  constraint meal_likes_meal_id_user_id_key unique (meal_id, user_id),
  constraint meal_likes_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete CASCADE,
  constraint meal_likes_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_meal_likes_meal_id on public.meal_likes using btree (meal_id) TABLESPACE pg_default;

create index IF not exists idx_meal_likes_user_id on public.meal_likes using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_meal_likes_created_at on public.meal_likes using btree (created_at desc) TABLESPACE pg_default;

create trigger trigger_meal_like_count_delete
after DELETE on meal_likes for EACH row
execute FUNCTION update_meal_like_count ();

create trigger trigger_meal_like_count_insert
after INSERT on meal_likes for EACH row
execute FUNCTION update_meal_like_count ();

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
  "Edamam_macros" boolean null,
  meal_type text null,
  cook_time text null,
  like_count integer null default 0,
  constraint meals_pkey primary key (id),
  constraint meals_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
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

create table public.stories (
  id serial not null,
  title character varying(255) not null,
  description text null,
  thumbnail_url text null,
  video_url text not null,
  duration integer not null,
  author_id uuid not null,
  meal_id integer null,
  tags text[] null,
  view_count integer null default 0,
  like_count integer null default 0,
  is_featured boolean null default false,
  is_active boolean null default true,
  visibility_level character varying(20) null default 'public'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint stories_pkey primary key (id),
  constraint stories_author_id_fkey foreign KEY (author_id) references user_profiles (id) on delete CASCADE,
  constraint stories_meal_id_fkey foreign KEY (meal_id) references meals (id) on delete set null,
  constraint stories_visibility_level_check check (
    (
      (visibility_level)::text = any (
        (
          array[
            'public'::character varying,
            'private'::character varying,
            'unlisted'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_stories_author_id on public.stories using btree (author_id) TABLESPACE pg_default;

create index IF not exists idx_stories_meal_id on public.stories using btree (meal_id) TABLESPACE pg_default;

create index IF not exists idx_stories_created_at on public.stories using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_stories_is_featured on public.stories using btree (is_featured) TABLESPACE pg_default
where
  (is_featured = true);

create index IF not exists idx_stories_visibility on public.stories using btree (visibility_level) TABLESPACE pg_default;

create index IF not exists idx_stories_active on public.stories using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger trigger_update_stories_updated_at BEFORE
update on stories for EACH row
execute FUNCTION update_stories_updated_at ();

create table public.story_likes (
  id serial not null,
  story_id integer not null,
  user_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint story_likes_pkey primary key (id),
  constraint story_likes_story_id_user_id_key unique (story_id, user_id),
  constraint story_likes_story_id_fkey foreign KEY (story_id) references stories (id) on delete CASCADE,
  constraint story_likes_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_story_likes_story_id on public.story_likes using btree (story_id) TABLESPACE pg_default;

create index IF not exists idx_story_likes_user_id on public.story_likes using btree (user_id) TABLESPACE pg_default;

create trigger trigger_story_like_count_delete
after DELETE on story_likes for EACH row
execute FUNCTION update_story_like_count ();

create trigger trigger_story_like_count_insert
after INSERT on story_likes for EACH row
execute FUNCTION update_story_like_count ();

create table public.story_views (
  id serial not null,
  story_id integer not null,
  viewer_id uuid null,
  viewed_at timestamp with time zone null default now(),
  ip_address inet null,
  user_agent text null,
  constraint story_views_pkey primary key (id),
  constraint story_views_story_id_fkey foreign KEY (story_id) references stories (id) on delete CASCADE,
  constraint story_views_viewer_id_fkey foreign KEY (viewer_id) references user_profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_story_views_story_id on public.story_views using btree (story_id) TABLESPACE pg_default;

create index IF not exists idx_story_views_viewer_id on public.story_views using btree (viewer_id) TABLESPACE pg_default;

create index IF not exists idx_story_views_viewed_at on public.story_views using btree (viewed_at desc) TABLESPACE pg_default;

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

create table public.user_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  revenue_cat_user_id text null,
  product_id text null,
  is_active boolean null default false,
  is_trial boolean null default false,
  expiration_date timestamp with time zone null,
  will_renew boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_subscriptions_pkey primary key (id),
  constraint user_subscriptions_user_id_key unique (user_id),
  constraint user_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_subscriptions_user_id on public.user_subscriptions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_subscriptions_active on public.user_subscriptions using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_user_subscriptions_revenue_cat on public.user_subscriptions using btree (revenue_cat_user_id) TABLESPACE pg_default;