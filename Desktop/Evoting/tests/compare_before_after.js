const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';

async function measureResponseTime(id, election) {
  const start = Date.now();
  try {
    const response = await fetch(`${API_URL}/vote/verify?id=${id}&election=${election}`);
    await response.json();
    return Date.now() - start;
  } catch (error) {
    return -1;
  }
}

async function compareBeforeAfter() {
  console.log('\n📊 COMPARAISON AVANT/APRÈS CORRECTION\n');
  console.log('═'.repeat(80));
  
  console.log('\n🔍 Test 1: Time-based SQLi\n');
  
  // Test normal
  const normalTimes = [];
  for (let i = 0; i < 5; i++) {
    const time = await measureResponseTime('user-001-alice', 'president-club-2025');
    normalTimes.push(time);
  }
  
  // Test avec injection SLEEP
  const injectedTimes = [];
  for (let i = 0; i < 5; i++) {
    const time = await measureResponseTime("user-001-alice' OR SLEEP(1) -- ", 'president-club-2025');
    injectedTimes.push(time);
  }
  
  const avgNormal = normalTimes.reduce((a, b) => a + b) / normalTimes.length;
  const avgInjected = injectedTimes.reduce((a, b) => a + b) / injectedTimes.length;
  const difference = avgInjected - avgNormal;
  
  console.log('Métrique                    | Valeur');
  console.log('-'.repeat(60));
  console.log(`Requête normale (moy.)      | ${avgNormal.toFixed(1)}ms`);
  console.log(`Requête avec SLEEP(1) (moy.)| ${avgInjected.toFixed(1)}ms`);
  console.log(`Différence                  | ${difference.toFixed(1)}ms`);
  console.log(`Vulnérable?                 | ${difference > 500 ? '✗ OUI' : '✓ NON (corrigé)'}`);
  
  console.log('\n═'.repeat(80));
}

if (require.main === module) {
  compareBeforeAfter();
}