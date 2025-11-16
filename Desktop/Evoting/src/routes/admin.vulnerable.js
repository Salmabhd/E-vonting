const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

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

    // Stocker metadata (peut contenir des filtres SQL bruts)
    const metadataJson = JSON.stringify(metadata || {});

    await pool.execute(
      'INSERT INTO elections (slug, name, category, metadata, status) VALUES (?, ?, ?, ?, ?)',
      [slug, name, category, metadataJson, 'draft']
    );

    res.json({ message: 'Élection créée', slug });
  } catch (error) {
    console.error('Erreur création élection:', error);
    res.status(500).json({ error: 'Erreur création' });
  }
});

// ============================================
// ROUTE VULNÉRABLE: Générer un rapport
// POST /api/admin/report/run
// ⚠️ SECOND-ORDER SQLi
// ============================================
router.post('/report/run', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { filter_id } = req.body;

    if (!filter_id) {
      return res.status(400).json({ error: 'filter_id requis' });
    }

    // Récupérer les métadonnées de l'élection
    const [elections] = await pool.execute(
      'SELECT metadata FROM elections WHERE id = ?',
      [filter_id]
    );

    if (elections.length === 0) {
      return res.status(404).json({ error: 'Élection non trouvée' });
    }

    const metadata = JSON.parse(elections[0].metadata);

    // ⚠️ VULNÉRABILITÉ: Utilisation directe de metadata.filter dans SQL
    if (metadata.filter) {
      const sql = `SELECT choice, COUNT(*) as votes FROM votes WHERE ${metadata.filter} GROUP BY choice`;
      const [results] = await pool.query(sql);

      const duration = Date.now() - startTime;

      // Audit trail
      await pool.execute(
        'INSERT INTO admin_audit (admin_user, action, duration_ms, details) VALUES (?, ?, ?, ?)',
        ['admin', 'report_run', duration, JSON.stringify({ filter_id })]
      );

      return res.json({ results, duration_ms: duration });
    }

    res.status(400).json({ error: 'Aucun filtre défini' });
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