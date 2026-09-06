import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../../../ganzhi/data.js';
export function getBranchIndex(branch) {
    return EARTHLY_BRANCHES.indexOf(branch);
}
export function getStemIndex(stem) {
    return HEAVENLY_STEMS.indexOf(stem);
}
