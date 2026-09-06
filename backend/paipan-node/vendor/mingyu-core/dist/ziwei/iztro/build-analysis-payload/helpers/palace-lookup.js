import { LIUHE_MAP } from '../../../../ganzhi/index.js';
export const LIU_HE_BRANCH = LIUHE_MAP;
export function normalizeStarName(starName) {
    if (!starName)
        return '';
    return starName
        .trim()
        .replace(/\s+/gu, '')
        .replace(/[（(][^）)]*[）)]/gu, '')
        .replace(/化[禄权科忌]$/u, '');
}
