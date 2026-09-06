export interface XuanKongEvidenceSourceResult {
    period: {
        year: number;
        yuan: string;
        yun: number;
        yunStar: number;
        label: string;
    };
    sitMountain: string;
    facingMountain: string;
    plates: {
        yun: number[];
        shan: number[];
        xiang: number[];
        year?: number[];
        month?: number[];
    };
    palaces?: Array<{
        gong: number;
        name: string;
        yunStar: number;
        shanStar: number;
        xiangStar: number;
        yearStar?: number;
        monthStar?: number;
        shanXiangRelation: string;
        yunStarState: string;
    }>;
    flowStars?: {
        yearPlate: {
            year: number;
            starName: string;
            centerStar: number;
            calendarNote: string;
        };
        monthPlate?: {
            starName: string;
            centerStar: number;
            calendarNote: string;
        };
    };
    formation: string;
    combinations: Array<{
        name: string;
        kind: string;
        palaces?: number[];
        note: string;
    }>;
    engine: {
        name: string;
        version: string;
        mode: string;
    };
    daoShanXiang: {
        summary: string;
    };
    castleGate?: {
        summary: string;
    };
    measurement?: {
        stability: string;
    };
}
export interface XuanKongEvidenceAnalysis {
    key: string;
    calculationSteps: Array<{
        key: string;
        stage: string;
        promptText: string;
        sources: string[];
        limitation: string;
    }>;
    facts: Array<{
        key: string;
        type: string;
        promptText: string;
        sources: string[];
        limitation: string;
    }>;
    counterFacts: Array<{
        key: string;
        type: string;
        promptText: string;
        sources: string[];
        limitation: string;
    }>;
    limitationFacts: Array<{
        key: string;
        type: string;
        promptText: string;
        sources: string[];
        limitation: string;
    }>;
    summaryFact: {
        key: string;
        status: string;
        promptText: string;
        sources: string[];
        limitation: string;
    };
    sources: Array<{
        title: string;
        evidence: string;
        role: '传统规则来源' | '公共算法来源';
    }>;
    promptText: string;
}
export declare function analyzeXuanKongEvidence(result: XuanKongEvidenceSourceResult): XuanKongEvidenceAnalysis;
