import type { MatchableRule, RuleMatchContext } from './types';
export type { BranchPillarPairRule, DistinctStemGroupCountRule, HiddenStemBranchPairRule, HiddenStemSource, MatchableRule, RuleMatchContext, VisibleStemBranchPairRule, VisibleStemDistancePairRule, VisibleStemPillarPairRule, VisibleStemSource, } from './types';
export declare function matchesRule<T extends MatchableRule>(rule: T, context: RuleMatchContext): boolean;
export declare function matchFirstRule<T extends MatchableRule>(rules: T[], context: RuleMatchContext): T | undefined;
