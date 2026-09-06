export type BirthInputText = string | number | undefined;
export interface BirthInputFields {
    year: BirthInputText;
    month: BirthInputText;
    day: BirthInputText;
    isLeapMonth?: boolean;
    dateType?: 'solar' | 'lunar';
    useTrueSolarTime?: boolean;
    birthHour?: BirthInputText;
    birthMinute?: BirthInputText;
    birthLongitude?: BirthInputText;
}
export type BirthInputValidationResult = {
    ok: true;
} | {
    ok: false;
    field: keyof BirthInputFields | string;
    message: string;
};
/** 表单使用的纯数字字段截断规则；不会修改原字符串，也不负责 UI 状态。 */
export declare function clampNumericField(key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute', value: string): string;
/**
 * 校验可来自 JSON 或表单的出生日期资料。
 * 该函数只返回首个字段错误，不依赖 React，也不改变传入对象。
 */
export declare function validateBirthInput(fields: BirthInputFields, personLabel?: string): BirthInputValidationResult;
