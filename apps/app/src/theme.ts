import type { SpeechPhase } from '@debate/core';

/**
 * Black-and-white theme. With no colour to lean on, meaning is carried by
 * brightness, filled-vs-outlined controls and words (every phase is also
 * named in text), which also keeps the app readable for colour-blind users.
 */
export const colors = {
  bg: '#000000',
  surface: '#0f0f0f',
  surfaceHi: '#1d1d1d',
  border: '#3a3a3a',
  text: '#ffffff',
  muted: '#a3a3a3',
  /** Filled primary controls: white with black text. */
  primary: '#ffffff',
  onPrimary: '#000000',
  /** Opposition is a step dimmer than Government wherever sides are shown. */
  gov: '#ffffff',
  opp: '#b8b8b8',
};

/** Timer card background per phase: gets brighter as time runs out. */
export const phaseColor: Record<SpeechPhase, string> = {
  protected: '#141414',
  'poi-open': '#2a2a2a',
  closing: '#5a5a5a',
  grace: '#e8e8e8',
  overtime: '#ffffff',
};

/** Text colour on top of each phase background. */
export const phaseText: Record<SpeechPhase, string> = {
  protected: '#ffffff',
  'poi-open': '#ffffff',
  closing: '#ffffff',
  grace: '#000000',
  overtime: '#000000',
};
