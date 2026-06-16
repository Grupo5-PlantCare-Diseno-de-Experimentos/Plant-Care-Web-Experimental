import { describe, it, expect } from 'vitest';
import {
  consecutiveSafeDays,
  dayKey,
  EXPERT_STREAK_DAYS,
} from '../../src/experiments/gamification/expert-caretaker';

/** Construye la clave de día desplazada `offset` días respecto a `today`. */
function keyDaysAgo(today: Date, offset: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - offset);
  return dayKey(d);
}

describe('expert-caretaker · consecutiveSafeDays', () => {
  const today = new Date('2026-06-15T12:00:00.000Z');

  it('devuelve la racha máxima cuando no hay días críticos', () => {
    expect(consecutiveSafeDays([], today)).toBe(EXPERT_STREAK_DAYS);
  });

  it('devuelve 0 si hoy tuvo una alerta crítica', () => {
    const critical = [keyDaysAgo(today, 0)];
    expect(consecutiveSafeDays(critical, today)).toBe(0);
  });

  it('cuenta los días consecutivos seguros antes del primer día crítico', () => {
    // Crítico hace 3 días → hoy, -1 y -2 son seguros = 3.
    const critical = [keyDaysAgo(today, 3)];
    expect(consecutiveSafeDays(critical, today)).toBe(3);
  });

  it('un día sin lecturas (gap) no rompe la racha', () => {
    // Sólo marcamos crítico hace 5 días; los gaps intermedios no cuentan.
    const critical = [keyDaysAgo(today, 5)];
    expect(consecutiveSafeDays(critical, today)).toBe(5);
  });

  it('desbloquea con 7 días consecutivos sin alertas críticas', () => {
    const streak = consecutiveSafeDays([keyDaysAgo(today, 10)], today);
    expect(streak).toBeGreaterThanOrEqual(EXPERT_STREAK_DAYS);
  });
});
