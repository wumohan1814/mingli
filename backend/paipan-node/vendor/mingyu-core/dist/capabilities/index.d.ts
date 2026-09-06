export { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from '../shared/version';
export declare const SYSTEM_CAPABILITY_IDS: readonly ["calendar.trueSolarBirth", "calendar.astronomicalTime", "calendar.moonPhase", "calendar.solarIllumination", "calendar.solarTerm", "bazi", "ziwei", "bazi-ziwei-synthesis", "astrolabe", "qimen", "liuyao", "meihua", "xiaoliuren", "jinkoujue", "liuren", "tarot", "lenormand", "ssgw", "almanac", "bazhai", "zodiac", "taiyi", "wuyun-liuqi", "huangji-jingshi", "qizheng", "xuankong", "residential"];
export type SystemCapabilityId = (typeof SYSTEM_CAPABILITY_IDS)[number];
export type CapabilityInputType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'array' | 'object';
export interface CapabilityOption {
    value: string;
    label: string;
}
export interface CapabilityInput {
    id: string;
    label: string;
    type: CapabilityInputType;
    required: boolean;
    description?: string;
    options?: CapabilityOption[];
    requiredWhen?: Record<string, string | boolean>;
}
export interface SystemCapability {
    id: SystemCapabilityId;
    name: string;
    category: 'chart' | 'divination' | 'calendar' | 'environment';
    /** 省略或为 true 表示可计算；false 表示只保留兼容入口并明确失败关闭。 */
    available?: boolean;
    methods?: CapabilityOption[];
    defaultMethod?: string;
    inputs: CapabilityInput[];
    outputs: string[];
    supports: {
        seed: boolean;
        customRandomSource: boolean;
        replay?: boolean;
        trueSolarTime: boolean;
        birthTimeRequired: boolean;
        birthTimeModes?: Array<'traditional-shichen' | 'precise-clock-time'>;
        batch: boolean;
    };
    optionalDependencies?: string[];
    notes?: string[];
}
export interface MingyuCapabilities {
    package: 'mingyu-core';
    version: string;
    schemaVersion: string;
    systems: SystemCapability[];
}
/** 返回可安全序列化的能力清单，供网站、App、API 或 MCP 自动生成入口。 */
export declare function getCapabilities(): MingyuCapabilities;
export declare function getSystemCapability(id: string): SystemCapability | undefined;
/** 查询必须存在的能力；适合客户端、API 和表单把未知 ID 转成明确错误。 */
export declare function requireSystemCapability(id: SystemCapabilityId | string): SystemCapability;
