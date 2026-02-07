-- ============================================
-- LESSON 4: SERIAL Demo (Auto-Increment)
-- ============================================
\c steam_collab

-- 1. Check current sequence value
\echo '=== Current Sequence Value ==='
SELECT last_value FROM users_user_id_seq;

-- 2. See current users
\echo '=== Current Users ==='
SELECT * FROM users;

-- 3. Insert WITHOUT specifying user_id
\echo '=== Inserting test_user (no user_id specified) ==='
INSERT INTO users (username) VALUES ('test_user');

-- 4. See what user_id was auto-assigned
\echo '=== Check auto-assigned user_id ==='
SELECT * FROM users WHERE username = 'test_user';

-- 5. Insert another
\echo '=== Inserting another_user ==='
INSERT INTO users (username) VALUES ('another_user');

-- 6. Check sequence incremented
\echo '=== Sequence value after inserts ==='
SELECT last_value FROM users_user_id_seq;

-- 7. Show all users now
\echo '=== All Users Now ==='
SELECT * FROM users ORDER BY user_id;

-- 8. Cleanup
\echo '=== Cleaning up test users ==='
DELETE FROM users WHERE username IN ('test_user', 'another_user');

\echo '=== Done! Sequence value stays high even after DELETE ==='
SELECT last_value FROM users_user_id_seq;
