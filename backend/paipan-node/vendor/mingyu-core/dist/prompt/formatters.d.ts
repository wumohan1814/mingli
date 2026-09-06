import type { DivinationMethodId } from '../divination/config';
import type { DivinationData, SupplementaryInfo } from '../types/divination';
type SupportedMethod = Exclude<DivinationMethodId, 'random'>;
/** 格式化占课时间；没有时间戳时使用当前时间，显式无效时间戳直接报错。 */
export declare function buildTimeInfoText(data?: DivinationData): string;
/** 只格式化当地民用公历时间；显式无效时间戳直接报错。 */
export declare function buildSolarTimeInfoText(data?: DivinationData): string;
export declare function formatGanzhi(ganzhi?: {
    year: string;
    month: string;
    day: string;
    hour: string;
}): string;
/**
 * 将跨页面复用的补充资料转换为提示词正文。
 * 这里只处理客观输入，不包含表单状态、按钮文案或存储字段。
 */
export declare function formatSupplementaryInfoSection(method: SupportedMethod, supplementaryInfo?: SupplementaryInfo): string;
/** 创建不带方括号的通用文本分段，便于外部自行组合任务书。 */
export declare function buildSection(title: string, content: string): string;
export {};
