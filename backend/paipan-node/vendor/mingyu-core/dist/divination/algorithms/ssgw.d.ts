import type { SsgwData } from '../../types/divination';
import type { RandomOptions } from '../../shared/random';
/**
 * 随机抽取一支签
 *
 * 从三山国王 92 支签文中随机抽取一条作为占卜结果，
 * 自动附带求签时间的干支和 Unix 时间戳。
 *
 * @param customDate 自定义求签时间（可选），不传则使用当前时间。
 *   传入后签文结果的 `ganzhi` 和 `timestamp` 会基于该时间生成。
 * @returns 完整的签文结果，包含签号、签题、签诗、典故、解签资料和抽取记录。
 *
 * @example
 * ```ts
 * // 当前时间求签
 * const sign = drawRandomSign();
 *
 * // 指定时间求签
 * const sign = drawRandomSign(new Date('2025-06-15T10:00:00'));
 * ```
 */
export declare function drawRandomSign(options?: RandomOptions): SsgwData;
export declare function drawRandomSign(customDate?: Date, options?: RandomOptions): SsgwData;
/** 按用户已取得的签号查出签文，不模拟抽签或掷筊。 */
export declare function resolveSignByNumber(number: number, customDate?: Date): SsgwData;
