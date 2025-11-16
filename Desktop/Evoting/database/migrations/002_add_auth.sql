USE votex;

-- Table des comptes utilisateurs (pour l'authentification)
CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL COMMENT 'Hash du mot de passe',
  role ENUM('voter', 'admin') DEFAULT 'voter',
  full_name VARCHAR(255),
  external_id VARCHAR(255) COMMENT 'Lien avec la table users pour les voters',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter des comptes de test
-- Mot de passe simple pour la démo : "password123"
-- En production, utiliser bcrypt pour hasher les mots de passe

INSERT INTO accounts (username, password, role, full_name, external_id) VALUES
('alice', 'password123', 'voter', 'Alice Martin', 'user-001-alice'),
('bob', 'password123', 'voter', 'Bob Dupont', 'user-002-bob'),
('charlie', 'password123', 'voter', 'Charlie Blanc', 'user-003-charlie'),
('diana', 'password123', 'voter', 'Diana Green', 'user-004-diana'),
('eve', 'password123', 'voter', 'Eve Wilson', 'user-005-eve'),
('admin', 'admin123', 'admin', 'Administrateur', NULL);

SELECT 'Comptes créés avec succès!' as status;