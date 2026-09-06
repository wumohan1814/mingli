export interface HexagramData {
    id: number;
    name: string;
    symbol: string;
    binarySymbol: string;
    upper: string;
    lower: string;
    palace: string;
    description: string;
    yaoCi?: string[];
    yongCi?: string;
}
export interface TrigramData {
    name: string;
    symbol: string;
    nature: string;
    element: string;
    lines: number[];
}
export declare const trigramsByIndex: Record<number, TrigramData>;
export declare const hexagramsData: HexagramData[];
