const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Configuration pour la mitigation temporelle
const MIN_RESPONSE_MS = parseInt(process.env.MIN_RESPONSE_MS) || 200;

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

    // ✅ Requêtes paramétrées (prepared statements)
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

    // ✅ Vérification avec paramètres
    const [existingVotes] = await pool.execute(
      'SELECT id FROM votes WHERE election_id = ? AND user_external_id = ?',
      [election.id, user_external_id]
    );

    if (existingVotes.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà voté' });
    }

    // ✅ Insertion sécurisée
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
// ROUTE SÉCURISÉE: Vérifier si un utilisateur a voté
// GET /api/vote/verify?id=...&election=...
// ✅ FIX: Requêtes paramétrées + mitigation temporelle
// ============================================
router.get('/vote/verify', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id, election } = req.query;

    if (!id || !election) {
      // Attendre le temps minimum avant de répondre
      const elapsed = Date.now() - startTime;
      const remaining = MIN_RESPONSE_MS - elapsed;
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
      
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    // ✅ FIX 1: Requêtes paramétrées (NO SQL injection possible)
    const [electionRows] = await pool.execute(
      'SELECT id FROM elections WHERE slug = ?',
      [election]
    );

    if (electionRows.length === 0) {
      // Temps constant même en cas d'erreur
      const elapsed = Date.now() - startTime;
      const remaining = MIN_RESPONSE_MS - elapsed;
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
      
      return res.status(404).json({ error: 'Élection non trouvée' });
    }

    const electionId = electionRows[0].id;

    // ✅ Requête paramétrée pour vérifier le vote
    const [voteRows] = await pool.execute(
      'SELECT COUNT(*) as c FROM votes WHERE user_external_id = ? AND election_id = ?',
      [id, electionId]
    );

    const voted = voteRows[0].c > 0;

    // ✅ FIX 2: Mitigation temporelle (constant response time)
    // Attendre pour que toutes les réponses prennent MIN_RESPONSE_MS
    const elapsed = Date.now() - startTime;
    const remaining = MIN_RESPONSE_MS - elapsed;
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }

    // Journaliser pour audit
    const finalDuration = Date.now() - startTime;
    console.log(`[VERIFY] id=${id}, election=${election}, voted=${voted}, duration=${finalDuration}ms`);

    res.json({ voted });
    
  } catch (error) {
    console.error('Erreur verify:', error);
    
    // Même en cas d'erreur, respecter le temps minimum
    const elapsed = Date.now() - startTime;
    const remaining = MIN_RESPONSE_MS - elapsed;
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
    
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

    // ✅ Requête paramétrée
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