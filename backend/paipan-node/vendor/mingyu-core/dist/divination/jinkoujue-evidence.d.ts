import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import { type RandomTraceFact } from '../shared/random';
import type { JinkoujueData, JinkoujueFourPosition, JinkoujueMovement } from '../types/divination';
export interface JinkoujuePositionFact {
    key: string;
    status: '已计算';
    position: JinkoujueFourPosition['name'];
    role: string;
    branch: string;
    stem?: string;
    stemElement?: string;
    god?: string;
    element: string;
    elementBasis: JinkoujueFourPosition['elementBasis'];
    yinYang: JinkoujueFourPosition['yinYang'];
    seasonState: string;
    isVoid: boolean;
    support: string[];
    constraints: string[];
    promptText: string;
    sources: string[];
    limitation: '四位事实只记录地分、将神、贵神、人元的落点、五行、月令与空亡；不得直接写成现实吉凶、人物身份或事件保证';
}
export interface JinkoujueMovementFact extends JinkoujueMovement {
    key: string;
    status: '已触发';
    promptText: string;
    sources: string[];
    limitation: '动爻只记录四位之间满足的五行触发条件；具体人事须结合所问事项与主客用位，不得按动名直接断定现实结果';
}
export interface JinkoujueRelationFact {
    key: string;
    status: '支持' | '限制' | '中性';
    from: string;
    to: string;
    relation: string;
    promptText: string;
    sources: string[];
    limitation: '四位生克关系只说明盘内作用方向；不得把生克直接写成现实必然顺利、受阻、成功或失败';
}
export interface JinkoujueFocusFact {
    key: string;
    target: string;
    role: string;
    level: '主证' | '辅证';
    evidence: string[];
    limitations: string[];
    promptText: string;
    sources: string[];
    limitation: '焦点事实只记录阴阳次第选出的发用位与其依据；不得把固定贵神或将神另立为用';
}
export interface JinkoujueCounterEvidenceFact {
    key: string;
    ownerKey: string;
    type: '旬空' | '月令限制' | '受克' | '主证受限';
    status: '已触发';
    detail: string;
    promptText: string;
    sources: string[];
    limitation: '反证只表示当前四位存在空亡、休囚死或受克条件；不得把单项反证直接写成现实失败或灾祸';
}
export interface JinkoujueEvidenceSummaryFact {
    key: 'jinkoujue:evidence-summary';
    status: '证据链完整' | '主线受限';
    positionCount: number;
    relationCount: number;
    focusCount: number;
    counterCount: number;
    promptText: string;
    sources: string[];
    limitation: '证据汇总只统计四位、关系、焦点与反证覆盖，不得按数量生成吉凶总分或成功率';
}
export interface JinkoujueEvidenceAnalysis {
    key: 'jinkoujue:evidence';
    status: '已计算';
    mainLine: string;
    calculationFact: {
        key: 'jinkoujue:calculation';
        status: '完整';
        method: string;
        methodLabel: string;
        inputBase: number;
        inputBaseSource: string;
        diFenNote: string;
        monthLeaderRule: string;
        yuanDunRule: string;
        dayNightRule: string;
        noblemanRule: string;
        noblemanDirection: string;
        guiShenRule: string;
        yinYangUseRule: string;
        promptText: string;
        sources: string[];
        limitation: '计算事实只证明地分、月将、贵神、遁干与发用如何形成当前课体；不证明现实结论';
    };
    positions: JinkoujuePositionFact[];
    relations: JinkoujueRelationFact[];
    movementFacts: JinkoujueMovementFact[];
    focusFacts: JinkoujueFocusFact[];
    counterEvidenceFacts: JinkoujueCounterEvidenceFact[];
    summaryFact: JinkoujueEvidenceSummaryFact;
    randomTraceFact: RandomTraceFact;
    randomFacts: string[];
    promptText: string;
    evidence: PromptEvidenceBundle;
}
export declare function analyzeJinkoujueEvidence(data: JinkoujueData): JinkoujueEvidenceAnalysis;
