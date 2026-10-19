import type { Quote } from './types';

// The rate as printed: a bare number gets the unit it was calculated with, so
// "2" per mille reads "2‰" rather than passing for 2%.
export const displayRate = (q: Pick<Quote, 'premiumRate' | 'rateBasis'>) => {
  const rate = String(q.premiumRate ?? '').trim();
  if (!q.rateBasis || !/^\d+(\.\d+)?$/.test(rate)) return rate;
  return `${rate}${q.rateBasis === 1000 ? '‰' : '%'}`;
};
