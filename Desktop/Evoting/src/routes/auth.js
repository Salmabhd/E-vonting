const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// ============================================
// ROUTE: Login
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { username, password, expected_role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    // Récupérer l'utilisateur
    const [users] = await pool.execute(
      'SELECT id, username, password, role, full_name, external_id FROM accounts WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const user = users[0];

    // Vérifier le mot de passe (en clair pour la démo)
    // ⚠️ En production, utiliser bcrypt.compare()
    if (user.password !== password) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Vérifier le rôle attendu
    if (expected_role && user.role !== expected_role) {
      return res.status(403).json({ 
        error: `Ce compte n'est pas un compte ${expected_role === 'admin' ? 'administrateur' : 'votant'}` 
      });
    }

    // Mettre à jour last_login
    await pool.execute(
      'UPDATE accounts SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Retourner les infos utilisateur (sans le password)
    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        external_id: user.external_id
      }
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ============================================
// ROUTE: Récupérer info utilisateur par username
// GET /api/auth/user/:username
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