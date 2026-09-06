import type { AlmanacTopic, DivinationType, JinkoujueDivinationMethod, LenormandSpreadType, LiuyaoTemplateType, LiurenTemplateType, MeihuaDivinationMethod, TarotSpreadType, XiaoliurenDivinationMethod } from '../types/divination';
export type DivinationMethodId = 'random' | Extract<DivinationType, 'liuyao' | 'meihua' | 'xiaoliuren' | 'jinkoujue' | 'qimen' | 'liuren' | 'tarot' | 'ssgw' | 'almanac' | 'lenormand' | 'astrolabe' | 'taiyi' | 'huangji'>;
export declare const DIVINATION_METHOD_OPTIONS: Array<{
    value: DivinationMethodId;
    label: string;
    description: string;
}>;
export declare const GENERAL_DIVINATION_METHOD_OPTIONS: {
    value: DivinationMethodId;
    label: string;
    description: string;
}[];
export declare const MEIHUA_METHOD_OPTIONS: Array<{
    value: Extract<MeihuaDivinationMethod, 'time' | 'number' | 'random'>;
    label: string;
}>;
export declare const XIAOLIUREN_METHOD_OPTIONS: Array<{
    value: XiaoliurenDivinationMethod;
    label: string;
}>;
export declare const JINKOUJUE_METHOD_OPTIONS: Array<{
    value: JinkoujueDivinationMethod;
    label: string;
}>;
export declare const LIUYAO_TEMPLATE_OPTIONS: Array<{
    value: LiuyaoTemplateType;
    label: string;
}>;
export declare const TAROT_SPREAD_OPTIONS: Array<{
    value: TarotSpreadType;
    label: string;
}>;
export declare const LIUREN_TEMPLATE_OPTIONS: Array<{
    value: LiurenTemplateType;
    label: string;
}>;
export declare const ALMANAC_TOPIC_OPTIONS: Array<{
    value: AlmanacTopic;
    label: string;
}>;
export declare const LENORMAND_SPREAD_OPTIONS: Array<{
    value: LenormandSpreadType;
    label: string;
}>;
