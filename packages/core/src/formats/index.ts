// Built-in debate formats. To add one, copy `_template.ts`, then import it
// here and add it to FEATURED (the order is the order shown in the app).
import type { DebateFormat } from '../types';
import { BP } from './bp';
import { DEBATEKEEPER } from './debatekeeper';
import { UADC, UADC_5553 } from './uadc';
import { WSDC } from './wsdc';

export { BP, DEBATEKEEPER, UADC, UADC_5553, WSDC };
export { defineFormat, replyBells, standardBells, validateFormat, type FormatDefinition, type SpeechDefinition } from './define';

/** Our own formats, shown first in the app. */
export const FEATURED = [BP, UADC, UADC_5553, WSDC];

/** Every built-in format: ours, then the Debatekeeper library by name. */
export const PRESETS = [...FEATURED, ...DEBATEKEEPER];

// Regions that read better under their country in a list of formats.
const REGION_GROUPS: Record<string, string> = { 'NSW, Australia': 'Australia', Auckland: 'New Zealand' };

/** The heading a format is listed under: usually a country, or "World". */
export function formatRegion(f: DebateFormat): string | undefined {
  const region = f.info?.region;
  return region && (REGION_GROUPS[region] ?? region.split(', ')[0]);
}
