// Built-in debate formats. To add one, copy `_template.ts`, then import it
// here and add it to PRESETS (the order is the order shown in the app).
import { BP } from './bp';
import { UADC } from './uadc';
import { WSDC } from './wsdc';

export { BP, UADC, WSDC };
export { defineFormat, replyBells, standardBells, validateFormat, type FormatDefinition, type SpeechDefinition } from './define';

export const PRESETS = [BP, UADC, WSDC];
