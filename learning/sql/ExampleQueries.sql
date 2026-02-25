SELECT game_name, genres, release_date, price
FROM games
WHERE genres ILIKE '%Casual%'
  AND genres ILIKE '%Indie%'
LIMIT 10; 

SELECT game_name, genres, release_date, price
FROM games
WHERE price < 10 AND game_name ILIKE '%Survival%'
LIMIT 10;

