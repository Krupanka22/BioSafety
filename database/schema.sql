-- Biosafety Platform Database Schema
-- PostgreSQL

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    organization VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Locations Table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    population_density VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Data Table
CREATE TABLE risk_data (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    risk_score DECIMAL(5, 2),
    risk_level VARCHAR(50),
    exposure_score DECIMAL(5, 2),
    vaccination_rate DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    temperature DECIMAL(5, 2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts Table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    location_id INTEGER REFERENCES locations(id),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    severity VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Predictions Table
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    predicted_risk_score DECIMAL(5, 2),
    confidence DECIMAL(5, 2),
    forecast_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exposure Events Table
CREATE TABLE exposure_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    location_id INTEGER REFERENCES locations(id),
    duration_minutes INTEGER,
    distance_meters INTEGER,
    protection_level VARCHAR(50),
    exposure_score DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Data Table
CREATE TABLE analytics_data (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    metric_name VARCHAR(255),
    metric_value DECIMAL(10, 2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_risk_data_location ON risk_data(location_id);
CREATE INDEX idx_risk_data_recorded_at ON risk_data(recorded_at);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_predictions_location ON predictions(location_id);
CREATE INDEX idx_exposure_events_user ON exposure_events(user_id);
