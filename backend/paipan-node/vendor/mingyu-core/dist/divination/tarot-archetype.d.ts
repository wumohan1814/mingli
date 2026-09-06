/**
 * @file 塔罗大阿卡那原型演进轴（The Fool's Journey）
 * @传统依据 Arthur Edward Waite《The Pictorial Key to the Tarot》与荣格原型心理学：
 * 22张大阿卡那代表从 0 号愚人出发的心灵成长阶梯，分为三大演进阶段：
 * 阶段一（1魔术师 至 7战车）：个体意识建立与世俗整合；
 * 阶段二（8力量 至 14节制）：内在心理冲突与潜意识整合；
 * 阶段三（15恶魔 至 21世界）：超个人解构与精神完整。
 */
export interface TarotArchetypeStage {
    stageNumber: 1 | 2 | 3;
    stageName: string;
    theme: string;
    matchedCards: Array<{
        id: number;
        name: string;
        reversed: boolean;
    }>;
}
export interface TarotArchetypeJourneyResult {
    majorCardCount: number;
    minorCardCount: number;
    dominantStage?: string;
    stages: TarotArchetypeStage[];
    summary: string;
}
/**
 * 分析牌阵中大阿卡那在愚人之旅演进轴上的阶段分布与重心
 */
export declare function analyzeTarotArchetypeJourney(cards: Array<{
    id: number;
    name: string;
    reversed: boolean;
}>): TarotArchetypeJourneyResult;
