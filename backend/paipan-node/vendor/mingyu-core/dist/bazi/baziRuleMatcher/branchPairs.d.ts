import type { BranchPillarPairRule, HiddenStemBranchPairRule, HiddenStemSource } from './types';
export declare function matchRequiredBranchPillarPairs(pairRules: BranchPillarPairRule[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchOptionalBranchPillarPairs(pairRules: BranchPillarPairRule[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchForbiddenBranchPillarPairs(pairRules: BranchPillarPairRule[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchRequiredHiddenStemBranchPairs(pairRules: HiddenStemBranchPairRule[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchOptionalHiddenStemBranchPairs(pairRules: HiddenStemBranchPairRule[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
export declare function matchForbiddenHiddenStemBranchPairs(pairRules: HiddenStemBranchPairRule[] | undefined, hiddenStemSources: HiddenStemSource[] | undefined): boolean;
