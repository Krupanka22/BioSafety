import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from joblib import dump, load
import json
from datetime import datetime, timedelta

"""
Risk Prediction Engine - Main ML model for biosafety risk scoring
"""


class RiskPredictionModel:
    """Multi-factor biosafety risk prediction model"""

    def __init__(self, model_type='ensemble'):
        self.model_type = model_type
        self.risk_classifier = None
        self.risk_regressor = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'population_density',
            'humidity',
            'temperature',
            'pathogen_presence',
            'exposure_cases',
            'vaccination_rate',
            'hygiene_score',
            'isolation_effectiveness',
            'environmental_samples',
            'temporal_index',
        ]

    def prepare_features(self, data):
        """
        Prepare and normalize features for prediction
        """
        df = pd.DataFrame(data)
        df = df[self.feature_names]
        df_normalized = self.scaler.fit_transform(df)
        return df_normalized

    def train_model(self, training_data, labels):
        """
        Train the ensemble model
        """
        X = self.prepare_features(training_data)
        y_binary = (np.array(labels) > 50).astype(int)  # Binary classification
        y_continuous = np.array(labels)  # Continuous regression

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_binary, test_size=0.2, random_state=42
        )

        # Train classifier for risk level
        self.risk_classifier = RandomForestClassifier(
            n_estimators=100, max_depth=15, random_state=42
        )
        self.risk_classifier.fit(X_train, y_train)

        # Train regressor for risk score
        self.risk_regressor = GradientBoostingRegressor(
            n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
        )
        self.risk_regressor.fit(X, y_continuous)

        return {
            'classifier_accuracy': self.risk_classifier.score(X_test, y_test),
            'regressor_r2': self.risk_regressor.score(X, y_continuous),
        }

    def predict_risk(self, features):
        """
        Predict biosafety risk level
        """
        X = self.prepare_features([features])

        # Get predictions
        risk_level = self.risk_classifier.predict(X)[0]
        risk_score = self.risk_regressor.predict(X)[0]

        # Map to categories
        if risk_score >= 75:
            category = 'CRITICAL'
        elif risk_score >= 50:
            category = 'HIGH'
        elif risk_score >= 25:
            category = 'MEDIUM'
        else:
            category = 'LOW'

        return {
            'risk_score': float(risk_score),
            'risk_category': category,
            'confidence': float(self.risk_classifier.predict_proba(X)[0].max()),
        }

    def get_feature_importance(self):
        """
        Get feature importance scores
        """
        if self.risk_regressor is None:
            return None

        importances = self.risk_regressor.feature_importances_
        return {
            name: float(importance)
            for name, importance in zip(self.feature_names, importances)
        }

    def save_model(self, filepath):
        """Save model to disk"""
        dump(
            {
                'classifier': self.risk_classifier,
                'regressor': self.risk_regressor,
                'scaler': self.scaler,
                'feature_names': self.feature_names,
            },
            filepath,
        )

    def load_model(self, filepath):
        """Load model from disk"""
        data = load(filepath)
        self.risk_classifier = data['classifier']
        self.risk_regressor = data['regressor']
        self.scaler = data['scaler']
        self.feature_names = data['feature_names']


class ExposureAnalyzer:
    """Analyze exposure patterns and calculate exposure scores"""

    @staticmethod
    def calculate_exposure_score(exposure_data):
        """
        Calculate comprehensive exposure score
        """
        duration = exposure_data.get('duration_minutes', 0)
        distance = exposure_data.get('distance_meters', 0)
        protection_level = exposure_data.get('protection_level', 0)  # 0-100
        pathogen_viral_load = exposure_data.get('viral_load', 0)  # 0-100

        # Base score calculation
        duration_score = min(duration / 60 * 10, 100)  # Normalize to 100
        distance_score = max(100 - (distance / 2), 0)  # Closer = higher risk
        protection_score = (100 - protection_level) * 0.7  # Protection reduces risk

        # Weighted combination
        exposure_score = (
            duration_score * 0.3
            + distance_score * 0.35
            + protection_score * 0.25
            + pathogen_viral_load * 0.1
        )

        return {
            'exposure_score': float(min(exposure_score, 100)),
            'risk_level': 'HIGH' if exposure_score > 70 else 'MEDIUM' if exposure_score > 40 else 'LOW',
            'time_to_safe_hours': ExposureAnalyzer.calculate_time_to_safe(
                exposure_score, pathogen_viral_load
            ),
        }

    @staticmethod
    def calculate_time_to_safe(exposure_score, viral_load):
        """
        Calculate hours until exposure becomes safe
        """
        # Simplified model: higher exposure/viral load = longer time
        base_time = 24
        multiplier = 1 + (exposure_score / 100) * (viral_load / 100)
        return int(base_time * multiplier)


class PredictiveForecaster:
    """Generate predictive forecasts for future risk"""

    @staticmethod
    def forecast_risk_trend(historical_data, days=30):
        """
        Forecast risk trend for specified number of days
        """
        df = pd.DataFrame(historical_data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')

        # Simple moving average for trend
        df['ma7'] = df['risk_score'].rolling(window=7).mean()

        # Generate forecast
        last_date = df['date'].max()
        forecast = []

        for i in range(1, days + 1):
            forecast_date = last_date + timedelta(days=i)
            # Simple linear extrapolation with seasonal adjustment
            trend_value = df['ma7'].iloc[-1] + (i * 0.5)  # Slight uptrend
            seasonal_adjustment = 10 * np.sin(2 * np.pi * i / 30)

            forecast.append({
                'date': forecast_date.isoformat(),
                'predicted_risk_score': float(
                    max(0, min(100, trend_value + seasonal_adjustment))
                ),
                'confidence_interval': [
                    max(0, trend_value + seasonal_adjustment - 10),
                    min(100, trend_value + seasonal_adjustment + 10),
                ],
            })

        return forecast

    @staticmethod
    def detect_anomalies(data, threshold=2.0):
        """
        Detect anomalies in risk data using statistical methods
        """
        df = pd.DataFrame(data)
        mean = df['risk_score'].mean()
        std = df['risk_score'].std()

        anomalies = []
        for idx, row in df.iterrows():
            z_score = abs((row['risk_score'] - mean) / std)
            if z_score > threshold:
                anomalies.append(
                    {'date': row['date'], 'risk_score': row['risk_score'], 'z_score': z_score}
                )

        return anomalies


if __name__ == '__main__':
    # Example usage
    print("Biosafety Risk Prediction Engine initialized")
