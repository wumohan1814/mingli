/**
 * @file index.ts
 * Classical metaphysics dictionaries and rules export barrel.
 */
export * from './types.js';
export * from './qimen-patterns.js';
export * from './bazi-qiongtong.js';
export * from './bazi-ditiansui.js';
export * from './bazi-ziping.js';
export * from './liuyao-rules.js';
export * from './meihua-rules.js';
export * from './zhouyi.js';
export * from './xiaoliuren-classics.js';
export * from './jinkoujue-rules.js';
export * from './liuren-rules.js';
export * from './ziwei-classics.js';
export * from './fengshui-classics.js';
export * from './taiyi-classics.js';
export * from './huangji-classics.js';
export * from './qizheng-classics.js';
export * from './wuyun-liuqi-classics.js';
export * from './almanac-classics.js';
import { QIMEN_STEM_PATTERNS, getQimenDeityClassic as queryQimenDeityClassic, getQimenDoorClassic as queryQimenDoorClassic, getQimenStarClassic as queryQimenStarClassic, getQimenYanboClassic as queryQimenYanboClassic, getAllQimenYanboClassics as queryAllQimenYanboClassics, } from './qimen-patterns.js';
import { getBaziQiongtongAdvice as queryBaziQiongtongAdvice } from './bazi-qiongtong.js';
import { getBaziDitiansuiAdvice as queryBaziDitiansuiAdvice } from './bazi-ditiansui.js';
import { getBaziZipingPatternAdvice as queryBaziZipingPatternAdvice } from './bazi-ziping.js';
import { LIUYAO_MOVEMENT_RULES, getLiuyaoChishiClassic as queryLiuyaoChishiClassic, } from './liuyao-rules.js';
import { MEIHUA_RELATION_JUDGEMENTS, getMeihuaTrigramClassic as queryMeihuaTrigramClassic, } from './meihua-rules.js';
import { ZHOUYI_HEXAGRAMS_TEXT } from './zhouyi.js';
import { getXiaoliurenClassic as queryXiaoliurenClassic } from './xiaoliuren-classics.js';
import { getJinkoujueMovementClassic as queryJinkoujueMovementClassic } from './jinkoujue-rules.js';
import { getLiurenTransmissionClassic as queryLiurenTransmissionClassic, getLiurenLessonPatternClassic as queryLiurenLessonPatternClassic, getLiurenGeneralClassic as queryLiurenGeneralClassic, getLiurenBifaClassic as queryLiurenBifaClassic, getAllLiurenBifaClassics as queryAllLiurenBifaClassics, } from './liuren-rules.js';
import { getZiweiStarClassic as queryZiweiStarClassic, getZiweiFuClassic as queryZiweiFuClassic, getAllZiweiFuClassics as queryAllZiweiFuClassics, } from './ziwei-classics.js';
import { getBazhaiStarClassic as queryBazhaiStarClassic, getXuankongStarClassic as queryXuankongStarClassic, } from './fengshui-classics.js';
import { getTaiyiGeneralClassic as queryTaiyiGeneralClassic } from './taiyi-classics.js';
import { getHuangjiCycleClassic as queryHuangjiCycleClassic } from './huangji-classics.js';
import { getQizhengStarClassic as queryQizhengStarClassic } from './qizheng-classics.js';
import { getWuyunLiuqiClassic as queryWuyunLiuqiClassic } from './wuyun-liuqi-classics.js';
import { getAlmanacOfficerClassic as queryAlmanacOfficerClassic } from './almanac-classics.js';
/**
 * 查询奇门遁甲天盘干 + 地盘干 十干克应格局
 */
export function getQimenStemPattern(heavenStem, earthStem) {
    return QIMEN_STEM_PATTERNS[`${heavenStem}+${earthStem}`];
}
/**
 * 查询奇门遁甲九星释义
 */
export function getQimenStarClassic(star) {
    return queryQimenStarClassic(star);
}
/**
 * 查询奇门遁甲八门释义
 */
export function getQimenDoorClassic(door) {
    return queryQimenDoorClassic(door);
}
/**
 * 查询奇门遁甲八神释义
 */
export function getQimenDeityClassic(deity) {
    return queryQimenDeityClassic(deity);
}
/**
 * 查询奇门遁甲烟波钓叟歌精义
 */
export function getQimenYanboClassic(keyword) {
    return queryQimenYanboClassic(keyword);
}
export function getAllQimenYanboClassics() {
    return queryAllQimenYanboClassics();
}
/**
 * 查询八字《穷通宝鉴》日主生于月令调候断语
 */
