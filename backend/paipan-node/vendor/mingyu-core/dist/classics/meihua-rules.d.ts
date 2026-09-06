import type { MeihuaBodyUseJudgement } from './types';
/**
 * 《梅花易数》体用生克与万物类象断语表
 * 原典出处：《梅花易数·体用总断》《观梅数诀》
 */
export declare const MEIHUA_RELATION_JUDGEMENTS: Record<string, MeihuaBodyUseJudgement>;
import type { MeihuaTrigramClassic } from './types';
/**
 * 《梅花易数·八卦万物类象》象数全览
 */
export declare const MEIHUA_TRIGRAM_CLASSICS: Record<string, MeihuaTrigramClassic>;
export declare function getMeihuaTrigramClassic(trigram: string): MeihuaTrigramClassic | undefined;
