/**
 * @file 八字全息分析与全量衍生计算器 (Bazi Natal Dossier & Enhanced Calculation)
 * @description 为命录补齐所有能计算的八字数据，包括三垣、五行加权、全量柱间作用、神煞典故、十神流通与大运流年矩阵。
 */
import { type BaziChartResult } from '../bazi';
import type { MingluBeginnerGuide, MingluFiveElementsSectionData, MingluInteractionItem, MingluLifeStagesSectionData, MingluLuckChronicleSectionData, MingluPatternUsefulGodSectionData, MingluPillarsSectionData, MingluShenShaItem, MingluTenGodsSectionData } from './types';
/** 计算增强版四柱全息信息（含三垣、月令、命卦） */
export declare function buildEnhancedPillarsSection(baziResult: BaziChartResult): MingluPillarsSectionData;
/** 计算五行能量加权分布与日主旺衰得分 */
export declare function buildEnhancedFiveElementsSection(baziResult: BaziChartResult): MingluFiveElementsSectionData;
/** 提取格局成败、喜忌用神与古籍评注 */
export declare function buildEnhancedPatternUsefulGodSection(baziResult: BaziChartResult): MingluPatternUsefulGodSectionData;
/** 挖掘全量柱间作用网络（合冲刑害破暗合伏吟反吟） */
export declare function buildEnhancedInteractions(baziResult: BaziChartResult): MingluInteractionItem[];
/** 整理全息神煞谱系与典故考据 */
export declare function buildEnhancedShenShaSection(baziResult: BaziChartResult): MingluShenShaItem[];
/** 整理十神心性透藏与生克流通分析 */
export declare function buildEnhancedTenGodsSection(baziResult: BaziChartResult): MingluTenGodsSectionData;
/** 生成十二长生全息对照表与四柱自坐长生 */
export declare function buildEnhancedLifeStagesSection(baziResult: BaziChartResult): MingluLifeStagesSectionData;
/** 整理大运流年流月全息编年大表 */
export declare function buildEnhancedLuckChronicleSection(baziResult: BaziChartResult): MingluLuckChronicleSectionData;
/** 提取小白白话入门与生活化意象指南 */
export declare function buildBeginnerGuide(baziResult: BaziChartResult): MingluBeginnerGuide;
