import type { LiurenData, LiurenTemplateType } from '../../types/divination';
export declare function getLiurenPatternHint(pattern?: LiurenData['transmissionPattern']): "传态伏吟：旧因反复。" | "传态反吟：冲动与反复并存。" | "传态回环：问题会回到原点。" | "传态递传：按阶段推进。" | "传态未标注。";
export declare function buildLiurenTemplateText(template: LiurenTemplateType, _data: LiurenData): string;
