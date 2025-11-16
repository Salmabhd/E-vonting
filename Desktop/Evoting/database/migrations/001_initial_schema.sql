-- ============================================
-- VoteX - Schéma de base de données initial
-- ============================================

USE votex;

-- Table des utilisateurs (votants anonymisés)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL COMMENT 'UUID ou hash du votant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_external_id (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des élections
CREATE TABLE IF NOT EXISTS elections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(150) UNIQUE NOT NULL COMMENT 'Identifiant URL-friendly',
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  metadata JSON COMMENT 'Filtres et paramètres stockés en JSON',
  status ENUM('draft', 'active', 'closed') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des votes
CREATE TABLE IF NOT EXISTS votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  user_external_id VARCHAR(255) NOT NULL,
  choice VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
  UNIQUE KEY unique_vote (election_id, user_external_id),
  INDEX idx_election_user (election_id, user_external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table d'audit admin (pour journalisation)
CREATE TABLE IF NOT EXISTS admin_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_user VARCHAR(100),
  action VARCHAR(255) NOT NULL,
  duration_ms INT COMMENT 'Durée de la requête en millisecondes',
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_user (admin_user),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Affichage du résumé
SELECT 'Schema created successfully!' as status;
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'votex';