import { ChildLimit, DefaultChildLimitProvider } from 'tyme4ts';
export const CHILD_LIMIT_METHOD = '按实际节气时刻计算，三日折一年';
const childLimitProvider = new DefaultChildLimitProvider();
/**
 * 使用项目固定的三日一岁起运口径，避免 tyme4ts 的可变全局配置改变排盘结果。
 */
export function createChildLimit(solarTime, gender) {
    const previousProvider = ChildLimit.provider;
    ChildLimit.provider = childLimitProvider;
    try {
        return ChildLimit.fromSolarTime(solarTime, gender);
    }
    finally {
        ChildLimit.provider = previousProvider;
    }
}
