/**
 * @file index.ts
 * Classical metaphysics dictionaries and rules export barrel.
 */
export * from './types';
export * from './qimen-patterns';
export * from './bazi-qiongtong';
export * from './bazi-ditiansui';
export * from './bazi-ziping';
export * from './liuyao-rules';
export * from './meihua-rules';
export * from './zhouyi';
export * from './xiaoliuren-classics';
export * from './jinkoujue-rules';
export * from './liuren-rules';
export * from './ziwei-classics';
export * from './fengshui-classics';
export * from './taiyi-classics';
export * from './huangji-classics';
export * from './qizheng-classics';
export * from './wuyun-liuqi-classics';
export * from './almanac-classics';
import type { AlmanacOfficerClassic, BaziDitiansuiEntry, BaziQiongtongEntry, BaziZipingPatternEntry, BazhaiStarClassic, HuangjiCycleClassic, JinkoujueMovementClassic, LiurenGeneralClassic, LiurenLessonPatternClassic, LiurenTransmissionClassic, LiuyaoChishiClassic, LiuyaoMovementRule, MeihuaBodyUseJudgement, MeihuaTrigramClassic, QimenDeityClassic, QimenDoorClassic, QimenStarClassic, QimenStemPattern, QizhengStarClassic, TaiyiGeneralClassic, XiaoliurenPalaceClassic, XuankongStarClassic, WuyunLiuqiClassic, ZhouyiHexagramText, ZiweiFuClassic, ZiweiStarClassic } from './types';
/**
 * 查询奇门遁甲天盘干 + 地盘干 十干克应格局
 */
export declare function getQimenStemPattern(heavenStem: string, earthStem: string): QimenStemPattern | undefined;
/**
 * 查询奇门遁甲九星释义
 */
export declare function getQimenStarClassic(star: string): QimenStarClassic | undefined;
/**
 * 查询奇门遁甲八门释义
 */
export declare function getQimenDoorClassic(door: string): QimenDoorClassic | undefined;
/**
 * 查询奇门遁甲八神释义
 */
export declare function getQimenDeityClassic(deity: string): QimenDeityClassic | undefined;
/**
 * 查询奇门遁甲烟波钓叟歌精义
 */
export declare function getQimenYanboClassic(keyword: string): {
    title: string;
    verse: string;
    explanation: string;
} | undefined;
export declare function getAllQimenYanboClassics(): {
    title: string;
    verse: string;
    explanation: string;
}[];
/**
 * 查询八字《穷通宝鉴》日主生于月令调候断语
 */
export declare function getBaziQiongtongAdvice(dayMaster: string, monthBranch: string): BaziQiongtongEntry | undefined;
/**
 * 查询八字《滴天髓》日主十干体象与性情
 */
export declare function getBaziDitiansuiAdvice(dayMaster: string): BaziDitiansuiEntry | undefined;
/**
 * 查询八字《子平真诠》八格取用与纯杂判定
 */
export declare function getBaziZipingPatternAdvice(pattern: string): BaziZipingPatternEntry | undefined;
/**
 * 查询六爻动变规则与《黄金策》《增删卜易》断语
 */
export declare function getLiuyaoMovementRule(key: string): LiuyaoMovementRule | undefined;
/**
 * 查询六爻六亲持世歌诀
 */
export declare function getLiuyaoChishiClassic(sixRelation: string): LiuyaoChishiClassic | undefined;
/**
 * 查询梅花易数体用生克决断
 */
export declare function getMeihuaBodyUseJudgement(relationType: string): MeihuaBodyUseJudgement | undefined;
/**
 * 查询梅花易数八卦万物类象
 */
export declare function getMeihuaTrigramClassic(trigram: string): MeihuaTrigramClassic | undefined;
/**
 * 查询周易卦爻辞全本经文
 */
export declare function getZhouyiHexagramClassic(hexagramId: number): ZhouyiHexagramText | undefined;
/**
 * 查询小六壬落宫歌诀与《小六壬口诀》断语
 */
export declare function getXiaoliurenClassic(palaceName: string): XiaoliurenPalaceClassic | undefined;
/**
 * 查询金口诀五动三动与《金口诀大全》断语
 */
export declare function getJinkoujueMovementClassic(key: string): JinkoujueMovementClassic | undefined;
/**
 * 查询大六壬九宗门取传与《大六壬大全》法则
 */
export declare function getLiurenTransmissionClassic(rule: string): LiurenTransmissionClassic | undefined;
/**
 * 查询大六壬经典课体与《六壬指南》释义
 */
export declare function getLiurenLessonPatternClassic(pattern: string): LiurenLessonPatternClassic | undefined;
/**
 * 查询大六壬十二天将精解
 */
export declare function getLiurenGeneralClassic(general: string): LiurenGeneralClassic | undefined;
/**
 * 查询大六壬毕法赋
 */
export declare function getLiurenBifaClassic(keyword: string): {
    title: string;
    sourceBook: string;
    verse: string;
    explanation: string;
} | undefined;
export declare function getAllLiurenBifaClassics(): {
    title: string;
    sourceBook: string;
    verse: string;
    explanation: string;
}[];
/**
 * 查询紫微斗数十四正曜诸星问答论
 */
export declare function getZiweiStarClassic(star: string): ZiweiStarClassic | undefined;
/**
 * 查询紫微斗数太微赋/骨髓赋名句
 */
export declare function getZiweiFuClassic(key: string): ZiweiFuClassic | undefined;
export declare function getAllZiweiFuClassics(): ZiweiFuClassic[];
/**
 * 查询八宅明镜四吉四凶星释义
 */
export declare function getBazhaiStarClassic(star: string): BazhaiStarClassic | undefined;
/**
 * 查询玄空飞星九星释义
 */
export declare function getXuankongStarClassic(starNumber: number | string): XuankongStarClassic | undefined;
/**
 * 查询太乙神数八将与主客算释义
 */
export declare function getTaiyiGeneralClassic(general: string): TaiyiGeneralClassic | undefined;
/**
 * 查询皇极经世元会运世治乱卦气
 */
export declare function getHuangjiCycleClassic(cycle: string): HuangjiCycleClassic | undefined;
/**
 * 查询七政四余十一曜释义
 */
export declare function getQizhengStarClassic(star: string): QizhengStarClassic | undefined;
/**
 * 查询五运六气大运司在经文
 */
export declare function getWuyunLiuqiClassic(factor: string): WuyunLiuqiClassic | undefined;
/**
 * 查询协纪辨方书建除十二神歌诀
 */
export declare function getAlmanacOfficerClassic(officer: string): AlmanacOfficerClassic | undefined;
