export interface PromptSchoolProfile {
    label: string;
    task: string;
    basis: string;
    category: '流派' | '断法' | '侧重';
}
/**
 * 各术数可由同一份既定盘面支持的解读口径。
 * 会改变排盘结果的算法（例如奇门转盘/飞盘、拆补/置闰）不放在这里，
 * 由各自排盘参数决定并在盘面资料中明确标注。
 */
export declare const PROMPT_SCHOOL_PROFILES: {
    readonly bazi: {
        readonly ziping: {
            readonly label: "子平派";
            readonly category: "流派";
            readonly task: "以月令为提纲，结合日主根气、透干、格局成败、调候与岁运制化形成判断。";
            readonly basis: "《渊海子平》《三命通会》《子平真诠》《滴天髓》《穷通宝鉴》的子平法资料。";
        };
        readonly mangpai: {
            readonly label: "盲派";
            readonly category: "流派";
            readonly task: "以四柱宫位和十神落位为骨架，结合宾主、体用、透干通根、墓库空亡、组合做功与分柱年限形成判断。";
            readonly basis: "子平典籍的十神、藏干、宫位和生克资料，以及近现代盲派通行整理口径。";
        };
        readonly xinpai: {
            readonly label: "新派";
            readonly category: "流派";
            readonly task: "按月令、司令、通根、帮扶与克泄耗判定旺衰，落实喜用忌神的位置并观察原局与岁运的动态作用。";
            readonly basis: "子平典籍的旺衰、调候和生克制化资料，以及近现代新派通行整理口径。";
        };
    };
    readonly ziwei: {
        readonly sanhe: {
            readonly label: "三合派";
            readonly category: "流派";
            readonly task: "以命身宫为核心，结合本宫主星庙旺、对宫、三方四正和辅煞夹拱形成判断。";
            readonly basis: "《紫微斗数全书》《紫微斗数全集》的宫位、星曜与三方四正资料。";
        };
        readonly feixing: {
            readonly label: "飞星派";
            readonly category: "流派";
            readonly task: "以生年、运限、自化和飞化链路为主线，追踪四化起点、落宫及宫位之间的动态作用。";
            readonly basis: "《紫微斗数全书》的十干四化资料及后世飞星派通行读法。";
        };
        readonly sihua: {
            readonly label: "四化派";
            readonly category: "流派";
            readonly task: "以禄权科忌为主线，结合生年四化、运限四化及其落宫解释主题、助力、显化与阻滞。";
            readonly basis: "《紫微斗数全书》的十干四化资料及四化派通行读法。";
        };
    };
    readonly liuyao: {
        readonly huozhulin: {
            readonly label: "火珠林法";
            readonly category: "断法";
            readonly task: "以纳甲、六亲、世应、用神和月日旺衰为主线，结合动变、空破与伏神形成判断。";
            readonly basis: "京房八宫纳甲体系及《火珠林》的纳甲占断资料。";
        };
        readonly bushizhengzong: {
            readonly label: "《卜筮正宗》法";
            readonly category: "断法";
            readonly task: "先定用神与原忌仇神，再结合月建日辰、动变生克、旬空月破和进退反伏形成判断。";
            readonly basis: "《卜筮正宗》的用神、生克制化、动变与病药资料。";
        };
        readonly zengshanbuyi: {
            readonly label: "《增删卜易》法";
            readonly category: "断法";
            readonly task: "以用神真实旺衰和日月动变的有效作用为核心，结合应期与卦中实际触发形成判断。";
            readonly basis: "《增删卜易》的用神旺衰、日月动变与应期资料。";
        };
    };
    readonly meihua: {
        readonly tiyong: {
            readonly label: "体用生克法";
            readonly category: "断法";
            readonly task: "以体卦为主体、用卦为事项，结合主互变三层体用生克和四时旺衰形成判断。";
            readonly basis: "通行本《梅花易数》的体用、互变与四时旺衰资料。";
        };
        readonly xiangshu: {
            readonly label: "象数取象法";
            readonly category: "断法";
            readonly task: "结合卦象、五行、方位、时序和动爻位置提取事项的形态、人物与过程线索。";
            readonly basis: "《周易》八卦象类与通行本《梅花易数》的象数资料。";
        };
        readonly yaoci: {
            readonly label: "卦爻辞参断法";
            readonly category: "断法";
            readonly task: "以本卦、动爻和变卦对应的卦爻辞为义理主线，结合体用和盘面事实回答问题。";
            readonly basis: "《周易》卦辞、爻辞及传统易象资料。";
        };
    };
    readonly xiaoliuren: {
        readonly shunshu: {
            readonly label: "六宫顺数法";
            readonly category: "断法";
            readonly task: "依据农历月、日、时逐步顺数所得时宫，结合月宫、日宫到时宫的递进关系判断过程。";
            readonly basis: "通行俗传小六壬六宫顺数掌诀。";
        };
        readonly gongjue: {
            readonly label: "六宫歌诀法";
            readonly category: "断法";
            readonly task: "以最终落宫歌诀为核心，结合月、日、时三宫的吉凶层次和语义形成判断。";
            readonly basis: "通行俗传小六壬六宫歌诀。";
        };
    };
    readonly jinkoujue: {
        readonly siwei: {
            readonly label: "四位生克法";
            readonly category: "断法";
            readonly task: "以地分、将神、贵神、人元四位及其五行生克、阴阳和月令旺衰形成判断。";
            readonly basis: "《六壬神课金口诀古本》的四位、阴阳次第与五用资料。";
        };
        readonly fayong: {
            readonly label: "阴阳发用法";
            readonly category: "断法";
            readonly task: "先依阴阳次第确定发用位置，再结合发用旺衰、空亡及其与其余三位的作用形成判断。";
            readonly basis: "《六壬神课金口诀古本》的阴阳发用资料。";
        };
        readonly wudong: {
            readonly label: "五动三动法";
            readonly category: "断法";
            readonly task: "以盘面实际成立的五动、三动为事件主线，结合四位关系说明人物、过程与结果。";
            readonly basis: "《六壬神课金口诀古本》的五动三动资料。";
        };
    };
    readonly qimen: {
        readonly gongwei: {
            readonly label: "宫位用神法";
            readonly category: "断法";
            readonly task: "先确定事项用神及其落宫，结合宫内门、星、神、天地盘干和宫位生克形成判断。";
            readonly basis: "《烟波钓叟歌》《御定奇门宝鉴》的九宫、三奇六仪、九星八门八神资料。";
        };
        readonly geju: {
            readonly label: "格局取象法";
            readonly category: "断法";
            readonly task: "以值符值使、三奇格局、九遁、伏吟反吟、门迫击刑、入墓空亡等实际命中格局形成判断。";
            readonly basis: "《烟波钓叟歌》《御定奇门宝鉴》《奇门遁甲秘籍大全》的格局资料。";
        };
        readonly zhuke: {
            readonly label: "主客方略法";
            readonly category: "断法";
            readonly task: "结合日干、时干、值符值使和事项用神区分主客、动静、先后与方位时机，形成策略判断。";
            readonly basis: "时家奇门主客、动静、方位与时机的通行资料。";
        };
    };
    readonly liuren: {
        readonly keti: {
            readonly label: "课体法";
            readonly category: "断法";
            readonly task: "以四课、发用、取传规则、三传结构和课体为主线，说明事情的发端、转折与归结。";
            readonly basis: "《大六壬大全》《御定六壬直指》的四课三传与课体资料。";
        };
        readonly bifafu: {
            readonly label: "《毕法赋》法";
            readonly category: "断法";
            readonly task: "依据盘面实际成立的课传关系，对照《毕法赋》法则提炼主要矛盾、助力和阻力。";
            readonly basis: "《毕法赋》及《六壬指南》的课传判断资料。";
        };
        readonly leishen: {
            readonly label: "类神神将法";
            readonly category: "断法";
            readonly task: "围绕问题选取类神，结合类神在四课三传中的旺衰、空亡、天将和前后传递形成判断。";
            readonly basis: "《大六壬大全》《六壬指南》的类神、天将与旺衰资料。";
        };
    };
    readonly tarot: {
        readonly rws: {
            readonly label: "RWS 图像法";
            readonly category: "流派";
            readonly task: "依据牌面图像、人物姿态、象征物、正逆位及牌位职能形成判断。";
            readonly basis: "Rider-Waite-Smith 体系及《The Pictorial Key to the Tarot》的牌义资料。";
        };
        readonly yuansu: {
            readonly label: "元素与数序法";
            readonly category: "断法";
            readonly task: "结合牌组层次、火水风土元素、数字递进与宫廷牌角色观察能量分布和发展阶段。";
            readonly basis: "Rider-Waite-Smith 体系的四元素、数字序列与大小阿卡纳结构。";
        };
        readonly narrative: {
            readonly label: "牌阵叙事法";
            readonly category: "断法";
            readonly task: "按牌位顺序和相邻牌关系建立事件线，说明现状、推动因素、转折与趋向。";
            readonly basis: "现代塔罗牌阵位置、牌序与组合解读的通行资料。";
        };
    };
    readonly lenormand: {
        readonly combination: {
            readonly label: "邻牌组合法";
            readonly category: "断法";
            readonly task: "以相邻牌的名词、动词和修饰关系组成事件短句，再结合牌序回答现实问题。";
            readonly basis: "Petit Lenormand 传统牌义与邻牌组合资料。";
        };
        readonly eventline: {
            readonly label: "事件线法";
            readonly category: "断法";
            readonly task: "按牌阵位置与牌序追踪事件的起点、变化、阻力和结果，突出可观察的现实发展。";
            readonly basis: "Petit Lenormand 牌序与线性牌阵的通行读法。";
        };
        readonly significator: {
            readonly label: "主题牌法";
            readonly category: "断法";
            readonly task: "以问题对应的主题牌为中心，结合其邻牌、方向和所在位置归纳核心人物与事件。";
            readonly basis: "Petit Lenormand 主题牌与邻牌关系的通行读法。";
        };
    };
    readonly almanac: {
        readonly xieji: {
            readonly label: "协纪择日法";
            readonly category: "流派";
            readonly task: "先核对事项宜忌和直接冲犯，再综合岁月日时神煞、参与人关系与可用时辰比较候选日。";
            readonly basis: "《钦定协纪辨方书》的择日体系资料。";
        };
        readonly jianchu: {
            readonly label: "建除十二神法";
            readonly category: "断法";
            readonly task: "以建除十二神与事项性质的匹配为主线，结合日辰宜忌、冲煞和时辰形成判断。";
            readonly basis: "传统建除十二神及《选择要略》的择日资料。";
        };
        readonly comprehensive: {
            readonly label: "综合择日法";
            readonly category: "断法";
            readonly task: "分层比较原始宜忌、建除、宿曜神煞、参与人刑冲破害与可用时辰，形成候选日排序。";
            readonly basis: "《钦定协纪辨方书》《选择要略》及通行择日资料。";
        };
    };
    readonly astrolabe: {
        readonly modern: {
            readonly label: "现代心理占星";
            readonly category: "流派";
            readonly task: "以太阳、月亮、上升、命主星和主要相位解释性格动力、需求、关系模式与成长主题。";
            readonly basis: "现代西方占星的行星、星座、宫位与相位通行资料。";
        };
        readonly traditional: {
            readonly label: "古典占星";
            readonly category: "流派";
            readonly task: "以命主星、宫主星、行星落宫与主要相位为主线，结合盘面已列资料判断具体生活领域。";
            readonly basis: "希腊化与传统西方占星的宫位主宰、行星性质和相位资料。";
        };
        readonly timing: {
            readonly label: "时限触发法";
            readonly category: "断法";
            readonly task: "以本命结构为根，结合盘面实际提供的行运或时限资料观察阶段主题和触发时间。";
            readonly basis: "现代与传统西方占星的本命承接和行运触发通行资料。";
        };
    };
    readonly taiyi: {
        readonly zhuke: {
            readonly label: "主客定算法";
            readonly category: "断法";
            readonly task: "以主算、客算、定算及主客将参为核心，比较主客强弱、动静与攻守条件。";
            readonly basis: "《太乙金镜式经》的主客定算与将参资料。";
        };
        readonly gongwei: {
            readonly label: "宫位神将法";
            readonly category: "断法";
            readonly task: "结合太乙、文昌、始击、计神的落宫、阴阳遁和局数形成阶段局势判断。";
            readonly basis: "《太乙金镜式经》的七十二局与神将落宫资料。";
        };
    };
    readonly bazhai: {
        readonly dayounian: {
            readonly label: "大游年法";
            readonly category: "断法";
            readonly task: "以宅卦起大游年，结合八方四吉四凶及门、房、灶所在方位形成判断。";
            readonly basis: "《八宅明镜》《阳宅十书》的宅卦与大游年八宫资料。";
        };
        readonly mingzhai: {
            readonly label: "命宅配合法";
            readonly category: "断法";
            readonly task: "结合命卦、宅卦、东四西四分类与实际门向，判断居住者和住宅方位的配合。";
            readonly basis: "《八宅明镜》《阳宅十书》的命卦、宅卦与人宅配合资料。";
        };
    };
    readonly residential: {
        readonly bazhai: {
            readonly label: "八宅派";
            readonly category: "流派";
            readonly task: "依据命卦、宅卦、坐向门向和八方四吉四凶判断人宅配合与空间用途。";
            readonly basis: "《八宅明镜》《阳宅十书》的八宅大游年资料。";
        };
        readonly xuankong: {
            readonly label: "玄空飞星派";
            readonly category: "流派";
            readonly task: "依据三元九运、运盘山盘向盘、旺衰与到山到向判断宅运和方位时效。";
            readonly basis: "玄空飞星三元九运、元龙阴阳顺逆与下卦资料。";
        };
    };
    readonly xuankong: {
        readonly sanYuan: {
            readonly label: "三元九运法";
            readonly category: "断法";
            readonly task: "以建造时间所属三元九运和当前运势为背景，判断各星当运、退运与未来作用；有流年流月时叠看紫白加临。";
            readonly basis: "玄空飞星三元九运、九星旺衰与三元紫白流年流月的通行资料。";
        };
        readonly shanxiang: {
            readonly label: "山向飞星法";
            readonly category: "断法";
            readonly task: "以坐山、向首、运盘、山盘和向盘的组合为核心，判断到山到向及各宫作用。";
            readonly basis: "玄空飞星二十四山、元龙阴阳顺逆和下卦飞布资料。";
        };
    };
    readonly qizheng: {
        readonly guolao: {
            readonly label: "果老星宗法";
            readonly category: "流派";
            readonly task: "以命身宫、七政四余、星曜落宫与二十八宿为骨架，结合主要吊照形成判断；有行限或流曜时再看阶段加临。";
            readonly basis: "《果老星宗》的命身、星曜、宫位、吊照与命宫起限资料。";
        };
        readonly wuxingjingyi: {
            readonly label: "五星精义法";
            readonly category: "断法";
            readonly task: "以日月五星性质、星曜强弱、宫位和彼此关系为主线，结合盘面已列星历位置形成判断。";
            readonly basis: "《御定五星精义》《星学大成》的五星、宫位与星曜关系资料。";
        };
    };
    readonly zodiac: {
        readonly ganzhi: {
            readonly label: "干支关系法";
            readonly category: "断法";
            readonly task: "以生肖地支与流年干支的值、冲、刑、害、破、六合关系形成年度判断。";
            readonly basis: "《三命通会》等传统干支关系资料。";
        };
        readonly sanhe: {
            readonly label: "三合五行法";
            readonly category: "断法";
            readonly task: "结合生肖所属三合三会、流年五行和年干生克，观察助力、牵制与环境变化。";
            readonly basis: "传统地支三合三会与干支五行生克资料。";
        };
    };
    readonly 'wuyun-liuqi': {
        readonly yunqi: {
            readonly label: "五运六气法";
            readonly category: "断法";
            readonly task: "以岁运、司天、在泉、主气和客气为骨架，说明全年气候与阶段气化主线。";
            readonly basis: "《黄帝内经·素问》七篇大论的五运六气资料。";
        };
        readonly sitian: {
            readonly label: "司天在泉法";
            readonly category: "断法";
            readonly task: "以司天主上半年、在泉主下半年的气化关系为主线，结合间气与时段变化形成判断。";
            readonly basis: "《素问·天元纪大论》《素问·六微旨大论》等司天在泉资料。";
        };
        readonly kezhu: {
            readonly label: "客主加临法";
            readonly category: "断法";
            readonly task: "逐步比较主运客运、主气客气的加临、生克与顺逆，观察各阶段偏盛偏衰。";
            readonly basis: "《素问》运气七篇的主客运气与加临资料。";
        };
    };
    readonly 'huangji-jingshi': {
        readonly yuanhui: {
            readonly label: "元会运世法";
            readonly category: "断法";
            readonly task: "以元、会、运、世的时间层级定位当前阶段，再结合值年卦观察长期与年度主题。";
            readonly basis: "《皇极经世》的元会运世时间体系资料。";
        };
        readonly guaqi: {
            readonly label: "值年卦气法";
            readonly category: "断法";
            readonly task: "以值年卦、互卦、变卦和动爻为主线，结合卦气与时间位置形成年度判断。";
            readonly basis: "《皇极经世》值年卦与传统卦气资料。";
        };
    };
};
export type PromptSchoolMethod = keyof typeof PROMPT_SCHOOL_PROFILES;
export type PromptSchoolId<Method extends PromptSchoolMethod> = keyof (typeof PROMPT_SCHOOL_PROFILES)[Method] & string;
export declare function getPromptSchoolProfiles(method: PromptSchoolMethod): Record<string, PromptSchoolProfile>;
export declare function getPromptSchoolIds(method: PromptSchoolMethod): string[];
export declare function normalizePromptSchoolIds(method: PromptSchoolMethod, schools?: readonly string[] | null): string[];
export declare function getPromptSchoolSectionTitle(method: PromptSchoolMethod, schools?: readonly string[] | null): string;
export declare function formatPromptSchoolGuidance(method: PromptSchoolMethod, schools?: readonly string[] | null): string;
export declare function buildPromptSchoolSection(method: PromptSchoolMethod, schools?: readonly string[] | null): string;
