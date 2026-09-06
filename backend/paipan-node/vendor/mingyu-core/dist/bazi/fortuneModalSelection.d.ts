export type BaziFortuneScope = 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';
export type FortuneModalRow = 'dayun' | 'year' | 'month' | 'day';
export type FortuneModalParentRow = Exclude<FortuneModalRow, 'dayun'>;
export declare function isFortuneModalParentOptionActive(row: FortuneModalParentRow, draftScope: BaziFortuneScope): boolean;
export declare function isFortuneModalDetailOptionActive(row: FortuneModalRow, draftScope: BaziFortuneScope): boolean;
