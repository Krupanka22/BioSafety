import numpy as np
import json
from datetime import datetime, timedelta

"""
Analytics and Insights Engine - Generate actionable insights from data
"""


class AnalyticsEngine:
    """Generate analytics and insights from biosafety data"""

    @staticmethod
    def calculate_correlation_matrix(data):
        """
        Calculate correlation between risk factors
        """
        factors = [
            'population_density',
            'humidity',
            'temperature',
            'exposure_cases',
            'vaccination_rate',
        ]

        # Simulated correlation data
        correlation_matrix = np.random.rand(len(factors), len(factors))

        # Make symmetric
        correlation_matrix = (correlation_matrix + correlation_matrix.T) / 2
        np.fill_diagonal(correlation_matrix, 1)

        return {
            'factors': factors,
            'correlation_matrix': correlation_matrix.tolist(),
        }

    @staticmethod
    def generate_recommendations(risk_score, risk_factors):
        """
        Generate actionable recommendations based on risk profile
        """
        recommendations = []

        if risk_score > 70:
            recommendations.extend([
                {
                    'priority': 'CRITICAL',
                    'action': 'Increase isolation protocols',
                    'estimated_impact': '15-20% risk reduction',
                },
                {
                    'priority': 'CRITICAL',
                    'action': 'Activate emergency response team',
                    'estimated_impact': 'Immediate coordination',
                },
            ])
        elif risk_score > 40:
            recommendations.extend([
                {
                    'priority': 'HIGH',
                    'action': 'Enhanced monitoring and screening',
                    'estimated_impact': '10-15% risk reduction',
                },
                {
                    'priority': 'HIGH',
                    'action': 'Increase health worker PPE availability',
                    'estimated_impact': '5-10% risk reduction',
                },
            ])
        else:
            recommendations.append({
                'priority': 'MEDIUM',
                'action': 'Continue routine monitoring and surveillance',
                'estimated_impact': 'Maintain current status',
            })

        return recommendations

    @staticmethod
    def analyze_trends(historical_data):
        """
        Analyze trends in historical data
        """
        df_data = np.array([d['risk_score'] for d in historical_data])

        # Calculate trend metrics
        recent_mean = np.mean(df_data[-7:])  # Last 7 days
        older_mean = np.mean(df_data[:-7])  # Before last 7 days

        trend = (recent_mean - older_mean) / older_mean * 100 if older_mean != 0 else 0

        return {
            'trend_direction': 'INCREASING' if trend > 0 else 'DECREASING',
            'trend_percentage': float(trend),
            'current_average': float(recent_mean),
            'historical_average': float(older_mean),
            'volatility': float(np.std(df_data)),
        }

    @staticmethod
    def generate_summary_report(data_summary):
        """
        Generate executive summary report
        """
        return {
            'title': 'Biosafety Risk Summary Report',
            'generated_at': datetime.now().isoformat(),
            'period': '30 days',
            'key_metrics': {
                'average_risk_score': data_summary.get('avg_risk', 50),
                'peak_risk_score': data_summary.get('max_risk', 80),
                'lowest_risk_score': data_summary.get('min_risk', 20),
                'total_alerts': data_summary.get('alert_count', 5),
                'critical_events': data_summary.get('critical_count', 1),
            },
            'insights': [
                'Risk levels remain elevated in urban centers',
                'Vaccination rates showing positive correlation with lower risk',
                'Environmental factors significantly impact risk variations',
            ],
        }


class ExplainabilityEngine:
    """Provide explainable AI interpretations"""

    @staticmethod
    def explain_prediction(prediction, feature_importance):
        """
        Generate natural language explanation for predictions
        """
        score = prediction['risk_score']
        category = prediction['risk_category']

        explanation = f"The current biosafety risk is estimated at {score:.1f} ({category}). "

        # Find top contributing factors
        sorted_factors = sorted(
            feature_importance.items(), key=lambda x: x[1], reverse=True
        )[:3]

        explanation += "Contributing factors: "
        explanation += ", ".join([f"{factor} ({importance:.1%})" for factor, importance in sorted_factors])

        return {
            'prediction': prediction,
            'explanation': explanation,
            'confidence': prediction['confidence'],
            'top_factors': sorted_factors,
        }

    @staticmethod
    def explain_alert(alert_data):
        """
        Generate explanation for triggered alerts
        """
        return {
            'alert_id': alert_data.get('id'),
            'reason': f"Risk threshold of {alert_data.get('threshold', 70)} exceeded",
            'current_value': alert_data.get('current_value', 0),
            'recommended_action': 'Review exposure data and activate monitoring protocols',
        }


class DataAggregator:
    """Aggregate and preprocess data for analysis"""

    @staticmethod
    def aggregate_by_region(location_data):
        """
        Aggregate risk data by geographic region
        """
        regional_data = {}

        for location in location_data:
            region = location['region']
            if region not in regional_data:
                regional_data[region] = []
            regional_data[region].append(location['risk_score'])

        summary = {}
        for region, scores in regional_data.items():
            summary[region] = {
                'average_risk': float(np.mean(scores)),
                'max_risk': float(np.max(scores)),
                'min_risk': float(np.min(scores)),
                'std_dev': float(np.std(scores)),
            }

        return summary

    @staticmethod
    def prepare_for_visualization(data):
        """
        Transform data for frontend visualization
        """
        return {
            'timestamp': datetime.now().isoformat(),
            'data_points': len(data),
            'visualization_format': 'timeseries',
            'data': data,
        }


if __name__ == '__main__':
    print("Analytics Engine initialized")
