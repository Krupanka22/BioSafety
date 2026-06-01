import os
import json
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime

# Import ML modules
from src.models.riskModel import (
    RiskPredictionModel,
    ExposureAnalyzer,
    PredictiveForecaster,
)
from src.models.analyticsEngine import AnalyticsEngine, ExplainabilityEngine

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize models
risk_model = RiskPredictionModel()
analytics = AnalyticsEngine()
explainability = ExplainabilityEngine()

"""
AI Engine REST API - Endpoints for ML predictions and analytics
"""


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'AI Engine', 'timestamp': datetime.now().isoformat()})


@app.route('/predict-risk', methods=['POST'])
def predict_risk():
    """
    Predict biosafety risk for given features
    """
    try:
        data = request.json
        features = data.get('features', {})

        # Make prediction
        prediction = risk_model.predict_risk(features)

        # Get feature importance
        feature_importance = risk_model.get_feature_importance() or {}

        # Generate explanation
        explanation = explainability.explain_prediction(prediction, feature_importance)

        return jsonify({
            'success': True,
            'prediction': prediction,
            'explanation': explanation,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/calculate-exposure', methods=['POST'])
def calculate_exposure():
    """
    Calculate exposure score from incident data
    """
    try:
        exposure_data = request.json
        result = ExposureAnalyzer.calculate_exposure_score(exposure_data)

        return jsonify({
            'success': True,
            'exposure_analysis': result,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/forecast-risk', methods=['POST'])
def forecast_risk():
    """
    Generate risk forecast for future period
    """
    try:
        data = request.json
        historical_data = data.get('historical_data', [])
        days = data.get('days', 30)

        forecast = PredictiveForecaster.forecast_risk_trend(historical_data, days)

        return jsonify({
            'success': True,
            'forecast': forecast,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/detect-anomalies', methods=['POST'])
def detect_anomalies():
    """
    Detect anomalies in risk data
    """
    try:
        data = request.json
        risk_data = data.get('data', [])
        threshold = data.get('threshold', 2.0)

        anomalies = PredictiveForecaster.detect_anomalies(risk_data, threshold)

        return jsonify({
            'success': True,
            'anomalies_detected': len(anomalies),
            'anomalies': anomalies,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/analyze-trends', methods=['POST'])
def analyze_trends():
    """
    Analyze trends in historical data
    """
    try:
        data = request.json
        historical_data = data.get('historical_data', [])

        trends = analytics.analyze_trends(historical_data)

        return jsonify({
            'success': True,
            'trend_analysis': trends,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/generate-recommendations', methods=['POST'])
def generate_recommendations():
    """
    Generate actionable recommendations
    """
    try:
        data = request.json
        risk_score = data.get('risk_score', 50)
        risk_factors = data.get('risk_factors', {})

        recommendations = analytics.generate_recommendations(risk_score, risk_factors)

        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/correlation-analysis', methods=['GET'])
def correlation_analysis():
    """
    Get correlation matrix for risk factors
    """
    try:
        correlation = analytics.calculate_correlation_matrix([])

        return jsonify({
            'success': True,
            'correlation': correlation,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


# Error handler
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('AI_ENGINE_PORT', 5000))
    app.run(debug=os.getenv('FLASK_ENV') == 'development', port=port, host='0.0.0.0')
