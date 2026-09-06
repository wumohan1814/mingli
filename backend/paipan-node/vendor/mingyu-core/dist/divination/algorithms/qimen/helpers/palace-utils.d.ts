type TianPanPalace = {
    tianPan: {
        star: string;
        stem?: string;
        companionStar?: string;
        companionStem?: string;
    };
};
export declare function hasTianPanStar(palace: TianPanPalace, star: string): boolean;
export declare function getTianPanStemForStar(palace: TianPanPalace, star: string): string | undefined;
export declare function hasTianPanStem(palace: TianPanPalace, stem: string): boolean;
export declare function getTianPanStars(palace: TianPanPalace): string[];
export declare function getTianPanStems(palace: TianPanPalace): string[];
export declare function getTianPanPairs(palace: TianPanPalace): Array<{
    star: string;
    stem: string;
}>;
export declare function formatTianPanStars(palace: TianPanPalace): string;
export declare function formatTianPanStems(palace: TianPanPalace): string;
export declare function getDunJiaStem(hourGanZhi: string): string;
export declare function getOppositePalace(palace: number): number | null;
export declare function getDoorElement(door: string): string;
export {};
