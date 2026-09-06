export type RandomSource = () => number;
export interface RandomOptions {
    seed?: string | number;
    /** 使用已保存的原始随机样本逐步重放。 */
    replay?: readonly number[];
    /** 自定义随机源的推荐字段名。 */
    random?: RandomSource;
    /** @deprecated 请改用 random；为兼容既有调用暂时保留。 */
    rng?: RandomSource;
}
export type RandomMode = 'system' | 'seeded' | 'custom' | 'replay';
export interface RandomTrace {
    mode: RandomMode;
    seed?: string | number;
    samples: number[];
}
export type RandomTraceFactStatus = '可重放' | '缺少轨迹' | '不适用';
export interface RandomTraceFact {
    key: string;
    status: RandomTraceFactStatus;
    mode: RandomMode | '未记录' | '不适用';
    seed?: string | number;
    samples: number[];
    sampleCount: number;
    promptText: string;
    sources: string[];
    limitation: string;
}
export interface RandomTraceFactOptions {
    key: string;
    applicable: boolean;
    trace?: RandomTrace;
    processLabel: string;
    sources: readonly string[];
}
export declare const RANDOM_TRACE_FACT_LIMITATION = "\u968F\u673A\u8F68\u8FF9\u53EA\u7528\u4E8E\u6838\u9A8C\u6216\u91CD\u653E\u751F\u6210\u8FC7\u7A0B\uFF0C\u4E0D\u8868\u793A\u53EF\u4FE1\u5EA6\u6216\u9884\u6D4B\u6709\u6548\u6027\uFF0C\u4E5F\u4E0D\u8BC1\u660E\u4EFB\u4F55\u73B0\u5B9E\u7ED3\u8BBA\u3002";
/** 将各术数模块的随机记录统一转换为可公开序列化的结构化事实。 */
export declare function buildRandomTraceFact(options: RandomTraceFactOptions): RandomTraceFact;
/** 保留旧版 randomFacts 字符串数组，供既有调用方平滑迁移。 */
export declare function formatLegacyRandomFacts(fact: RandomTraceFact): string[];
export interface RandomContext {
    random: RandomSource;
    getTrace(): RandomTrace;
}
/** 从当前运行环境的 Web Crypto 取得一个均匀的 32 位无符号整数。 */
export declare function secureRandomUint32(): number;
/** 生成具有 53 位随机精度、范围为 [0, 1) 的系统级安全随机样本。 */
export declare function secureRandomFloat(): number;
/**
 * 使用拒绝采样生成无模偏差的系统级安全随机整数。
 * 当前实现覆盖全部 32 位无符号整数范围，足以支持抽签、洗牌与占法选择。
 */
export declare function secureRandomInt(maxExclusive: number): number;
/**
 * 生成可由既有 [0, 1) 样本协议还原的无偏索引样本。
 * 适用于需要保存浮点样本、但实际业务是从有限集合中等概率抽取一项的场景。
 */
export declare function secureRandomIndexSample(maxExclusive: number): number;
/** 判断调用方是否显式提供了任一种随机来源。 */
export declare function hasRandomOptions(options?: RandomOptions): boolean;
export declare function createSeededRandom(seed: string | number): RandomSource;
export declare function createRandomContext(options?: RandomOptions): RandomContext;
export declare function createRandomSource(options?: RandomOptions): RandomSource;
export declare function randomFloat(rng: RandomSource): number;
export declare function randomInt(maxExclusive: number, rng: RandomSource): number;
