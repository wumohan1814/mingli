import { SIGNS_FULL } from './signs-full.js';
import { enrichSsgwSign } from './interpretation.js';
export { SSGW_INTERPRETATION_FIELDS } from './types.js';
// 三山国王灵签数据（共92签，源自官方版本）
export const SSGW_SIGNS = SIGNS_FULL.map(enrichSsgwSign);
