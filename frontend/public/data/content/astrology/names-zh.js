// 占星名词映射（中文）· 节135 正文数据统一管理
// 来源：views-cases.js（B3 行星/格局/相位中译，docs/文案交付/B3_astrology_translations.json）
//       components.js（行星名→星盘符号）；零改动迁移

if (typeof CONTENT === 'undefined') window.CONTENT = {};
if (!CONTENT.astrology) CONTENT.astrology = {};

CONTENT.astrology.planetCn = {
  // B3（docs/文案交付/B3_astrology_translations.json）planets 补全
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
  NorthNode: '北交点',
  SouthNode: '南交点',
  Chiron: '凯龙星',
  Lilith: '莉莉丝',
  Asc: '上升点（ASC）',
  MC: '中天（MC）',
  IC: '天底（IC）',
  Dsc: '下降点（DSC）',
  // 既有兼容键（带空格/全称变体，供格局行星串回退匹配）
  Ceres: '谷神星',
  Juno: '婚神星',
  Vesta: '灶神星',
  Pallas: '智神星',
  'North Node': '北交点',
  'True North Node': '北交点',
  'South Node': '南交点',
  'True Lilith': '莉莉丝',
  'Part of Fortune': '福点',
  'Part of Spirit': '灵点'
};

CONTENT.astrology.patternCn = {
  // B3 8 格局（docs/文案交付/B3_astrology_translations.json patterns，覆盖原 3 项）
  grand_cross: '大十字格局',
  mystic_rectangle: '神秘矩形格局',
  kite: '风筝格局',
  t_square: 'T 三角格局',
  grand_trine: '大三角格局',
  yod: '上帝之指（贤者之指）',
  stellium_sign: '星座群星（同星座三体以上）',
  stellium_house: '宫位群星（同宫位三体以上）'
};

CONTENT.astrology.aspectCn = {
  conjunction: '合相',
  sextile: '六分相',
  square: '四分相',
  trine: '三分相',
  quincunx: '补十二分相（150°）',
  opposition: '对分相'
};

// 行星名 → 星盘符号（符号语言无关；key 随行星中译走，i18n 时按目标语言键名组织）
CONTENT.astrology.planetSym = {
  '太阳': '☉',
  '月亮': '☽',
  '水星': '☿',
  '金星': '♀',
  '火星': '♂',
  '木星': '♃',
  '土星': '♄',
  '天王星': '♅',
  '海王星': '♆',
  '冥王星': '♇',
  '凯龙星': '⚷',
  '谷神星': '⚳',
  '智神星': '⚴',
  '婚神星': '⚵',
  '灶神星': '⚶',
  '北交点': '☊',
  '南交点': '☋',
  '莉莉丝': '⚸',
  '福点': '⊕',
  '上升': 'ASC',
  '天顶': 'MC'
};
