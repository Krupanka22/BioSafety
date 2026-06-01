-- Sample seed data for development and testing
-- Insert into locations
INSERT INTO locations (name, region, latitude, longitude, population_density) VALUES
('Central District', 'Metro', 40.7128, -74.0060, 'High'),
('Northern Zone', 'Suburban', 40.7580, -73.9855, 'Medium'),
('Southern Region', 'Rural', 40.6892, -74.0445, 'Low'),
('Eastern Quarter', 'Urban', 40.7282, -73.7949, 'High'),
('Western Sector', 'Suburban', 40.7489, -74.0123, 'Medium');

-- Insert into users
INSERT INTO users (name, email, password_hash, role, organization) VALUES
('John Doe', 'john@example.com', '$2a$10$...', 'user', 'Health Department'),
('Jane Smith', 'jane@example.com', '$2a$10$...', 'admin', 'Public Health Authority'),
('Bob Johnson', 'bob@example.com', '$2a$10$...', 'analyst', 'Risk Management Team');

-- Insert into risk_data
INSERT INTO risk_data (location_id, risk_score, risk_level, exposure_score, vaccination_rate, humidity, temperature)
SELECT 
    l.id,
    RANDOM() * 100,
    CASE WHEN RANDOM() * 100 > 70 THEN 'HIGH' 
         WHEN RANDOM() * 100 > 40 THEN 'MEDIUM' 
         ELSE 'LOW' END,
    RANDOM() * 100,
    RANDOM() * 100,
    40 + RANDOM() * 50,
    15 + RANDOM() * 30
FROM locations l;
