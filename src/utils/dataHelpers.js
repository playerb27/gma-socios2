/**
 * GMA SOCIOS 2 - Data Helpers
 * Centralized logic for data normalization and formatting.
 */

/**
 * Normalizes a partner name to ensure consistency across the platform.
 * Use this whenever comparing or grouping by partner names.
 */
export const normalizeSocioName = (name) => {
  if (!name) return 'Desconocido';
  let n = String(name).trim().toUpperCase();
  
  // Known variations mapping
  if (n.includes('JESUS') || n.includes('YMAY')) return 'Federico de Jesus Baena Ymay';
  if (n.includes('QUIJANO') && !n.includes('JESUS')) return 'Federico Baena Quijano';
  if (n.includes('ANTEA') || n.includes('GRUPO')) return 'GRUPO DENTAL ANTEA';
  if (n.includes('EDUARDO')) return 'DR. EDUARDO';
  
  // Return trimmed Title Case version if no match (optional, but keep consistent)
  return String(name).trim();
};

/**
 * Formats a number as MXN currency.
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

/**
 * Formats a number with thousands separators but no currency symbol.
 */
export const formatNumber = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

/**
 * Extracts a numeric value from multiple possible field names (schema drift handling).
 */
export const getAmount = (data) => {
  if (!data) return 0;
  return Number(data.valor || data.cantidad || data.amount || 0);
};

/**
 * Extracts the investor name from multiple possible field names.
 */
export const getInvestorName = (data) => {
  if (!data) return 'Desconocido';
  // Support both camelCase (Firebase) and snake_case (Supabase)
  return data.socio || data.nombreInversionista || data.nombre_inversionista || data.partner || 'Desconocido';
};

/**
 * Financial Phase Logic: Determines how utility is split.
 */
export const calculateFinancialPhase = (totalInvested, totalPaidBack, rules) => {
  const currentRules = rules || {
    recovery: { investor: 85, doctor: 15 },
    profit: { investor: 66.6, doctor: 33.3 }
  };

  const investmentRemaining = Math.max(0, totalInvested - totalPaidBack);
  
  if (investmentRemaining <= 0) {
    return {
      phase: 'utilidad',
      label: 'Fase de Utilidades',
      investorShare: currentRules.profit.investor,
      doctorShare: currentRules.profit.doctor
    };
  }

  return {
    phase: 'recuperacion',
    label: 'Fase de Recuperación',
    investorShare: currentRules.recovery.investor,
    doctorShare: currentRules.recovery.doctor,
    remaining: investmentRemaining
  };
};
