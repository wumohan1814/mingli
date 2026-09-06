import type { SsgwData } from '../types/divination';
/** 合并签谱中的重复典故字段，避免同一内容在结果和详情中展示两次。 */
export declare function resolveSsgwStoryContent(data: SsgwData): {
    canonicalStory: string;
    extraStory: string;
};