export function getBaziQiongtongAdvice(dayMaster, monthBranch) {
    return queryBaziQiongtongAdvice(dayMaster, monthBranch);
}
/**
 * 查询八字《滴天髓》日主十干体象与性情
 */
export function getBaziDitiansuiAdvice(dayMaster) {
    return queryBaziDitiansuiAdvice(dayMaster);
}
/**
 * 查询八字《子平真诠》八格取用与纯杂判定
 */
export function getBaziZipingPatternAdvice(pattern) {
    return queryBaziZipingPatternAdvice(pattern);
}
/**
 * 查询六爻动变规则与《黄金策》《增删卜易》断语
 */
export function getLiuyaoMovementRule(key) {
    return LIUYAO_MOVEMENT_RULES[key];
}
/**
 * 查询六爻六亲持世歌诀
 */
export function getLiuyaoChishiClassic(sixRelation) {
    return queryLiuyaoChishiClassic(sixRelation);
}
/**
 * 查询梅花易数体用生克决断
 */
export function getMeihuaBodyUseJudgement(relationType) {
    return MEIHUA_RELATION_JUDGEMENTS[relationType];
}
/**
 * 查询梅花易数八卦万物类象
 */
export function getMeihuaTrigramClassic(trigram) {
    return queryMeihuaTrigramClassic(trigram);
}
/**
 * 查询周易卦爻辞全本经文
 */
export function getZhouyiHexagramClassic(hexagramId) {
    return ZHOUYI_HEXAGRAMS_TEXT[hexagramId];
}
/**
 * 查询小六壬落宫歌诀与《小六壬口诀》断语
 */
export function getXiaoliurenClassic(palaceName) {
    return queryXiaoliurenClassic(palaceName);
}
/**
 * 查询金口诀五动三动与《金口诀大全》断语
 */
export function getJinkoujueMovementClassic(key) {
    return queryJinkoujueMovementClassic(key);
}
/**
 * 查询大六壬九宗门取传与《大六壬大全》法则
 */
export function getLiurenTransmissionClassic(rule) {
    return queryLiurenTransmissionClassic(rule);
}
/**
 * 查询大六壬经典课体与《六壬指南》释义
 */
export function getLiurenLessonPatternClassic(pattern) {
    return queryLiurenLessonPatternClassic(pattern);
}
/**
 * 查询大六壬十二天将精解
 */
export function getLiurenGeneralClassic(general) {
    return queryLiurenGeneralClassic(general);
}
/**
 * 查询大六壬毕法赋
 */
export function getLiurenBifaClassic(keyword) {
    return queryLiurenBifaClassic(keyword);
}
export function getAllLiurenBifaClassics() {
    return queryAllLiurenBifaClassics();
}
/**
 * 查询紫微斗数十四正曜诸星问答论
 */
export function getZiweiStarClassic(star) {
    return queryZiweiStarClassic(star);
}
/**
 * 查询紫微斗数太微赋/骨髓赋名句
 */
export function getZiweiFuClassic(key) {
    return queryZiweiFuClassic(key);
}
export function getAllZiweiFuClassics() {
    return queryAllZiweiFuClassics();
}
/**
 * 查询八宅明镜四吉四凶星释义
 */
export function getBazhaiStarClassic(star) {
    return queryBazhaiStarClassic(star);
}
/**
 * 查询玄空飞星九星释义
 */
export function getXuankongStarClassic(starNumber) {
    return queryXuankongStarClassic(starNumber);
}
/**
 * 查询太乙神数八将与主客算释义
 */
export function getTaiyiGeneralClassic(general) {
    return queryTaiyiGeneralClassic(general);
}
/**
 * 查询皇极经世元会运世治乱卦气
 */
export function getHuangjiCycleClassic(cycle) {
    return queryHuangjiCycleClassic(cycle);
}
/**
 * 查询七政四余十一曜释义
 */
export function getQizhengStarClassic(star) {
    return queryQizhengStarClassic(star);
}
/**
 * 查询五运六气大运司在经文
 */
export function getWuyunLiuqiClassic(factor) {
    return queryWuyunLiuqiClassic(factor);
}
/**
 * 查询协纪辨方书建除十二神歌诀
 */
export function getAlmanacOfficerClassic(officer) {
    return queryAlmanacOfficerClassic(officer);
}
