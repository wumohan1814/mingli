import { ChildLimit } from 'tyme4ts';
type SolarTimeInstance = Parameters<typeof ChildLimit.fromSolarTime>[0];
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
type ChildLimitInstance = ReturnType<typeof ChildLimit.fromSolarTime>;
export declare const CHILD_LIMIT_METHOD = "\u6309\u5B9E\u9645\u8282\u6C14\u65F6\u523B\u8BA1\u7B97\uFF0C\u4E09\u65E5\u6298\u4E00\u5E74";
/**
 * 使用项目固定的三日一岁起运口径，避免 tyme4ts 的可变全局配置改变排盘结果。
 */
export declare function createChildLimit(solarTime: SolarTimeInstance, gender: LuckGender): ChildLimitInstance;
export {};
