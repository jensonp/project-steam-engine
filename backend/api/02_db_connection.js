/**
 * Lesson 2: Connect to PostgreSQL
 * Run: node 02_db_connection.js
 * 
 * First install: npm install pg
 */

const { Pool } = require('pg');

// ============================================
// STEP 1: Configure Connection
// ============================================
const pool = new Pool({
    host: '/var/run/postgresql',
    // port: 8080,           // Your PostgreSQL port
    database: 'steam_collab',
    user: 'cherryquartzio'
    // password: 'your_password'  // Uncomment if needed
});

// ============================================
// STEP 2: Test Connection
// ============================================
async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL!');
        
        // Test query
        const result = await client.query('SELECT COUNT(*) FROM games');
        console.log(`📊 Total games in database: ${result.rows[0].count}`);
        
        client.release();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

// ============================================
// STEP 3: Sample Query
// ============================================
async function getTopGames() {
    try {
        const result = await pool.query(`
            SELECT game_name, positive_votes 
            FROM games 
            ORDER BY positive_votes DESC 
            LIMIT 5
        `);
        
        console.log('\n🎮 Top 5 Games:');
        result.rows.forEach((row, i) => {
            console.log(`  ${i+1}. ${row.game_name} (${row.positive_votes.toLocaleString()} votes)`);
        });
    } catch (err) {
        console.error('❌ Query failed:', err.message);
    }
}

// Run
async function main() {
    await testConnection();
    await getTopGames();
    await pool.end();
}

main();
