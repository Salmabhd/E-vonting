const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// ============================================
// ROUTE: Soumettre un vote
// POST /api/vote
// ============================================
router.post('/vote', async (req, res) => {
  try {
    const { election_slug, user_external_id, choice } = req.body;

    if (!election_slug || !user_external_id || !choice) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Récupérer l'ID de l'élection
    const [elections] = await pool.execute(
      'SELECT id, status FROM elections WHERE slug = ?',
      [election_slug]
    );

    if (elections.length === 0) {
      return res.status(404).json({ error: 'Élection non trouvée' });
    }

    const election = elections[0];

    if (election.status !== 'active') {
      return res.status(400).json({ error: 'Élection non active' });
    }

    // Vérifier si l'utilisateur a déjà voté
    const [existingVotes] = await pool.execute(
      'SELECT id FROM votes WHERE election_id = ? AND user_external_id = ?',
      [election.id, user_external_id]
    );

    if (existingVotes.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà voté' });
    }

    // Enregistrer le vote
    await pool.execute(
      'INSERT INTO votes (election_id, user_external_id, choice) VALUES (?, ?, ?)',
      [election.id, user_external_id, choice]
    );

    res.json({ message: 'Vote enregistré avec succès' });
  } catch (error) {
    console.error('Erreur vote:', error);
    res.status(500).json({ error: 'Erreur lors du vote' });
  }
});

// ============================================
// ROUTE VULNÉRABLE: Vérifier si un utilisateur a voté
// GET /api/vote/verify?id=...&election=...
// ⚠️ TIME-BASED BLIND SQLi
// ============================================
router.get('/vote/verify', async (req, res) => {
  try {
    const { id, election } = req.query;

    if (!id || !election) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    // ⚠️ VULNÉRABILITÉ: Concaténation SQL directe
    const sql = `SELECT COUNT(*) as c FROM votes 
                 WHERE user_external_id = '${id}' 
                 AND election_id = (SELECT id FROM elections WHERE slug='${election}')`;

    const [rows] = await pool.query(sql);
    const voted = rows[0].c > 0;

    res.json({ voted });
  } catch (error) {
    console.error('Erreur verify:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

// ============================================
// ROUTE: Informations sur une élection
// GET /api/election/:slug
// ============================================
router.get('/election/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const [elections] = await pool.execute(
      'SELECT id, slug, name, category, status, created_at FROM elections WHERE slug = ?',
      [slug]
    );

    if (elections.length === 0) {
      return res.status(404).json({ error: 'Élection non trouvée' });
    }

    res.json(elections[0]);
  } catch (error) {
    console.error('Erreur election:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

module.exports = router;