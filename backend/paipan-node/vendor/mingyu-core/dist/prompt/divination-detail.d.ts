import type { DivinationMethodId } from '../divination/config';
import type { DivinationData } from '../types/divination';
type SupportedMethod = Exclude<DivinationMethodId, 'random'>;
/** 输出比摘要更完整的、可直接拼入任务书的占法资料。 */
export declare function formatDetailedDivinationInfo(method: SupportedMethod, data: DivinationData): string;
export {};
