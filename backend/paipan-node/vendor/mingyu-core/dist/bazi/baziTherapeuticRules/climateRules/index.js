import { GENERAL_CLIMATE_RULES } from './general.js';
import { JIA_CLIMATE_RULES } from './jia/index.js';
import { YI_CLIMATE_RULES } from './yi/index.js';
import { BING_CLIMATE_RULES } from './bing/index.js';
import { DING_CLIMATE_RULES } from './ding/index.js';
import { WU_CLIMATE_RULES } from './wu/index.js';
import { JI_CLIMATE_RULES } from './ji/index.js';
import { GENG_CLIMATE_RULES } from './geng/index.js';
import { XIN_CLIMATE_RULES } from './xin/index.js';
import { REN_CLIMATE_RULES } from './ren/index.js';
import { GUI_CLIMATE_RULES } from './gui/index.js';
export const CLIMATE_RULES = [
    ...GENERAL_CLIMATE_RULES,
    ...JIA_CLIMATE_RULES,
    ...YI_CLIMATE_RULES,
    ...BING_CLIMATE_RULES,
    ...DING_CLIMATE_RULES,
    ...WU_CLIMATE_RULES,
    ...JI_CLIMATE_RULES,
    ...GENG_CLIMATE_RULES,
    ...XIN_CLIMATE_RULES,
    ...REN_CLIMATE_RULES,
    ...GUI_CLIMATE_RULES,
];
