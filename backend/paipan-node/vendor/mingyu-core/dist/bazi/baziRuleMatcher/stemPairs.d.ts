import type { HiddenStemSource, VisibleStemBranchPairRule, VisibleStemDistancePairRule, VisibleStemPillarPairRule, VisibleStemSource } from './types';
export declare function matchRequiredVisibleStemPillarPairs(pairRules: VisibleStemPillarPairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined): boolean;
export declare function matchOptionalVisibleStemPillarPairs(pairRules: VisibleStemPillarPairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined): boolean;
export declare function matchForbiddenVisibleStemPillarPairs(pairRules: VisibleStemPillarPairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined): boolean;
export declare function matchRequiredVisibleStemBranchPairs(pairRules: VisibleStemBranchPairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchOptionalVisibleStemBranchPairs(pairRules: VisibleStemBranchPairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchForbiddenVisibleStemBranchPairs(pairRules: VisibleStemBranchPairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchRequiredVisibleStemDistancePairs(pairRules: VisibleStemDistancePairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined): boolean;
export declare function matchForbiddenVisibleStemDistancePairs(pairRules: VisibleStemDistancePairRule[] | undefined, visibleStemSources: VisibleStemSource[] | undefined): boolean;
