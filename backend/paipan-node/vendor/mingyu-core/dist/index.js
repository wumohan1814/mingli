/**
 * mingyu-core
 * Mingyu core algorithms for traditional Chinese metaphysics.
 *
 * This package provides algorithmic implementations of:
 * - 八字 (Bazi / Four Pillars of Destiny)
 * - 奇门遁甲 (Qimen Dunjia / Mysterious Gate)
 * - 六爻 (Liuyao / Six Lines)
 * - 梅花易数 (Meihua Yishu / Plum Blossom Divination)
 * - 大六壬 (Da Liuren / Great Six Ren)
 * - 小六壬 (Xiao Liuren / Small Six Ren)
 * - 紫微斗数 (Ziwei Doushu / Purple Star Astrology)
 * - 西洋占星 (Western Astrology)
 * - 雷诺曼 (Lenormand)
 * - 塔罗 (Tarot)
 * - 择日 (Almanac / Day Selection)
 *
 * @packageDocumentation
 */
export * as bazi from './bazi/index.js';
export * as calendar from './calendar/index.js';
export * as divination from './divination/index.js';
export * as instant from './instant/index.js';
export * as classics from './classics/index.js';
// 底层能力（可复用、可继续拓展）
export * as ganzhi from './ganzhi/index.js';
export * as wuxing from './wuxing/index.js';
export * as direction from './direction/index.js';
export * as shensha from './shensha/index.js';
export * as foundation from './foundation/index.js';
export * as profile from './profile/index.js';
export * as capabilities from './capabilities/index.js';
export * as result from './shared/result.js';
export * as random from './shared/random.js';
export * as promptEvidence from './prompt-evidence/index.js';
export * as prompt from './prompt/index.js';
// 新增术数系统
export * as bazhai from './ba_zhai/index.js';
export * as zodiac from './zodiac/index.js';
export * as taiyi from './taiyi/index.js';
export * as qizheng from './qi_zheng/index.js';
export * as xuankong from './xuan_kong/index.js';
export * as residentialFengshui from './residential_fengshui/index.js';
export * as wuyunLiuqi from './wuyun-liuqi/index.js';
export * as huangjiJingshi from './huangji-jingshi/index.js';
export * as location from './location/index.js';
export * as birth from './birth/index.js';
export * as compatibility from './compatibility/index.js';
export * as synthesis from './synthesis/index.js';
export * as client from './client/index.js';
export * as consumption from './consumption/index.js';
export * as minglu from './minglu/index.js';
export * as terms from './terms/index.js';
// 全局配置
export { configure } from './calendar/timeManager.js';
export { SYSTEM_CAPABILITY_IDS, getCapabilities, getSystemCapability, requireSystemCapability, } from './capabilities/index.js';
export * from './profile/index.js';
export * from './birth/index.js';
export * from './compatibility/index.js';
export * from './synthesis/index.js';
export * from './client/index.js';
export * from './consumption/index.js';
export * from './instant/index.js';
export * from './minglu/index.js';
export * from './terms/index.js';
export * from './shared/result.js';
