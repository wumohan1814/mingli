/**
 * @file 方位指引
 * @description 依据三吉门及其明确限制条件生成方位候选，不把门、星、神和格局折算为总分。
 *
 * 古籍依据：
 *   - 《奇门宝鉴御定》：「吉门若遇开休生，诸事逢之总情」
 *   - 《奇门遁甲秘笈大全》：「开休生门为上吉」
 *   - 《遁甲符应经》：「若吉门被迫，则吉事不成」
 *   - 《奇门遁甲秘笈大全》：「纵有奇门皆不利」（五不遇时）
 *   - 《奇门遁甲秘笈大全》：「时遇空亡，吉凶不成」
 *
 * 古籍给出的是成立条件、用途和限制，并没有可通用于各门星神的加减分表。因此：
 *   - 开、休、生三吉门是通用吉方的主证；三奇、吉神与吉格只补充依据，不单独造吉方。
 *   - 空亡、难神、门迫及其他宫位凶格是明确限制，不能被吉项“加分抵消”。
 *   - 避方只按明确不利事实生成，不再从全盘中机械选一个“最低分”。
 */
/** 单个宫位方位判断输入 */
export interface PalaceScoreInput {
    gong: number;
    name: string;
    direction: string;
    element: string;
    tianPan: {
        stem: string;
        star: string;
        companionStem?: string;
        companionStar?: string;
    };
    diPan: {
        stem: string;
    };
    renPan: {
        door: string;
    };
    shenPan: {
        god: string;
    };
}
/** 方位建议条目 */
export interface DirectionAdvice {
    gong: number;
    name: string;
    direction: string;
    use: string;
    reasons: string[];
}
interface DirectionPatternInput {
    name: string;
    tone: 'good' | 'bad' | 'neutral';
    palace?: number;
    palaces?: number[];
    /** @deprecated 旧版格局评分仅作输入兼容，方位判断不会读取。 */
    score?: number;
}
interface DirectionConditionsInput {
    /** 五不遇时为全局举事限制，纵有三奇吉门也不输出通用吉方。 */
    isWuBuYuShi?: boolean;
}
/**
 * 生成方位建议。
 *
 * 吉方必须先见开、休、生三吉门，并排除空亡、难神和宫位凶格；三奇、吉神与吉格
 * 只作为加强依据。五不遇时属于全局限制，命中时不输出通用吉方。避方则保留所有
 * 具备难门、难神、空亡或宫位凶格的方位，不再按总分强选唯一方位。
 */
export declare function buildDirectionAdvice(jiuGongGe: PalaceScoreInput[], voidBranches?: string[], classicPatterns?: DirectionPatternInput[], conditions?: DirectionConditionsInput): {
    goodDirections: DirectionAdvice[];
    avoidDirections: DirectionAdvice[];
};
export {};
