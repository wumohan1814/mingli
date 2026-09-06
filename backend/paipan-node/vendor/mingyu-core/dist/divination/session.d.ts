import type { DivinationMethodId } from './config';
import { type LiuyaoGenerationOptions } from './algorithms/liuyao';
import { type QimenMethod, type QimenScope } from './algorithms/qimen/index';
import { type TarotManualCardInput } from './tarot';
import type { RandomOptions } from '../shared/random';
import { getDivinationSummaryBlocks, type DivinationPromptOptions } from '../prompt/divination';
import type { PromptDocument } from '../prompt/types';
import { type AuditEvidenceEntry, type UnifiedResultView } from '../consumption/index';
import type { AlmanacParticipantInput, AlmanacTopic, AstrolabeBirthInput, DivinationData, JinkoujueDivinationMethod, LenormandSpreadType, MeihuaSettings, SupplementaryInfo, TarotSpreadType, TaiyiScope, XiaoliurenDivinationMethod } from '../types/divination';
export type QimenJuMethod = 'chaibu' | 'zhirun';
export type DivinationSessionMethod = Exclude<DivinationMethodId, 'random'>;
export interface DivinationRequest {
    /** 指定占法；random 会从可独立起课的占法中稳定选择一种。 */
    method: DivinationMethodId;
    question?: string;
    questionSource?: 'custom' | 'inspiration';
    /** 起课时间；未提供时由各算法使用当前时间。 */
    divinationTime?: Date | string | number;
    /** 提示词中的当前时间；未提供时使用运行环境当前时间。 */
    currentTime?: Date | string | number;
    /** 随机占法的统一随机设置，支持 seed、replay 和自定义随机源。 */
    random?: RandomOptions;
    supplementaryInfo?: SupplementaryInfo;
    liuyao?: LiuyaoGenerationOptions;
    meihua?: MeihuaSettings;
    xiaoliuren?: {
        method?: XiaoliurenDivinationMethod;
    };
    jinkoujue?: {
        method?: JinkoujueDivinationMethod;
        branch?: string;
        number?: number;
    };
    qimen?: {
        method?: QimenMethod;
        scope?: QimenScope;
        juMethod?: QimenJuMethod;
    };
    tarot?: {
        spread?: TarotSpreadType;
        manualCards?: readonly TarotManualCardInput[];
        interactiveSamples?: readonly number[];
    };
    ssgw?: {
        method?: 'random' | 'manual';
        number?: number;
    };
    almanac?: {
        topic: AlmanacTopic;
        startDate: string;
        endDate: string;
        participants?: AlmanacParticipantInput[];
    };
    lenormand?: {
        spread?: LenormandSpreadType;
        manualCardIds?: readonly number[];
        interactiveSamples?: readonly number[];
    };
    astrolabe?: AstrolabeBirthInput;
    taiyi?: {
        year?: number;
        scope?: TaiyiScope;
    };
    /** 皇极经世兼容值年输入；省略 year 时按 divinationTime（未填则当前时间）排年月日时卦。 */
    huangji?: {
        year?: number;
    };
    prompt?: Omit<DivinationPromptOptions, 'method' | 'data' | 'question' | 'currentTime'>;
}
export interface DivinationSession {
    requestedMethod: DivinationMethodId;
    method: DivinationSessionMethod;
    question: string;
    data: DivinationData;
    summary: ReturnType<typeof getDivinationSummaryBlocks>;
    formattedResult: string;
    serializedResult: string;
    prompt: string;
    promptDocument: PromptDocument;
    /** 直接展示给用户的简短结果。 */
    displaySummary: ReturnType<typeof getDivinationSummaryBlocks>;
    /** 只含任务、问题和有效盘面资料，可直接交给在线 AI。 */
    aiPrompt: string;
    /** 来源、规则、计算过程及限制，仅在审计场景按需读取。 */
    auditEvidence: AuditEvidenceEntry[];
    /** 跨术式稳定消费视图；raw 保留当前专业结果以兼容旧调用方。 */
    view: UnifiedResultView<DivinationRequest, null, unknown, null, ReturnType<typeof getDivinationSummaryBlocks>, AuditEvidenceEntry[], DivinationData>;
}
export declare function summarizeDivinationResult(method: DivinationSessionMethod, data: DivinationData): import(".").DivinationSummaryBlocks;
export declare function formatDivinationResult(method: DivinationSessionMethod, data: DivinationData): string;
export declare function serializeDivinationResult(data: DivinationData): string;
/** 只做请求层校验，不执行排盘；适合表单和 API 在提交前调用。 */
export declare function validateDivinationRequest(request: DivinationRequest): void;
/** 以框架无关的纯数据请求完成一次占法，返回可展示、可缓存、可传输的统一结果。 */
export declare function generateDivinationSession(request: DivinationRequest): DivinationSession;
/** 兼容只需要一个函数名的调用方。 */
export declare const generateDivination: typeof generateDivinationSession;
