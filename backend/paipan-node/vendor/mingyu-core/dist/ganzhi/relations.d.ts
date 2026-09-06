export declare const BRANCH_WUXING: Record<string, string>;
export declare const MONTH_LING_WUXING: Record<string, string>;
/**
 * 地支六合（《蠡海集》《三命通会》）：
 * 子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土
 */
export declare const LIUHE_MAP: Record<string, string>;
/** 六合化五行 */
export declare const LIUHE_WUXING: Record<string, string>;
/**
 * 地支三合局（十二支三合化一局）：
 * 申子辰合水局、亥卯未合木局、寅午戌合火局、巳酉丑合金局
 */
export declare const SANHE_GROUPS: Record<string, string[]>;
/** 各支所属三合局 */
export declare const BRANCH_SANHE: Record<string, {
    group: string;
    partners: string[];
}>;
/**
 * 地支半合 — 三合中缺一
 * 如有申子而无辰，为水局半合，合而不全
 */
export declare function isHalfSanhe(branches: string[]): string | null;
/**
 * 地支三会（《淮南子》《三命通会》）：
 * 寅卯辰会木局（东方）、巳午未会火局（南方）、
 * 申酉戌会金局（西方）、亥子丑会水局（北方）
 */
export declare const SANHUI_GROUPS: Record<string, string[]>;
/**
 * 地支相穿/六害（《协纪辨方书》）：
 * 子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害
 */
export declare const LIUHAI_MAP: Record<string, string>;
/**
 * 地支六冲（六冲为对宫相冲）：
 * 子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲
 */
export declare const LIUCHONG_MAP: Record<string, string>;
/**
 * 地支六破/相破：
 * 子酉破、丑辰破、寅亥破、卯午破、巳申破、未戌破
 */
export declare const LIUPO_MAP: Record<string, string>;
/** 地支暗合。 */
export declare const ANHE_MAP: Record<string, string>;
/**
 * 地支三刑（《阴符经》三刑定例）：
 * - 无礼之刑：子刑卯、卯刑子
 * - 无恩之刑：寅刑巳、巳刑申、申刑寅（三刑互刑）
 * - 恃势之刑：丑刑戌、戌刑未、未刑丑
 * - 自刑：辰刑辰、午刑午、酉刑酉、亥刑亥
 */
export declare const SANXING_MAP: Record<string, string>;
/** 每个地支对应的完整相刑成员。 */
export declare const BRANCH_SANXING: Record<string, string[]>;
export declare enum SanxingType {
    WULI = "\u65E0\u793C\u4E4B\u5211",// 子卯
    WUEN = "\u65E0\u6069\u4E4B\u5211",// 寅巳申
    SHISHI = "\u6043\u52BF\u4E4B\u5211",// 丑戌未
    ZIXING = "\u81EA\u5211"
}
/** 获取三刑类型 */
export declare function getSanxingType(branch: string): SanxingType | null;
/**
 * 地支藏干（《渊海子平》《三命通会》本气/中气/余气）：
 * 各支所藏天干，按本气（主气）、中气（次气）、余气排列
 */
export declare const BRANCH_HIDDEN_STEMS: Record<string, string[]>;
/** 地支所藏本气（主气） */
export declare function getHiddenMainStem(branch: string): string;
/** 地支所藏中气（次气） */
export declare function getHiddenMediumStem(branch: string): string | undefined;
/** 地支所藏余气 */
export declare function getHiddenResidualStem(branch: string): string | undefined;
/**
 * 天干合化（《三命通会》天干五合）：
 * 甲己合化土、乙庚合化金、丙辛合化水、丁壬合化木、戊癸合化火
 */
export declare const TIAN_GAN_HE: Record<string, {
    partner: string;
    wuxing: string;
}>;
/**
 * 天干相冲：
 * 甲庚冲、乙辛冲、丙壬冲、丁癸冲
 */
export declare const TIAN_GAN_CHONG: Record<string, string>;
/**
 * 地支顺序索引
 */
export declare const BRANCH_ORDER: readonly string[];
/**
 * 天干顺序索引
 */
export declare const STEM_ORDER: readonly string[];
export declare const WUXING: readonly ["木", "火", "土", "金", "水"];
export type Wuxing = (typeof WUXING)[number];
export declare const SHENG_MAP: Record<string, string>;
export declare const KE_MAP: Record<string, string>;
/**
 * 按《增删卜易》月令提纲定五行旺相休囚死：
 * 旺=同令，相=令生我，休=我生令，囚=我克令，死=令克我。
 */
export declare function getSeasonState(yaoWuxing: string, monthBranch: string): '旺' | '相' | '休' | '囚' | '死';
export declare function getBranchWuxing(branch: string): string;
export declare function isSheng(source: string, target: string): boolean;
export declare function isKe(source: string, target: string): boolean;
/** 检查两个地支是否为六合关系 */
export declare function isLiuhe(a: string, b: string): boolean;
/** 检查两个地支是否为六冲关系 */
export declare function isLiuchong(a: string, b: string): boolean;
/** 检查两个地支是否为六破/相破关系 */
export declare function isLiupo(a: string, b: string): boolean;
/** 检查两个地支是否为六害关系 */
export declare function isLiuhai(a: string, b: string): boolean;
/** 检查两个地支是否为三刑关系 */
export declare function isSanxing(a: string, b: string): boolean;
/** 检查数组中是否构成完整的三合局 */
export declare function isCompleteSanhe(branches: string[]): string | null;
/** 检查数组中是否构成三会局 */
export declare function isCompleteSanhui(branches: string[]): string | null;
/** 检查两个天干是否为五合关系 */
export declare function isTianGanHe(a: string, b: string): boolean;
/** 获取天干五合的化气五行 */
export declare function getTianGanHeWuxing(stem: string): string | null;
/** 检查地支是否为驿马（寅午戌年马在申等） */
export declare function getYiMa(yearBranch: string): string;
/** 检查地支是否为桃花（寅午戌年卯等） */
export declare function getTaoHua(yearBranch: string): string;
/** 获取地支对冲（对宫位） */
export declare function getOppositeBranch(branch: string): string;
/**
 * 获取五行长生位地支
 * 木长生在亥、火长生在寅、金长生在巳、水长生在申、土长生在寅（火土同宫）
 * @param wuxing 五行
 * @returns 长生地支
 */
export declare function getWuxingChangSheng(wuxing: string): string;
