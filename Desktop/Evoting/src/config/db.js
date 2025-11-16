const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Fonction de test de connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion MySQL réussie');
    console.log(`   📊 Base de données: ${process.env.DB_NAME}`);
    console.log(`   🖥️  Serveur: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur connexion MySQL:', error.message);
    return false;
  }
}

module.exports = { pool, testConnection };