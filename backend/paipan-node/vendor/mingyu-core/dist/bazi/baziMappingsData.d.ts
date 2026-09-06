/**
 * 八字核心映射关系
 */
import type { CommanderEntry } from './baziTypes';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES, ZODIACS, SIXTY_CYCLE, NAYIN_MAP } from '../ganzhi/data';
type RelationMap = {
    [key: string]: string;
};
type MultiRelationMap = {
    [key: string]: string[];
};
export { HEAVENLY_STEMS, EARTHLY_BRANCHES, ZODIACS, SIXTY_CYCLE, NAYIN_MAP };
export declare const BASIC_MAPPINGS: {
    HEAVENLY_STEMS: typeof HEAVENLY_STEMS;
    EARTHLY_BRANCHES: typeof EARTHLY_BRANCHES;
    SIXTY_CYCLE: readonly string[];
    STEM_WUXING: string[];
    BRANCH_WUXING: string[];
    STEM_YINYANG: string[];
    WUXING_SHENG: RelationMap;
    WUXING_KE: RelationMap;
    TIAN_GAN_WU_HE: RelationMap;
    TIAN_GAN_CHONG: RelationMap;
    DI_ZHI_LIU_HE: RelationMap;
    DI_ZHI_SAN_HE: MultiRelationMap;
    DI_ZHI_CHONG: RelationMap;
    DI_ZHI_SAN_HUI: MultiRelationMap;
    DI_ZHI_AN_HE: RelationMap;
    DI_ZHI_XING: MultiRelationMap;
    DI_ZHI_HAI: RelationMap;
    DI_ZHI_PO: RelationMap;
};
/** 兼容八字旧名，实际与公共地支藏干表为同一真相源。 */
export declare const HIDDEN_STEMS: Record<string, string[]>;
export declare const MONTH_COMMANDER: Record<string, CommanderEntry[]>;
export declare const TWELVE_STAGES_MAP: Record<string, Record<string, string>>;
/**
 * 建禄格精确映射：日干在月支为临官禄位
 * 甲禄在寅、乙禄在卯、丙禄在巳、丁禄在午、戊禄在巳、己禄在午、庚禄在申、辛禄在酉、壬禄在亥、癸禄在子
 */
export declare const LU_BRANCH_MAP: Record<string, string>;
/**
 * 月刃格精确映射：阳干在月支为帝旺羊刃位
 * 甲刃在卯、丙戊刃在午、庚刃在酉、壬刃在子（阴干无真正羊刃）
 */
export declare const REN_BRANCH_MAP: Record<string, string>;
/**
 * 三合局定义（按局名→三支列表格式）
 * 与 BASIC_MAPPINGS.DI_ZHI_SAN_HE 互补：那边是每支→另两支，这边是局名→三支
 */
export declare const SAN_HE_MAP: Record<string, string[]>;
/**
 * 三会局定义（与 BASIC_MAPPINGS.DI_ZHI_SAN_HUI 数据一致，独立导出便于直接引用）
 */
export declare const SAN_HUI_MAP: Record<string, string[]>;
/**
 * 辰戌丑未四库全
 */
export declare const SI_KU: string[];
