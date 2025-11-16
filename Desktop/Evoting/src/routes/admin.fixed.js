const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// ============================================
// WHITELIST pour les filtres sécurisés
// ============================================
const ALLOWED_FILTER_FIELDS = ['election_id', 'created_at', 'choice'];
const ALLOWED_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'IN', 'LIKE'];

// ============================================
// Fonction de validation et construction de filtres
// ============================================
function buildSecureWhereClause(filterConfig) {
  if (!filterConfig || typeof filterConfig !== 'object') {
    throw new Error('Configuration de filtre invalide');
  }

  const { field, operator, value } = filterConfig;

  // ✅ Validation stricte du champ
  if (!ALLOWED_FILTER_FIELDS.includes(field)) {
    throw new Error(`Champ non autorisé: ${field}. Champs autorisés: ${ALLOWED_FILTER_FIELDS.join(', ')}`);
  }

  // ✅ Validation stricte de l'opérateur
  if (!ALLOWED_OPERATORS.includes(operator)) {
    throw new Error(`Opérateur non autorisé: ${operator}. Opérateurs autorisés: ${ALLOWED_OPERATORS.join(', ')}`);
  }

  // ✅ Construction sécurisée avec placeholders
  // Le nom du champ est validé par whitelist, donc sûr de l'inclure directement
  // La valeur sera passée via paramètre
  return {
    clause: `${field} ${operator} ?`,
    params: [value]
  };
}

// ============================================
// ROUTE: Créer une élection
// POST /api/admin/election
// ============================================
router.post('/election', async (req, res) => {
  try {
    const { slug, name, category, metadata } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: 'slug et name requis' });
    }

    // ✅ Validation et structuration des métadonnées
    let validatedMetadata = {};
    
    if (metadata) {
      // Si metadata contient un filtre, le valider
      if (metadata.filter) {
        try {
          // Valider la structure du filtre
          const filterConfig = metadata.filter;
          
          if (typeof filterConfig === 'string') {
            // ✅ FIX: Ne plus accepter de chaînes SQL brutes
            return res.status(400).json({ 
              error: 'Format de filtre invalide. Utilisez un objet structuré.',
              example: { field: 'election_id', operator: '=', value: 1 }
            });
          }
          
          // Valider le filtre structuré
          buildSecureWhereClause(filterConfig);
          validatedMetadata.filter = filterConfig;
        } catch (validationError) {
          return res.status(400).json({ 
            error: `Filtre invalide: ${validationError.message}` 
          });
        }
      }
      
      // Copier les autres métadonnées sûres
      if (metadata.description) validatedMetadata.description = metadata.description;
      if (metadata.choices) validatedMetadata.choices = metadata.choices;
    }

    const metadataJson = JSON.stringify(validatedMetadata);

    // ✅ Requête paramétrée
    await pool.execute(
      'INSERT INTO elections (slug, name, category, metadata, status) VALUES (?, ?, ?, ?, ?)',
      [slug, name, category, metadataJson, 'draft']
    );

    res.json({ message: 'Élection créée avec succès', slug });
  } catch (error) {
    console.error('Erreur création élection:', error);
    res.status(500).json({ error: 'Erreur création' });
  }
});

// ============================================
// ROUTE SÉCURISÉE: Générer un rapport
// POST /api/admin/report/run
// ✅ FIX: Validation stricte + requêtes paramétrées
// ============================================
router.post('/report/run', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { filter_id } = req.body;

    if (!filter_id) {
      return res.status(400).json({ error: 'filter_id requis' });
    }

    // ✅ Récupération sécurisée des métadonnées
    const [elections] = await pool.execute(
      'SELECT metadata FROM elections WHERE id = ?',
      [filter_id]
    );

    if (elections.length === 0) {
      return res.status(404).json({ error: 'Élection non trouvée' });
    }

    const metadata = JSON.parse(elections[0].metadata);

    // ✅ FIX: Validation stricte du filtre
    if (metadata.filter) {
      try {
        // Construire une clause WHERE sécurisée
        const { clause, params } = buildSecureWhereClause(metadata.filter);
        
        // ✅ Requête sécurisée avec paramètres
        const sql = `SELECT choice, COUNT(*) as votes FROM votes WHERE ${clause} GROUP BY choice`;
        const [results] = await pool.execute(sql, params);

        const duration = Date.now() - startTime;

        // Audit trail
        await pool.execute(
          'INSERT INTO admin_audit (admin_user, action, duration_ms, details) VALUES (?, ?, ?, ?)',
          ['admin', 'report_run', duration, JSON.stringify({ 
            filter_id, 
            filter_used: metadata.filter,
            secure: true 
          })]
        );

        return res.json({ 
          results, 
          duration_ms: duration,
          filter_applied: metadata.filter
        });
        
      } catch (validationError) {
        return res.status(400).json({ 
          error: `Filtre invalide: ${validationError.message}` 
        });
      }
    }

    res.status(400).json({ error: 'Aucun filtre défini dans les métadonnées' });
    
  } catch (error) {
    console.error('Erreur rapport:', error);
    res.status(500).json({ error: 'Erreur génération rapport' });
  }
});

// ============================================
// ROUTE: Activer une élection
// PATCH /api/admin/election/:slug/activate
// ============================================
router.patch('/election/:slug/activate', async (req, res) => {
  try {
    const { slug } = req.params;

    // ✅ Requête paramétrée
    await pool.execute(
      'UPDATE elections SET status = ? WHERE slug = ?',
      ['active', slug]
    );

    res.json({ message: 'Élection activée', slug });
  } catch (error) {
    console.error('Erreur activation:', error);
    res.status(500).json({ error: 'Erreur activation' });
  }
});

// ============================================
// ROUTE: Récupérer info utilisateur
// GET /api/admin/user/:username
// ============================================
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // ✅ Requête paramétrée
    const [users] = await pool.execute(
      'SELECT id, username, role, full_name, external_id FROM accounts WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Erreur récupération user:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;