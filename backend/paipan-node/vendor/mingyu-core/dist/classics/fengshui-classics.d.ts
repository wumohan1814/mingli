import type { BazhaiStarClassic } from './types';
/**
 * 《八宅明镜》《紫白诀》《飞星赋》八宅与玄空风水经典释义
 */
export declare const BAZHAI_STAR_CLASSICS: Record<string, BazhaiStarClassic>;
export declare function getBazhaiStarClassic(star: string): BazhaiStarClassic | undefined;
import type { XuankongStarClassic } from './types';
/**
 * 《紫白诀》《玄空秘旨》《飞星赋》玄空九星全解
 */
export declare const XUANKONG_STAR_CLASSICS: Record<number, XuankongStarClassic>;
export declare function getXuankongStarClassic(starNumber: number | string): XuankongStarClassic | undefined;
