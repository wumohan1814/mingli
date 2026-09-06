import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { AstrolabeData } from '../types/divination';
import type { HistoricalTimezoneEvidence } from '../calendar/historical-timezone';
import type { TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
export interface AstrolabePositionFact {
    key: string;
    status: '已计算';
    kind: '星体与计算点' | '四轴' | '宫头';
    name: string;
    label: string;
    longitude: number;
    sign: string;
    degree: number;
    minute: number;
    house?: number;
    retrograde: boolean;
    formatted: string;
    promptText: string;
    sources: string[];
    limitation: '位置字段是黄经、星座、宫位与四轴的计算事实，只限定占星解释所依据的盘面位置，不单独证明人格、心理状态、现实事件或命运结果';
}
export interface AstrolabeAspectFact {
    key: string;
    status: '几何完整' | '旧记录缺几何量';
    body1PositionFactKey: string | null;
    body2PositionFactKey: string | null;
    positionFactKeys: string[];
    body1: string;
    body2: string;
    type: string;
    symbol: string;
    exactAngle?: number;
    actualAngle?: number;
    orb: number;
    allowedOrb?: number;
    normalizedOrbRatio: number;
    closeness: '紧密' | '中等' | '宽松';
    phase: '入相' | '出相' | '未判定';
    isOutOfSign?: boolean;
    promptText: string;
    source: string;
    sources: string[];
    limitation: '相位字段只描述两计算点在设定容许度内的几何关系；紧密等级、入相出相和跨星座状态不代表事件概率、匹配率、吉凶比例或必然结果';
}
export interface AstrolabeCalculationStep {
    key: string;
    stage: '输入固定' | '时间处理' | '盘面计算' | '相位筛选' | '分布汇总';
    status: '完整' | '缺少记录';
    inputs: Record<string, string | number | boolean>;
    outputs: Record<string, string | number | boolean>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '单个计算步骤只记录该阶段已知输入、输出和依赖关系；步骤完整不证明底层天文模型无误，也不证明占星解释、人格诊断或现实结果';
}
export interface AstrolabePrimaryFact {
    key: string;
    role: '太阳' | '月亮' | '上升' | '天顶';
    status: '已定位';
    positionFactKey: string;
    label: string;
    promptText: string;
    sources: string[];
    limitation: '太阳、月亮、上升和天顶只作为本命盘核心位置主证；核心位置完整不代表人格诊断、事件概率、吉凶等级或命运结果';
}
export interface AstrolabePrimaryCoverageFact {
    key: 'astrolabe:primary-coverage';
    status: '完整' | '部分';
    expectedRoles: Array<'太阳' | '月亮' | '上升' | '天顶'>;
    actualRoles: Array<'太阳' | '月亮' | '上升' | '天顶'>;
    missingRoles: Array<'太阳' | '月亮' | '上升' | '天顶'>;
    primaryFactKeys: string[];
    positionFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '核心位置覆盖只说明太阳、月亮、上升和天顶是否有对应位置事实；缺失时不得补造星座、宫位、黄经或解释';
}
export interface AstrolabeCalculationFact {
    key: 'calculation:astrolabe:natal';
    status: '完整' | '部分';
    input: {
        dateTime: string;
        standardDateTime?: string;
        effectiveDateTime: string;
        location: string;
        timezone: number;
        timeZoneId?: string;
        isTrueSolarTime: boolean;
        trueSolarDateTime?: string;
    };
    models: {
        ephemeris: 'caelus';
        houseSystem: 'Placidus';
        aspectSelection: '主要相位按相位角与容许度筛选';
    };
    steps: AstrolabeCalculationStep[];
    missing: string[];
    promptText: string;
    sources: string[];
    limitation: '计算链只证明出生输入、时间处理、天文位置、宫位与相位筛选如何形成当前盘面，不证明占星解释有效性、人格诊断、现实事件或命运结果';
}
export interface AstrolabeDistributionFact {
    key: string;
    kind: '元素' | '模式' | '逆行' | '盘面格局';
    label: string;
    members: string[];
    memberPositionFactKeys: string[];
    count: number;
    status: '有成员' | '无成员';
    promptText: string;
    sources: string[];
    limitation: '分布字段只统计当前盘面的元素、模式、逆行与依赖库格局成员，不代表能量分数、人格强度、事件概率、吉凶等级或现实结果';
}
export interface AstrolabeIlluminationFact {
    key: 'astrolabe:illumination';
    status: '可用' | '缺失';
    referenceLocalDateTime?: string;
    latitude?: number;
    longitude?: number;
    solarAltitudeDegrees?: number;
    solarAzimuthDegrees?: number;
    solarDeclinationDegrees?: number;
    equationOfTimeMinutes?: number;
    apparentSolarNoonLocalDateTime?: string;
    method?: string;
    source?: string;
    assumptionTexts: string[];
    limitationTexts: string[];
    crossingFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '太阳高度、方位、赤纬、均时差与曙暮光只作为出生地点和时刻的天文背景；不直接证明人格、心理状态、现实事件、健康或吉凶结果';
}
export interface AstrolabeCounterEvidenceFact {
    key: string;
    type: '主要相位' | '逆行' | '盘面格局';
    status: '有可用证据' | '未见';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录筛选范围内是否有主要相位、逆行点或依赖库盘面格局；未见不代表不存在其他角度关系或现实不利，有记录也不证明事件结果';
}
export interface AstrolabeCounterSummaryFact {
    key: 'astrolabe:counter-summary';
    status: '有未见项' | '全部有可列资料';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明当前筛选范围和依赖库输出的资料覆盖情况；不得据数量生成概率、匹配率、吉凶比例或强度分';
}
export interface AstrolabeLimitationFact {
    key: string;
    type: '时区诊断' | '几何解释边界' | '相位强度边界' | '相位筛选边界' | '分布边界' | '宫位输入边界' | '光照边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束星盘位置、相位、分布、输入和光照资料可以支持的解释范围，不得被反向当作人格、事件或命运证据';
}
export interface AstrolabeSummaryFact {
    key: 'astrolabe:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    primaryFactCount: number;
    positionFactCount: number;
    aspectFactCount: number;
    distributionFactCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '星盘证据汇总只统计输入、时间、位置、相位、核心点、分布、光照、反证与限制覆盖；不得按数量生成性格强度、吉凶等级、匹配率、事件概率、时间保证或命运结论';
}
export interface AstrolabeEvidenceAnalysis {
    key: 'astrolabe:evidence';
    status: '已计算';
    calculationFact: AstrolabeCalculationFact;
    calculationSteps: AstrolabeCalculationStep[];
    calculationChain: string[];
    timezoneFact?: HistoricalTimezoneEvidence;
    trueSolarTimeFact?: TrueSolarTimeEvidenceFields;
    primaryCoverageFact: AstrolabePrimaryCoverageFact;
    primaryPointFacts: AstrolabePrimaryFact[];
    primaryFacts: string[];
    positionFacts: AstrolabePositionFact[];
    aspectFacts: AstrolabeAspectFact[];
    planetFacts: string[];
    angleFacts: string[];
    houseFacts: string[];
    distributionEvidenceFacts: AstrolabeDistributionFact[];
    distributionFacts: string[];
    illuminationFact: AstrolabeIlluminationFact;
    illuminationFacts: string[];
    supportingFacts: string[];
    counterEvidence: string[];
    counterEvidenceFacts: AstrolabeCounterEvidenceFact[];
    counterSummaryFact: AstrolabeCounterSummaryFact;
    limitations: string[];
    limitationFacts: AstrolabeLimitationFact[];
    summaryFact: AstrolabeSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function analyzeAstrolabeEvidence(data: Omit<AstrolabeData, 'evidenceAnalysis'>): AstrolabeEvidenceAnalysis;
