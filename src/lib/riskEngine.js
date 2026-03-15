// Pure function — no Firebase dependency
export function computeRiskLevel(attendancePct) {
  if (attendancePct < 50)  return 'critical';
  if (attendancePct < 65)  return 'high';
  if (attendancePct < 75)  return 'medium';
  return 'low';
}

export const RISK_COLORS = {
  critical: { bg: '#FEE2E2', text: '#DC2626', label: 'Critical' },
  high:     { bg: '#FEF3C7', text: '#D97706', label: 'High'     },
  medium:   { bg: '#DBEAFE', text: '#2563EB', label: 'Medium'   },
  low:      { bg: '#DCFCE7', text: '#16A34A', label: 'Low'      },
};
