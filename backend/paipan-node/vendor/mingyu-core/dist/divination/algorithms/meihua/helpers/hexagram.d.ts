export declare function resolveTiYongByMovingYao<T extends {
    name: string;
    element: string;
    nature: string;
}>(upper: T, lower: T, movingYaoIndex: number): {
    tiGua: T;
    yongGua: T;
};
/**
 * 根据上下经卦的索引号，查找对应的大成卦（六十四卦之一）
 * @param upper 上卦索引 (1-8)
 * @param lower 下卦索引 (1-8)
 * @returns 对应的大成卦对象
 */
export declare function findHexagramByTrigrams(upper: number, lower: number): {
    number: number;
    name: string;
    symbol: string;
    description: string;
    yaoCi: string[] | undefined;
    yongCi: string | undefined;
};
