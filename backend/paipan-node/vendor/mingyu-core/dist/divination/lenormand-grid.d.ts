/**
 * @file 雷诺曼核心九宫十字与距离几何算法
 * @传统依据 1799年《Das Spiel der Hoffnung》及欧洲 Petit Lenormand 通行牌阵网格几何：
 * 核心十字方位：上（目标/思维显意识）、下（根基/潜意识）、左（过去因由）、右（未来走向）；
 * 几何距离：曼哈顿距离越近，对核心牌的影响越强烈直接。
 */
export interface LenormandCardRef {
    id: number;
    name: string;
}
export interface LenormandGridPosition {
    card: LenormandCardRef;
    row: number;
    col: number;
    label: string;
    manhattanDistanceToCenter: number;
}
export interface LenormandCrossAnalysis {
    centerCard: LenormandCardRef;
    topCard?: LenormandCardRef;
    bottomCard?: LenormandCardRef;
    leftCard?: LenormandCardRef;
    rightCard?: LenormandCardRef;
    diagonalCards: {
        topLeft?: LenormandCardRef;
        topRight?: LenormandCardRef;
        bottomLeft?: LenormandCardRef;
        bottomRight?: LenormandCardRef;
    };
    cardDistances: Array<{
        card: LenormandCardRef;
        distance: number;
        relationship: '紧邻' | '近距' | '远距';
    }>;
    summary: string;
}
/**
 * 分析雷诺曼九宫（3x3，9张牌）或带核心牌的网格十字距离
 * 输入：9张牌数组（按九宫顺序：0左上, 1上, 2右上, 3左, 4核心, 5右, 6左下, 7下, 8右下）
 */
export declare function analyzeLenormandNineGrid(cards: LenormandCardRef[]): LenormandCrossAnalysis;
