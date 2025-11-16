const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedDatabase() {
  console.log('🌱 Peuplement de la base de données...\n');

  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    console.log('✅ Connexion établie\n');

    // Nettoyer les données existantes
    console.log('🧹 Nettoyage des données existantes...');
    await connection.query('DELETE FROM votes');
    await connection.query('DELETE FROM elections');
    console.log('   ✓ Données nettoyées\n');

    // Les utilisateurs sont déjà créés dans la migration 002_add_auth.sql
    console.log('👥 Utilisateurs déjà présents dans la base\n');

    // Créer des élections
    console.log('🗳️  Création des élections...');
    
    const elections = [
      {
        slug: 'president-club-2025',
        name: 'Élection Président du Club 2025',
        category: 'club',
        metadata: JSON.stringify({
          description: 'Élection pour le président du club informatique',
          choices: ['Alice Martin', 'Bob Dupont', 'Charlie Blanc']
        }),
        status: 'active'
      },
      {
        slug: 'meilleur-projet-annee',
        name: 'Meilleur Projet de l\'Année',
        category: 'awards',
        metadata: JSON.stringify({
          description: 'Votez pour le meilleur projet étudiant',
          choices: ['Projet IA', 'Projet Web', 'Projet Mobile', 'Projet IoT']
        }),
        status: 'active'
      },
      {
        slug: 'event-weekend',
        name: 'Activité du Weekend',
        category: 'events',
        metadata: JSON.stringify({
          description: 'Quelle activité pour le prochain weekend?',
          choices: ['Hackathon', 'Sortie Nature', 'Cinéma', 'Restaurant']
        }),
        status: 'active'
      }
    ];

    for (const election of elections) {
      await connection.execute(
        'INSERT INTO elections (slug, name, category, metadata, status) VALUES (?, ?, ?, ?, ?)',
        [election.slug, election.name, election.category, election.metadata, election.status]
      );
      console.log(`   ✓ ${election.name}`);
    }
    console.log(`\n✅ ${elections.length} élections créées\n`);

    // Ajouter quelques votes de test
    console.log('🗳️  Ajout de votes de test...');
    
    const [electionRows] = await connection.query('SELECT id, slug FROM elections');
    
    // Votes pour la première élection (alice et bob ont voté)
    await connection.execute(
      'INSERT INTO votes (election_id, user_external_id, choice) VALUES (?, ?, ?)',
      [electionRows[0].id, 'user-001-alice', 'Alice Martin']
    );
    await connection.execute(
      'INSERT INTO votes (election_id, user_external_id, choice) VALUES (?, ?, ?)',
      [electionRows[0].id, 'user-002-bob', 'Bob Dupont']
    );
    
    console.log('   ✓ 2 votes ajoutés\n');

    // Afficher un résumé
    const [accountCount] = await connection.query('SELECT COUNT(*) as count FROM accounts');
    const [electionCount] = await connection.query('SELECT COUNT(*) as count FROM elections');
    const [voteCount] = await connection.query('SELECT COUNT(*) as count FROM votes');

    console.log('📊 Résumé:');
    console.log(`   - Comptes: ${accountCount[0].count}`);
    console.log(`   - Élections: ${electionCount[0].count}`);
    console.log(`   - Votes: ${voteCount[0].count}\n`);

    console.log('✅ Base de données peuplée avec succès!\n');
    console.log('👤 Comptes disponibles:');
    console.log('   Votants: alice, bob, charlie, diana, eve (password: password123)');
    console.log('   Admin: admin (password: admin123)\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du peuplement:');
    console.error(`   ${error.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seedDatabase();