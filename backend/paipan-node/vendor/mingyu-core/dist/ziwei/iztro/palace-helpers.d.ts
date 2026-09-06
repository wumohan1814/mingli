import type { AnalysisPayloadV1, PalaceFact, StarFact } from '../../types/analysis';
/** 汇总宫位内全部主星、辅星与杂曜。 */
export declare function getAllStars(palace: PalaceFact): StarFact[];
/** 按名称查宫，兼容“命”与“命宫”两种写法。 */
export declare function getPalaceByName(payload: AnalysisPayloadV1, palaceName: string): PalaceFact | null;
export declare function getPalaceByIndex(payload: AnalysisPayloadV1, palaceIndex?: number): PalaceFact | null;
export declare function getBodyPalace(payload: AnalysisPayloadV1): PalaceFact | null;
/**
 * 根据身宫所在宫位推导紫微斗数古典【命身复合主轴】断诀。
 * 依据《紫微斗数全书》《诸星问答论》：
 * - 命身同宫（子午时）：主见坚固自主执着，行藏不易受外界动摇，先天宿命与后天作为合一。
 * - 身在迁移（卯酉时）：身在迁移，一生多变动向外拓展，社会人际与外部机运为后天重心。
 * - 身在官禄（寅申时）：身在官禄，重名位权责与事业成就，责任感深重，后天行藏系于职守。
 * - 身在财帛（辰戌时）：身在财帛，重现实利禄与财富运作，行事讲求实效，以后天求财进退为依归。
 * - 身在夫妻（巳亥时）：身在夫妻，重家庭情感与婚恋归宿，配偶影响深远，易受感情关系牵动。
 * - 身在福德（丑未时）：身在福德，重精神寄托、情趣与内省体验，好精神享受，后天行藏随心境变化。
 */
export declare function getBodyPalaceAxisSummary(palaceName?: string): string | undefined;
export declare function getOppositePalace(payload: AnalysisPayloadV1, palace: PalaceFact | null): PalaceFact | null;
export declare function getSurroundedPalaces(payload: AnalysisPayloadV1, palace: PalaceFact | null): PalaceFact[];
export declare function dedupePalaces(palaces: Array<PalaceFact | null | undefined>): PalaceFact[];
export declare function collectMutagenStars(stars: StarFact[], key: 'birth_mutagen' | 'active_scope_mutagen'): string[];
/**
 * 从结构化运限命中中选择最值得优先查看的宫位。
 * 只返回宫位事实，不生成报告文案，适合页面、API 和提示词共同复用。
 */
export declare function buildScopeFocusPalaces(payload: AnalysisPayloadV1): PalaceFact[];
