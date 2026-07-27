import { RecurrenceType, RecurrenceUnit } from '../types';

export function getNextOccurrence(
  anchorDate: string,
  occurrenceDate: string | null,
  completedAt: Date | null,
  recurrence: {
    type: RecurrenceType;
    interval: number;
    unit: RecurrenceUnit;
  }
): string | null {
  const { type, interval, unit } = recurrence;
  if (type === 'none') return null;

  const A = new Date(anchorDate + 'T00:00:00');
  const D = occurrenceDate ? new Date(occurrenceDate + 'T00:00:00') : new Date(A);
  const C = completedAt ? new Date(completedAt) : new Date();
  
  A.setHours(0, 0, 0, 0);
  D.setHours(0, 0, 0, 0);
  const C_day = new Date(C);
  C_day.setHours(0, 0, 0, 0);

  const maxDC = D > C_day ? D : C_day;

  let effectiveInterval = interval;
  let effectiveUnit = unit;

  if (type === 'daily') {
    effectiveInterval = 1;
    effectiveUnit = 'days';
  } else if (type === 'weekly') {
    effectiveInterval = 1;
    effectiveUnit = 'weeks';
  } else if (type === 'monthly') {
    effectiveInterval = 1;
    effectiveUnit = 'months';
  } else if (type === 'quarterly') {
    effectiveInterval = 3;
    effectiveUnit = 'months';
  } else if (type === 'workdays') {
    effectiveInterval = 1;
    effectiveUnit = 'days';
  }

  const getS_n = (n: number): Date => {
    const next = new Date(A);
    if (effectiveUnit === 'days') {
      next.setDate(A.getDate() + (n * effectiveInterval));
    } else if (effectiveUnit === 'weeks') {
      next.setDate(A.getDate() + (n * effectiveInterval * 7));
    } else if (effectiveUnit === 'months') {
      const targetMonth = A.getMonth() + (n * effectiveInterval);
      const targetDay = A.getDate();
      
      // Set to 1st first to avoid overflow issues when transitioning
      next.setDate(1);
      next.setMonth(targetMonth);
      
      // Get last day of target month
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDay, lastDay));
    }
    next.setHours(0, 0, 0, 0);
    return next;
  };

  let n = 0;
  let Sn = getS_n(n);

  // We want min Sn > maxDC
  // And if workdays, Sn must not be Sat(6) or Sun(0)
  while (true) {
    if (Sn > maxDC) {
      if (type === 'workdays') {
        const day = Sn.getDay();
        if (day !== 0 && day !== 6) break;
      } else {
        break;
      }
    }
    n++;
    Sn = getS_n(n);
    
    // Safety break to prevent infinite loops (e.g. 10 years out)
    if (n > 5000) break;
  }

  return Sn.toISOString().split('T')[0];
}
