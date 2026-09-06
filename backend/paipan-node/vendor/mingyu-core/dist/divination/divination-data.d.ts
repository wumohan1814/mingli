/**
 * @file 占卜核心静态数据
 * @description 此文件定义了所有术数推演所需的基础数据，如天干地支、六十甲子、纳甲、节气局数等。
 * 所有数据均经过严格考证，以确保其符合古籍记载之法理。
 */
export declare const dizhi: readonly string[];
export declare const tiangan: readonly string[];
export declare const jiazi: readonly string[];
export declare const wuxing: {
    金: string[];
    木: string[];
    水: string[];
    火: string[];
    土: string[];
};
export declare const liuqinRelations: {
    金: {
        金: string;
        木: string;
        水: string;
        火: string;
        土: string;
    };
    木: {
        木: string;
        土: string;
        火: string;
        金: string;
        水: string;
    };
    水: {
        水: string;
        火: string;
        木: string;
        土: string;
        金: string;
    };
    火: {
        火: string;
        金: string;
        土: string;
        水: string;
        木: string;
    };
    土: {
        土: string;
        水: string;
        金: string;
        木: string;
        火: string;
    };
};
export declare const palaces: {
    乾: {
        name: string;
        wuxing: string;
    };
    兑: {
        name: string;
        wuxing: string;
    };
    离: {
        name: string;
        wuxing: string;
    };
    震: {
        name: string;
        wuxing: string;
    };
    巽: {
        name: string;
        wuxing: string;
    };
    坎: {
        name: string;
        wuxing: string;
    };
    艮: {
        name: string;
        wuxing: string;
    };
    坤: {
        name: string;
        wuxing: string;
    };
};
export declare const palaceHexagrams: {
    [key: string]: string[];
};
export declare const hexagramPalaceMap: {
    [key: string]: string;
};
export declare const hexagramNaJia: {
    [key: string]: string[];
};
export declare const qimen: {
    dizhi: ("子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥")[];
    diPanPalaces: {
        子: number;
        丑: number;
        寅: number;
        卯: number;
        辰: number;
        巳: number;
        午: number;
        未: number;
        申: number;
        酉: number;
        戌: number;
        亥: number;
    };
    palaceStars: string[];
    palaceDoors: string[];
    doorPalaceMap: {
        休门: number;
        生门: number;
        伤门: number;
        杜门: number;
        景门: number;
        死门: number;
        惊门: number;
        开门: number;
    };
    palaceDoorMap: {
        1: string;
        8: string;
        3: string;
        4: string;
        9: string;
        2: string;
        7: string;
        6: string;
    };
    yangGods: string[];
    yinGods: string[];
    ninePositions: {
        name: string;
        direction: string;
        element: string;
    }[];
    jieQiJuShuMap: {
        冬至: {
            dun: string;
            ju: number[];
        };
        小寒: {
            dun: string;
            ju: number[];
        };
        大寒: {
            dun: string;
            ju: number[];
        };
        立春: {
            dun: string;
            ju: number[];
        };
        雨水: {
            dun: string;
            ju: number[];
        };
        惊蛰: {
            dun: string;
            ju: number[];
        };
        春分: {
            dun: string;
            ju: number[];
        };
        清明: {
            dun: string;
            ju: number[];
        };
        谷雨: {
            dun: string;
            ju: number[];
        };
        立夏: {
            dun: string;
            ju: number[];
        };
        小满: {
            dun: string;
            ju: number[];
        };
        芒种: {
            dun: string;
            ju: number[];
        };
        夏至: {
            dun: string;
            ju: number[];
        };
        小暑: {
            dun: string;
            ju: number[];
        };
        大暑: {
            dun: string;
            ju: number[];
        };
        立秋: {
            dun: string;
            ju: number[];
        };
        处暑: {
            dun: string;
            ju: number[];
        };
        白露: {
            dun: string;
            ju: number[];
        };
        秋分: {
            dun: string;
            ju: number[];
        };
        寒露: {
            dun: string;
            ju: number[];
        };
        霜降: {
            dun: string;
            ju: number[];
        };
        立冬: {
            dun: string;
            ju: number[];
        };
        小雪: {
            dun: string;
            ju: number[];
        };
        大雪: {
            dun: string;
            ju: number[];
        };
    };
};
