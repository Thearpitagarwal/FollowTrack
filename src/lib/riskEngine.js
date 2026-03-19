// Pure function — no Firebase dependency
export function computeRiskLevel(attendancePct) {
  if (attendancePct < 60)  return 'critical';
  if (attendancePct < 70)  return 'high';
  if (attendancePct < 75)  return 'medium';
  return 'low';
}

export const RISK_COLORS = {
  critical: { bg: '#FEE2E2', text: '#DC2626', label: 'Critical' },
  high:     { bg: '#FDF1EE', text: '#EF4623', label: 'High'     },
  medium:   { bg: '#FFEDD5', text: '#EA580C', label: 'Medium'   },
  low:      { bg: '#DCFCE7', text: '#16A34A', label: 'Low'      },
};
