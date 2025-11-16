const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MODE SÉCURISÉ (BASCULEMENT)
// ============================================

// Lire le mode depuis .env (par défaut: mode vulnérable pour la démo)
const SECURE_MODE = process.env.SECURE_MODE === 'true';

// ============================================
// MIDDLEWARES DE SÉCURITÉ
// ============================================

app.use(helmet({
  contentSecurityPolicy: false  // Désactiver pour le développement
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Trop de requêtes, veuillez réessayer plus tard'
});
app.use(limiter);

// Servir les fichiers statiques (frontend)
app.use(express.static('public'));

// ============================================
// ROUTES API
// ============================================

app.get('/api', (req, res) => {
  res.json({
    service: 'VoteX API',
    description: 'Système de vote électronique sécurisé',
    version: '1.0.0',
    status: 'running',
    mode: SECURE_MODE ? 'SÉCURISÉ ✅' : 'VULNÉRABLE ⚠️',
    endpoints: {
      health: '/health',
      auth: '/api/auth/...',
      public: '/api/...',
      admin: '/api/admin/...'
    }
  });
});

app.get('/health', async (req, res) => {
  const dbOk = await testConnection();
  res.json({
    status: dbOk ? 'healthy' : 'unhealthy',
    database: dbOk ? 'connected' : 'disconnected',
    mode: SECURE_MODE ? 'secure' : 'vulnerable',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// IMPORT DES ROUTES (BASCULEMENT)
// ============================================

// Route d'authentification (toujours la même)
const authRoutes = require('./routes/auth');

// Routes avec basculement selon le mode
let publicRoutes, adminRoutes;

if (SECURE_MODE) {
  // Mode sécurisé : utiliser les versions corrigées
  publicRoutes = require('./routes/public.fixed');
  adminRoutes = require('./routes/admin.fixed');
} else {
  // Mode vulnérable : utiliser les versions originales
  publicRoutes = require('./routes/public');
  adminRoutes = require('./routes/admin');
}

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// ============================================
// GESTION DES ERREURS
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Erreur:', err);
  res.status(500).json({
    error: 'Erreur serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

async function startServer() {
  console.log('\n🚀 Démarrage de VoteX...\n');
  
  // Afficher le mode actuel
  if (SECURE_MODE) {
    console.log('🔒 MODE: SÉCURISÉ ✅');
    console.log('   Les versions corrigées des routes sont actives');
    console.log('   Vulnérabilités: CORRIGÉES\n');
  } else {
    console.log('⚠️  MODE: VULNÉRABLE (DÉMO PÉDAGOGIQUE)');
    console.log('   Les versions vulnérables sont actives');
    console.log('   À utiliser uniquement pour la démonstration!\n');
  }
  
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('\n⚠️  ATTENTION: Base de données non connectée');
  }

  app.listen(PORT, () => {
    console.log(`\n✅ Serveur VoteX démarré avec succès!`);
    console.log(`   🌐 Interface: http://localhost:${PORT}`);
    console.log(`   🔧 API: http://localhost:${PORT}/api`);
    console.log(`   📡 Port: ${PORT}`);
    console.log(`   🔐 Mode: ${SECURE_MODE ? 'SÉCURISÉ ✅' : 'VULNÉRABLE ⚠️'}\n`);
    console.log('👤 Comptes de test:');
    console.log('   Votants: alice, bob, charlie (password: password123)');
    console.log('   Admin: admin (password: admin123)\n');
    
    if (!SECURE_MODE) {
      console.log('⚠️  AVERTISSEMENT:');
      console.log('   Le serveur fonctionne en mode VULNÉRABLE');
      console.log('   Pour activer le mode sécurisé, modifiez .env:');
      console.log('   SECURE_MODE=true\n');
    }
  });
}

startServer();

module.exports = app;