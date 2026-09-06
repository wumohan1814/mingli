/**
 * 干支与五行基础输入校验。
 *
 * 所有上层术数共用同一套合法值，避免各模块自行维护列表后出现口径分叉。
 */
import { EARTHLY_BRANCHES, HEAVENLY_STEMS, SIXTY_CYCLE, } from './data.js';
export const WUXING_VALUES = ['木', '火', '土', '金', '水'];
export function isHeavenlyStem(value) {
    return typeof value === 'string' && HEAVENLY_STEMS.includes(value);
}
export function isEarthlyBranch(value) {
    return typeof value === 'string' && EARTHLY_BRANCHES.includes(value);
}
export function isWuxing(value) {
    return typeof value === 'string' && WUXING_VALUES.includes(value);
}
/** 是否为真实存在的六十甲子，而非任意合法天干、地支的拼接。 */
export function isValidGanZhi(value) {
    return typeof value === 'string' && value.length === 2 && SIXTY_CYCLE.includes(value);
}
export function isGanZhiPair(gan, zhi) {
    return isHeavenlyStem(gan) && isEarthlyBranch(zhi) && isValidGanZhi(`${gan}${zhi}`);
}
export function assertHeavenlyStem(value, label = '天干') {
    if (!isHeavenlyStem(value)) {
        throw new Error(`${label}无效：${String(value)}`);
    }
}
export function assertEarthlyBranch(value, label = '地支') {
    if (!isEarthlyBranch(value)) {
        throw new Error(`${label}无效：${String(value)}`);
    }
}
export function assertWuxing(value, label = '五行') {
    if (!isWuxing(value)) {
        throw new Error(`${label}无效：${String(value)}`);
    }
}
export function assertValidGanZhi(value, label = '干支') {
    if (!isValidGanZhi(value)) {
        throw new Error(`${label}组合无效：${String(value)}`);
    }
}
export function assertGanZhiPair(gan, zhi, label = '干支') {
    assertHeavenlyStem(gan, `${label}天干`);
    assertEarthlyBranch(zhi, `${label}地支`);
    if (!isGanZhiPair(gan, zhi)) {
        throw new Error(`${label}不是有效六十甲子：${gan}${zhi}`);
    }
}
