import { SolarTime } from 'tyme4ts';
import { createRandomSource, randomInt } from '../shared/random.js';
/**
 * 时间管理工具类
 */
export class TimeManager {
    /**
     * 时区偏移覆盖（单位：分钟，正数表示 UTC+）
     * - null：不覆盖，使用运行环境本地时区
     * - 例如：北京时间为 480
     * - 默认固定北京时间，避免服务端时区差异导致占卜盘与提示词不一致
     */
    static timezoneOffsetMinutesOverride = 480;
    /**
     * 设置时区偏移覆盖（用于服务端/边缘环境固定时区）
     */
    static setTimezoneOffsetMinutesOverride(offsetMinutes) {
        this.assertTimezoneOffsetMinutes(offsetMinutes);
        this.timezoneOffsetMinutesOverride = offsetMinutes;
    }
    /**
     * 获取目标时区偏移（分钟）
     */
    static getTimezoneOffsetMinutes(date) {
        const override = this.timezoneOffsetMinutesOverride;
        if (typeof override === 'number' && Number.isFinite(override)) {
            return override;
        }
        // Date#getTimezoneOffset 返回"本地到UTC需要加多少分钟"，因此本地偏移 = -getTimezoneOffset
        return -date.getTimezoneOffset();
    }
    static assertFiniteNumber(value, label) {
        if (!Number.isFinite(value)) {
            throw new Error(`${label}必须是有效数字。`);
        }
    }
    static assertPositiveInteger(value, label) {
        if (!Number.isSafeInteger(value) || value <= 0) {
            throw new Error(`${label}必须是安全范围内的正整数。`);
        }
    }
    static assertTimezoneOffsetMinutes(value) {
        if (value === null) {
            return;
        }
        if (!Number.isInteger(value) || value < -720 || value > 840) {
            throw new Error('时区偏移分钟数需为 -720 到 840 之间的整数。');
        }
    }
    /**
     * 在指定时区偏移下提取年月日时分（不改变原始时间戳）
     */
    static getDatePartsInOffset(date, offsetMinutes) {
        const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
        return {
            year: shifted.getUTCFullYear(),
            month: shifted.getUTCMonth() + 1,
            day: shifted.getUTCDate(),
            hour: shifted.getUTCHours(),
            minute: shifted.getUTCMinutes(),
        };
    }
    /**
     * 获取占卜用的统一时间数据
     * @param customTime 自定义时间（可选）
     * @returns 统一的时间数据
     */
    static getDivinationTime(customTime) {
        const targetTime = customTime === undefined ? new Date() : customTime;
        if (!(targetTime instanceof Date) || Number.isNaN(targetTime.getTime())) {
            throw new Error('自定义时间不是有效日期。');
        }
        const timeInfo = this.getTimeInfo(targetTime);
        const ganzhi = this.getGanZhi(targetTime);
        const timestamp = targetTime.getTime();
        return { timeInfo, ganzhi, timestamp };
    }
    /**
     * 按统一时区策略提取墙上时间的年月日时分（默认东八区）。
     * 供紫微等模块取"当前时刻"，避免直接读运行环境本地时区导致跨模块日期/时辰不一致。
     */
    static getWallClockParts(date = new Date()) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            throw new Error('当前时间不是有效日期。');
        }
        return this.getDatePartsInOffset(date, this.getTimezoneOffsetMinutes(date));
    }
    /**
     * 基于时间戳生成确定性随机数
     * @param timestamp 时间戳
     * @param range 范围
     * @returns 确定性随机数
     */
    static getSeededRandom(timestamp, range = 1) {
        this.assertFiniteNumber(timestamp, '随机种子时间戳');
        this.assertPositiveInteger(range, '随机范围');
        const rng = createRandomSource({ seed: `时间随机:${timestamp}` });
        return randomInt(range, rng);
    }
    /**
     * 基于时间生成爻象
     * @param timestamp 时间戳
     * @param count 爻象数量
     * @returns 爻象数组
     */
    static generateYaosByTime(timestamp, count = 6) {
        this.assertFiniteNumber(timestamp, '起卦时间戳');
        this.assertPositiveInteger(count, '爻象数量');
        const rng = createRandomSource({ seed: `时间起卦:${timestamp}` });
        const yaos = [];
        for (let i = 0; i < count; i++) {
            // 同一时间戳建立一个稳定随机流，再依次抽取三枚铜钱，避免逐币线性种子造成比特相关。
            yaos.push(this.generateYaoByCoinMethod(() => randomInt(2, rng)));
        }
        return yaos;
    }
    /**
     * 随机生成爻象
     * @param count 爻象数量
     * @returns 爻象数组
     */
    static generateYaosByRandom(count = 6, options) {
        this.assertPositiveInteger(count, '爻象数量');
        const rng = createRandomSource(options);
        const yaos = [];
        for (let i = 0; i < count; i++) {
            yaos.push(this.generateYaoByCoinMethod(() => randomInt(2, rng)));
        }
        return yaos;
    }
    /**
     * 使用三钱法起一爻：正面记 3，反面记 2，三枚铜钱合计得 6/7/8/9。
     */
    static generateYaoByCoinMethod(getCoinBit) {
        let total = 0;
        for (let coinIndex = 0; coinIndex < 3; coinIndex++) {
            total += getCoinBit(coinIndex) === 0 ? 2 : 3;
        }
        return total;
    }
    /**
     * 获取指定时间的干支信息
     */
    static getGanZhi(date) {
        const offsetMinutes = this.getTimezoneOffsetMinutes(date);
        const parts = this.getDatePartsInOffset(date, offsetMinutes);
        const solarTime = SolarTime.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0);
        const lunarHour = solarTime.getLunarHour();
        const eightChar = lunarHour.getEightChar();
        return {
            year: eightChar.getYear().getName(),
            month: eightChar.getMonth().getName(),
            day: eightChar.getDay().getName(),
            hour: eightChar.getHour().getName(),
        };
    }
    /**
     * 获取指定时间的完整信息
     */
    static getTimeInfo(date) {
        const offsetMinutes = this.getTimezoneOffsetMinutes(date);
        const parts = this.getDatePartsInOffset(date, offsetMinutes);
        const solarTime = SolarTime.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0);
        const solarDay = solarTime.getSolarDay();
        const lunarHour = solarTime.getLunarHour();
        const lunarDay = lunarHour.getLunarDay();
        const eightChar = lunarHour.getEightChar();
        const lunarDayText = lunarDay.toString().replace(/^农历/, '');
        const jieQi = solarTime.getTerm();
        return {
            solar: {
                year: solarDay.getYear(),
                month: solarDay.getMonth(),
                day: solarDay.getDay(),
                hour: parts.hour,
                minute: parts.minute,
            },
            lunar: {
                year: eightChar.getYear().getName(),
                month: eightChar.getMonth().getName(),
                day: eightChar.getDay().getName(),
                hour: eightChar.getHour().getName(),
                yearInChinese: lunarDayText.split('年')[0] + '年',
                monthInChinese: lunarDayText.split('年')[1].split('月')[0] + '月',
                dayInChinese: lunarDayText.split('月')[1],
                hourInChinese: lunarHour.getName(),
                // tyme4ts 闰月返回负数，规范为正数月序供起卦取模使用（闰月标志另行处理）
                monthNumber: Math.abs(lunarDay.getMonth()),
                dayNumber: lunarDay.getDay(),
            },
            ganzhi: {
                year: eightChar.getYear().getName(),
                month: eightChar.getMonth().getName(),
                day: eightChar.getDay().getName(),
                hour: eightChar.getHour().getName(),
            },
            eightChar: {
                year: eightChar.getYear().getName(),
                month: eightChar.getMonth().getName(),
                day: eightChar.getDay().getName(),
                hour: eightChar.getHour().getName(),
            },
            jieQi: jieQi.getName(),
        };
    }
}
// 导出便捷函数
export const getDivinationTime = TimeManager.getDivinationTime.bind(TimeManager);
export const generateYaosByTime = TimeManager.generateYaosByTime.bind(TimeManager);
/**
 * 统一全局配置入口
 *
 * 用于设置时区等全局参数，取代手动调用 TimeManager.setTimezoneOffsetMinutesOverride()。
 * 不传字段则保持当前值不变。
 *
 * @param config 配置选项
 *
 * @example
 * ```ts
 * import { configure } from 'mingyu-core/calendar';
 *
 * // 设置东八区（北京时间）
 * configure({ timezoneOffset: 480 });
 * ```
 */
export function configure(config) {
    if (config.timezoneOffset !== undefined) {
        TimeManager.setTimezoneOffsetMinutesOverride(config.timezoneOffset);
    }
}
