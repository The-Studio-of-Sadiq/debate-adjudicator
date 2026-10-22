import type { SpeechPhase } from '@debate/core';

export const colors = {
  bg: '#0f1115',
  surface: '#1a1d24',
  surfaceHi: '#252a33',
  border: '#2f3540',
  text: '#f2f4f8',
  muted: '#9aa3b2',
  accent: '#4f8cff',
  gov: '#4f8cff',
  opp: '#ff7a59',
  danger: '#ff4d4f',
  ok: '#2ecc71',
  warn: '#f5a623',
};

export const phaseColor: Record<SpeechPhase, string> = {
  protected: '#3a4252',
  'poi-open': '#1f8a4c',
  closing: '#c27c0e',
  grace: '#c0392b',
  overtime: '#8e1b1b',
};

export const phaseLabel: Record<SpeechPhase, string> = {
  protected: 'Protected time',
  'poi-open': 'POIs open',
  closing: 'Wrap up',
  grace: 'Grace period',
  overtime: 'Overtime',
};
