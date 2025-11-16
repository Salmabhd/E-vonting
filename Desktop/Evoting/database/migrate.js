const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrations() {
  console.log('🔧 Démarrage des migrations...\n');

  let connection;
  
  try {
    // Connexion à MySQL
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Connexion établie\n');

    // Lecture du dossier migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️  Aucun fichier de migration trouvé');
      return;
    }

    console.log(`📦 ${files.length} fichier(s) de migration trouvé(s)\n`);

    // Exécution de chaque migration
    for (const file of files) {
      console.log(`   ➤ Exécution: ${file}`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      await connection.query(sql);
      console.log(`   ✓ ${file} - OK\n`);
    }

    console.log('✅ Toutes les migrations ont été exécutées avec succès!\n');

    // Affichage des tables créées
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📊 Tables créées:');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:');
    console.error(`   ${error.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Exécution
runMigrations();