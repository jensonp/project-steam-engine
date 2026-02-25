const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { loadEnvFile } = require('node:process');
loadEnvFile();

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'localhost',
  database: 'steam_collab',
  user: 'postgres',
  port: 8080
});

app.get("/query", async (req, res) => {
  try {
    const genres = req.query['genres'] || '';
    
    console.log('Genres received:', genres);

    // If no genre selected, return top 10 games
    if (!genres.trim()) {
      const result = await pool.query(`
        SELECT app_id, game_name, genres, price, header_image
        FROM games
        ORDER BY positive_votes DESC
        LIMIT 10
      `);
      return res.json(result.rows.map(row => ({
        appId: row.app_id,
        name: row.game_name,
        genres: row.genres ? row.genres.split(',') : [],
        headerImage: row.header_image,
        price: row.price,
        isFree: parseFloat(row.price) === 0
      })));
    }

    const genreList = genres.split(',').map(g => g.trim());
    const params = genreList.map(g => `%${g}%`);
    const conditions = genreList.map((_, i) => `genres ILIKE $${i + 1}`);

    const query = `
      SELECT app_id, game_name, genres, price, header_image
      FROM games
      WHERE ${conditions.join(' OR ')}
      ORDER BY positive_votes DESC
      LIMIT 10
    `;

    console.log('Query:', query);
    console.log('Params:', params);

    const result = await pool.query(query, params);

    const games = result.rows.map(row => ({
      appId: row.app_id,
      name: row.game_name,
      genres: row.genres ? row.genres.split(',') : [],
      headerImage: row.header_image,
      price: row.price ? parseFloat(row.price) : null,
      isFree: parseFloat(row.price) === 0
    }));

    res.json(games);

  } catch (err) {
    console.error('Query failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});