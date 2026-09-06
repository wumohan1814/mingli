export type AstrolabeAspectCloseness = '紧密' | '中等' | '宽松';
export declare function classifyAspectClosenessByRatio(ratio: number): AstrolabeAspectCloseness;
export declare function normalizedOrbRatioFromStrength(strength: number): number;
export declare function classifyAspectClosenessFromStrength(strength: number): AstrolabeAspectCloseness;
