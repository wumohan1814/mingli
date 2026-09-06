/**
 * @file 紫微斗数格局检测与证据边界
 * @description 只执行已登记古籍版本、卷次、原文和可复算条件的格局规则。
 */
import type { PalaceFact, PatternFact, ZiweiPatternAnalysis } from '../../types/analysis';
export declare const ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES: readonly [{
    readonly name: "禄马佩印";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "禄马佩印，马前有禄印星同宫是也。";
    readonly reason: "固定版本没有明确“印星”所指星曜，也没有定义“马前”的宫位方向，不能唯一复算。";
}, {
    readonly name: "紫府朝垣";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "紫府朝垣，见前批注。";
    readonly reason: "同一版本没有给出独立于紫府同宫、紫府夹命的唯一条件，不能重复造一条同义规则。";
}, {
    readonly name: "明珠出海";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "明珠出海，见前批注。";
    readonly reason: "固定版本只保留名称和“见前批注”，没有明确主星、宫位与生旺条件。";
}, {
    readonly name: "日月同临";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "日月同临，见前批注。";
    readonly reason: "固定版本没有说明同临命、身或其他宫位，也没有给出庙旺和吉煞必要条件。";
}, {
    readonly name: "文星暗拱";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "文星暗拱，见前批注。";
    readonly reason: "固定版本没有定义文星范围及“暗拱”采用六合、三方还是相邻宫，不能唯一复算。";
}, {
    readonly name: "明禄暗禄";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "明禄暗禄，见前批注。";
    readonly reason: "固定版本没有定义“暗禄”的宫位关系，不能直接采用后世流派的六合解释。";
}, {
    readonly name: "科明暗禄";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "科明暗禄，见前批注。";
    readonly reason: "固定版本没有给出化科、明禄、暗禄的具体落宫与会照关系。";
}, {
    readonly name: "科权禄主";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·论科权禄主格）";
    readonly quote: "禄权周勃命中逢，迎合权星兼吉曜。";
    readonly reason: "标题含科权禄，正文只明确禄权与吉曜，没有说明化科的必要位置，条件不闭合。";
}, {
    readonly name: "财荫夹印";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定富局）";
    readonly quote: "财荫夹印，相守命武梁来夹是也，田宅宫亦然。";
    readonly reason: "若逐字取天相守中宫、武曲天梁分夹，则与十四主星固定排布矛盾；若把“财”改释为化禄，又超出该版本原文，故不伪造规则。";
}, {
    readonly name: "昌曲夹命";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·文昌文曲）";
    readonly quote: "昌曲夹命最为奇，假若命在丑宫，文昌在寅，文曲在子是也。不贵即富，吉多方论此为贵。";
    readonly reason: "固定版本没有定义“吉多”的吉曜范围、取用宫位和比较阈值，不能用项目自定星表代替原典条件。";
}, {
    readonly name: "日月夹命";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "日月夹命，不坐空亡遇逢本宫有吉星是也。";
    readonly reason: "固定版本没有定义“吉星”的完整星曜范围，不能用项目自定星表决定是否命中。";
}, {
    readonly name: "羊刃入庙";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "羊刃入庙，辰戍丑未守命遇吉是也。";
    readonly reason: "固定版本没有定义“遇吉”所指星曜与会照范围，条件不能唯一复算。";
}, {
    readonly name: "左辅文昌";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·斗数骨髓赋）";
    readonly quote: "左辅文昌会吉星尊居八座。";
    readonly reason: "固定版本没有定义“会吉星”的星曜范围和宫位关系，卷三又仅写“左辅文昌位至三台”，两处口径不能唯一合并。";
}, {
    readonly name: "贪铃并守";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·贪狼）";
    readonly quote: "贪狼遇铃火四墓宫豪富家资侯伯贵，辰戌宫佳，丑未宫次之，若守照俱可论吉。";
    readonly reason: "原文同时包含铃星、火星以及守、照两种关系，现有名称不足以唯一确定哪些分支属于必要条件。";
}, {
    readonly name: "廉杀巳亥";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·廉贞）";
    readonly quote: "廉贞七杀居巳亥流荡天涯。";
    readonly reason: "当前固定安星体系中廉贞、七杀只会同宫于丑、未，不可能同守巳、亥；原文与当前排盘体系冲突。";
}, {
    readonly name: "日月反背";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·太阳太阴拱照）";
    readonly quote: "若反背日戌月辰，子月午。若出外离宗成家也吉。勿概以反背论。";
    readonly reason: "“日戌月辰，子月午”标点与主语残缺，无法唯一判断子、午两宫分别对应太阳还是太阴。";
}, {
    readonly name: "日照雷门";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·太阳）";
    readonly quote: "日照雷门子辰卯地昼生富贵声扬。";
    readonly reason: "“子辰卯地”的断句与“子”字含义不明，不能静默省略子宫后只执行卯、辰两宫。";
}, {
    readonly name: "金舆扶驾";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定富贵局）";
    readonly quote: "金舆扶驾，紫微守命前后有日月来夹是也。";
    readonly reason: "当前固定安星体系中太阳与紫微始终相隔三宫，不可能与太阴分居紫微相邻两宫；原文与当前排盘体系冲突。";
}, {
    readonly name: "科权禄拱命";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·紫微）";
    readonly quote: "紫微居子午科权禄照最为奇，科权禄三方照是也。";
    readonly reason: "按当前固定的十干四化和主辅星排布逐项枚举，紫微守子、午命宫时不存在禄、权、科齐从命宫以外三方会照的本命盘；不能伪造命中样本。";
}, {
    readonly name: "荫印拱身";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定富局）";
    readonly quote: "荫印拱身，身临田宅梁相拱冲是也，勿坐空亡。";
    readonly reason: "当前固定安命身宫公式中，身宫相对命宫只会落在偶数间隔的宫位，不可能落在相隔三宫的田宅宫；“身临田宅”与当前排盘体系冲突。";
}, {
    readonly name: "财印夹禄";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "财印夹禄，禄守命梁相来夹是也，入财亦然。";
    readonly reason: "当前固定主星排布中天相、天梁始终相邻，不可能分居任一宫位的前后两宫；原文的“夹”不能按当前相邻夹宫口径复算。";
}, {
    readonly name: "马头带剑";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454（卷一·定贵局）";
    readonly quote: "马头带剑，谓马有刃是也，不是居午格。";
    readonly reason: "按当前以生年干安擎羊、以生年支安天马的规则遍历六十甲子，两星不会同宫；原文“马有刃”不能直接等同为本命天马与擎羊同守。";
}, {
    readonly name: "紫禄同宫";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·紫微）";
    readonly quote: "紫禄同宫日月照贵不可言，紫微禄存同宫，日月三合拱照。";
    readonly reason: "当前固定主星排布中太阳与紫微始终相隔三宫，太阳不会落入紫微的三方四正；即使紫微、禄存同宫也不能满足原文所述日月三合。";
}, {
    readonly name: "廉杀庙旺";
    readonly source: "https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626（卷三·廉贞）";
    readonly quote: "廉贞七杀居庙旺反为积富之人。";
    readonly reason: "当前固定主星排布中廉贞、七杀只会同宫于丑、未，而当前亮度表把两宫的廉贞都标为“利”而非“庙”或“旺”；不能擅自把“利”改作原文的庙旺。";
}, ...{
    name: string;
    source: string;
    quote: string;
    reason: string;
}[]];
export declare const VERIFIED_ZIWEI_PATTERN_RULE_COUNT: number;
export declare const ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT: number;
export declare function isVerifiedZiweiPatternKey(value: unknown): value is string;
export declare const ZIWEI_PATTERN_AUDIT_NOTICE: `\u539F\u670984\u6761\u9879\u76EE\u683C\u5C40\u89C4\u5219\u5DF2\u5168\u90E8\u9000\u5F79\uFF1B\u56FA\u5B9A\u7248\u672C\u4F20\u7EDF\u76EE\u5F55\u73B0\u767B\u8BB0${number}\u9879\uFF0C\u5176\u4E2D${number}\u6761\u5177\u5907\u5377\u6B21\u3001\u539F\u6587\u548C\u53EF\u590D\u7B97\u6761\u4EF6\uFF0C${number}\u9879\u660E\u786E\u767B\u8BB0\u4E3A\u4E0D\u53EF\u552F\u4E00\u590D\u7B97\u8FB9\u754C`;
export declare function detectPatterns(params: {
    palaces: PalaceFact[];
    birthTimeLabel?: string;
    birthTimeRange?: string;
    birthYearHeavenlyStem?: string;
}): PatternFact[];
export declare function selectVerifiedZiweiPatterns(params: {
    patterns: PatternFact[];
    palaces: PalaceFact[];
    birthTimeLabel?: string;
    birthTimeRange?: string;
    birthYearHeavenlyStem?: string;
}): PatternFact[];
export declare function buildPatternAnalysis(params: {
    patterns: PatternFact[];
    palaces: PalaceFact[];
    skipped?: boolean;
    sourceUnverified?: boolean;
    birthTimeLabel?: string;
    birthTimeRange?: string;
    birthYearHeavenlyStem?: string;
}): ZiweiPatternAnalysis;
