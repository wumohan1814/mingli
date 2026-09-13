/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 观音灵签（一百签版）
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律：本文件是「观音灵签一百签」这门占法的**唯一权威规则位置**。
 * 调用方（capabilities/、对拍框架、测试、适配层）**只能读不能抄**——凡是要用签号、
 * 签题、签诗、吉凶、宫位、抽取池、种子化抽取口径的地方，一律从这里取；
 * 任何地方出现第二份拷贝即视为缺陷。
 *
 * ① 数据来源 URL 与采录日期口径
 *   - 唯一来源：https://www.zhanbugua.com/archives/1851 （標題「觀音靈簽（一百簽版）」）
 *   - 采录口径：由项目负责人以 web_fetch 一次性采自该 URL，**抓取到的完整页面文本落盘保留**
 *     （本机临时目录下的会话落盘文本 5032462cd36d-web_fetch.txt，共 981 行 / 约 31.4k 字符）。
 *     本文件是**对该落盘文本的逐条转录**，转录过程未二次联网、未参考任何其他版本，
 *     未改写、未翻译、未自创。采录日期以本次会话本机日期口径记：2026-09-14。
 *   - 源文本身为繁简混排（同一签内常见「裏／里」「云／雲」「闲／閑」等混用），
 *     一律逐字保留，不做繁简统一、不做异体字规范化。
 *
 * ② 签号口径
 *   - 签号为传统观音灵签一百签编号 1–100（传统公有领域内容，不署名某家定本）。
 *   - 源文签号用中文数字书写，形态不统一，本文件已换算为阿拉伯数字 1–100：
 *     「第一簽..第十簽」→ 1–10（带「第」字）；
 *     「十一簽..十九簽」→ 11–19；
 *     「二十簽／二一簽..二九簽」→ 20／21–29（源文此处「二一」＝21，非 2、1 两数）；
 *     「三十簽／三一簽..三九簽」→ 30／31–39；……「九九簽」→ 99；「一百簽」→ 100。
 *   - 校验：1..100 每号有且仅有一条，共恰好 100 条；100 条签题互不重复、100 条签诗互不重复。
 *
 * ③ 抽取口径（下列三条为对拍实测反推结论，逐条登记）
 *   - 实测旧实现 draw.poolSize === 92。
 *   - 实测旧实现 selectedNumber === selectedIndex + 1。
 *   - 实测旧实现 resolveSignByNumber(93) 抛错（即 93–100 虽在本表内有签，但不在抽取池可达范围内）。
 *   - 由此定口径：抽取池 ＝ 签号 1–92 升序（见 SSGW_DRAW_POOL_NUMBERS）；
 *     93–100 不在池内，但**签号保持与旧实现同一编号**（第 93 签仍是第 93 签），
 *     以免老记录串号：老记录的 selectedNumber 只可能落在 1–92，本表按原编号解析即完全一致。
 *   - 三模式互斥：seed（给种子）／replay（给池下标）／random（由调用方给随机源），
 *     同时提供会抛错（互斥校验由适配层执行，本文件只登记 modes 清单，不做 IO、不做随机）。
 *
 * ④ 本文件转录时的存疑与取舍（逐条公开，便于后续节复核）
 *   - (a) 第 1–50 签源文用「︻ ︼」（U+FE3B/U+FE3C）括注签题，第 51–100 签源文改用「【 】」
 *         （U+3010/U+3011）；两种写法并存于同一页，本文件只取签题本身，不含括注符号。
 *   - (b) 第 22、23、24、25、26、73、74 共 7 签，源文宫位写作「已宮」。按宫序
 *         （辰→巳→午）与十二宫闭合集合判断，此为「巳／已」形近讹字，本文件取字 **「巳」**。
 *         源文原样为「已」，如需完全字面保真可改回，但「已」不在十二宫集合内。
 *   - (c) 第 36 签签题源文作「湘子遇賓 ( 寶 )」，「( 寶 )」是异文夹注，本文件只取「湘子遇賓」。
 *   - (d) 第 35 签四句之间源文用的是「。」而非「，／；」分隔，按「保留来源写法」逐字保留：
 *         '衣冠重整舊家風。道是無穹卻有功。掃卻當途荊棘刺。三人約議再和同。'
 *   - (e) 100 签的吉凶源文**全部明写**（上簽／中簽／下簽），无一条需要推断，
 *         故本表**没有任何一条带 luckSource 字段**。
 *   - (f) 以下签的源文疑有讹字或与通行本有异，因纪律要求逐字抄录，本文件**原样保留**，
 *         不作「更正」，仅在读书笔记层面登记：第 17 签签题「話梅止渴」（通行多作「望梅止渴」）、
 *         第 45 签「宛如正渴湡瓊漿」、第 48 签「昆鳥秋來化作鵬」「好游快槳喜飛騰」、
 *         第 65 签签题「孫濱困龐涓」（通行为「孫臏」）、第 71 签「誰知倉龍十九衢」、
 *         第 72 签「養峰須用求他蜜」（「峰」疑当作「蜂」）、第 77 签签题「捧壁歸趙」
 *         （通行为「捧璧歸趙」）、第 82 签「依然生棄長根枝」、
 *         第 89 签签题「大看瓊花」（通行多作「大舜看瓊花」，源文疑脱字）、
 *         第 97 签签题「六出祁山」而诗句「當風點燭空疏影，恍惚鋪成楊里花；累被兒竟求牧拾，
 *         怎知只是自浮槎。」疑有讹脱。
 *   - (g) 源文页面尾部紧接第 100 签（一百簽）即为页脚与相关文章列表，未见分页或截断迹象，
 *         故判断 1–100 已完整采到；但若日后发现源页更新，以本文件登录的落盘文本为准。
 *
 * ⑤ 种子化抽取的哈希/PRNG 口径（对拍实测反推；含一处描述纠正的登记）
 *   - prng：mulberry32（标准实现，见 ssgwMulberry32）。
 *   - seedHash：FNV-1a 32 位，对 String(seed) 的每个 **UTF-16 code unit 整体异或一次**后乘质数：
 *         hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0;
 *     **不拆低字节/高字节**（即没有 `& 0xff` / `>>> 8` 的两次乘法）。
 *     纠错登记：本口径最初被描述为「先低字节后高字节各乘一次」，实测该写法在池 92 上给出
 *     种子 0/1/2/123 → 下标 82/32/58/32，与旧实现实测值 45/76/63/14 不符；
 *     改为「整段 code unit 异或」后，四个实测值与 ssgwUniformFromSeed(7) = 0.5916928979568183
 *     全部命中，故最终以「整段 code unit 异或」为准。
 *   - 首值口径：uniform ＝ ssgwMulberry32(ssgwSeedHash(seed))() 的**第一次**返回值；
 *     index ＝ Math.floor(uniform * poolSize)。
 *
 * 纪律：零依赖、零 IO、零网络、零随机数、零「当前时间」、零外部模块引用。纯数据 + 纯函数。
 */

/** 100 签数据：SIGNS（每项 {number, title, poem, luck, palace, luckSource?}） */
const SIGNS = Object.freeze([
  Object.freeze({ number: 1, title: '鐘離成道', poem: '開天辟地作良緣，吉日良時萬物全；若得此簽非小可，人行忠正帝王宣。', luck: '上签', palace: '子' }),
  Object.freeze({ number: 2, title: '蘇秦不第', poem: '鯨魚未變守江河，不可升騰更望高；異日崢嶸身變化，許君一躍跳龍門。', luck: '下签', palace: '子' }),
  Object.freeze({ number: 3, title: '董永遇仙', poem: '臨風冒雨去還鄉，正是其身似燕兒；銜得坭來欲作壘，到頭壘壞復須坭。', luck: '下签', palace: '子' }),
  Object.freeze({ number: 4, title: '玉蓮會十朋', poem: '千年古鏡復重圓，女再求夫男再婚；自此門庭重改換，更添福祿在兒孫。', luck: '上签', palace: '子' }),
  Object.freeze({ number: 5, title: '劉晨遇仙', poem: '一錐草地要求泉，努力求之得最難；無意俄然遇知己，相逢攜手上青天。', luck: '中签', palace: '丑' }),
  Object.freeze({ number: 6, title: '仁貴遇主', poem: '投身巖下銅鳥居，須是還他大丈夫；拾得營謀誰可得，通行天地此人無。', luck: '中签', palace: '丑' }),
  Object.freeze({ number: 7, title: '蘇娘走難', poem: '奔波阻隔重重險，帶水拖坭去度山；更望他鄉求用事，千鄉萬里未回還。', luck: '下签', palace: '丑' }),
  Object.freeze({ number: 8, title: '姚能遇仙', poem: '茂林松柏正興旺，雨雪風霜總莫為；異日忽然成大用，功名成就棟梁材。', luck: '上签', palace: '丑' }),
  Object.freeze({ number: 9, title: '孔明點將', poem: '煩君勿作私心事，此意偏宜說問公；一片明心光皎潔，宛如皎月正天心。', luck: '中签', palace: '寅' }),
  Object.freeze({ number: 10, title: '龐涓觀陣', poem: '石藏無價玉和珍，只管他鄉外客尋；宛如持燈更覓火，不如收拾枉勞心。', luck: '中签', palace: '寅' }),
  Object.freeze({ number: 11, title: '書薦姜維', poem: '欲求勝事可非常，爭奈親姻日暫忙；到頭竟必成鹿箭，貴人指引貴人鄉。', luck: '上签', palace: '寅' }),
  Object.freeze({ number: 12, title: '武吉遇師', poem: '否去泰來咫尺間，暫交君子出於山；若逢虎兔佳音信，立志忙中事即閑。', luck: '上签', palace: '寅' }),
  Object.freeze({ number: 13, title: '羅通拜師', poem: '自小生在富貴家，眼前萬物總奢華；蒙君賜紫金角帶，四海聲名定可夸。', luck: '中签', palace: '寅' }),
  Object.freeze({ number: 14, title: '子牙棄官', poem: '宛如仙鶴出凡籠，脫得凡籠路路通；南北東西無阻隔，任君直上九霄宮。', luck: '中签', palace: '卯' }),
  Object.freeze({ number: 15, title: '蘇秦得志', poem: '行人怨日氣難吞，忽有災事勿近前；鳥破林巢無所宿，可尋深處穩安身。', luck: '中签', palace: '卯' }),
  Object.freeze({ number: 16, title: '葉夢熊朝帝', poem: '愁眉思慮暫時開，啟出云霄喜自來；宛如糞土中藏玉，良工一舉出塵埃。', luck: '中签', palace: '卯' }),
  Object.freeze({ number: 17, title: '話梅止渴', poem: '莫聽閑言說是非，晨昏只好念阿彌；若將狂話為真實，書餅如何止得饑。', luck: '中签', palace: '卯' }),
  Object.freeze({ number: 18, title: '曹國舅為仙', poem: '金烏西墜兔東升，日夜循環至古今；僧道得知無不利，士農工商各從心。', luck: '上签', palace: '卯' }),
  Object.freeze({ number: 19, title: '子儀封王', poem: '急水灘頭放船歸，風波作浪欲何為；若要安然求穩靜，等待浪靜道此危。', luck: '中签', palace: '辰' }),
  Object.freeze({ number: 20, title: '姜太公遇文王', poem: '當春久雨喜開晴，玉兔金烏漸漸明；舊事消散新事遂，看看一跳過龍門。', luck: '中签', palace: '辰' }),
  Object.freeze({ number: 21, title: '李旦龍鳳配合', poem: '陰陽道合總由天，女嫁男婚喜偎然；但見龍蛇相會合，熊熊入夢喜團圓。', luck: '上签', palace: '辰' }),
  Object.freeze({ number: 22, title: '六郎逢救', poem: '旱時田裏皆枯槁，謝天甘雨落淋淋；花果草木皆潤澤，始知一雨值千金。', luck: '中签', palace: '巳' }),
  Object.freeze({ number: 23, title: '懷德招親', poem: '欲扳仙桂入蟾宮，豈慮天門不任君；忽遇一般音信好，人人皆笑嶺頂花。', luck: '中签', palace: '巳' }),
  Object.freeze({ number: 24, title: '殷郊遇師', poem: '不成理論不成家，水性癡人似落花；若問君恩須得力，到頭方見事如麻。', luck: '下签', palace: '巳' }),
  Object.freeze({ number: 25, title: '姚能受職', poem: '過了憂危事幾重，從今再立永無空；寬心自有寬心計，得遇高人立大功。', luck: '中签', palace: '巳' }),
  Object.freeze({ number: 26, title: '鐘馗得道', poem: '上下傳來事轉虛，天邊接得一封書；書中許我功名遂，直到終時亦是虛。', luck: '中签', palace: '巳' }),
  Object.freeze({ number: 27, title: '劉基諫主', poem: '一謀一用一番書，慮後思前不敢為；時到貴人相助力，如山墻立可安居。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 28, title: '李后尋包公', poem: '東邊月上正蟬娟，頃刻云遮亦暗存；或有圓時還有缺，更言非者亦閑言。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 29, title: '趙子龍救阿斗', poem: '寶劍出匣耀光明，在匣全然不惹塵；今得貴人攜出現，有威有勢眾人欽。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 30, title: '棋盤大會', poem: '勸君切莫向他求，似鶴飛來暗箭投；若去采薪蛇在草，恐遭毒口也憂愁。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 31, title: '佛印會東坡', poem: '清閑無憂靜處坐，飽後吃茶時坐臥；汝下身心不用忙，必定不招冤與禍。', luck: '中签', palace: '未' }),
  Object.freeze({ number: 32, title: '劉備求賢', poem: '前程杳杳定無疑，石中藏玉有誰知；一朝良匠分明剖，始覺安然碧玉期。', luck: '中签', palace: '未' }),
  Object.freeze({ number: 33, title: '咬金聘仁貴', poem: '內藏無價寶和珍，得玉何須外界尋；不如等待高人識，寬心猶且更寬心。', luck: '中签', palace: '未' }),
  Object.freeze({ number: 34, title: '桃園結義', poem: '行藏出入禮義恭，言必忠良信必聰；心不了然且靜撤，光明紅日正當中。', luck: '中签', palace: '未' }),
  Object.freeze({ number: 35, title: '唐僧取經', poem: '衣冠重整舊家風。道是無穹卻有功。掃卻當途荊棘刺。三人約議再和同。', luck: '中签', palace: '申' }),
  Object.freeze({ number: 36, title: '湘子遇賓', poem: '眼前病訟不須憂，實地資財盡可求；恰似猿猴金鎖脫，自歸山洞去來游。', luck: '中签', palace: '申' }),
  Object.freeze({ number: 37, title: '李靖歸山', poem: '欲待身安運泰時，風中燈燭不相宜；不如收拾深堂坐，庶免光瑤靜處明。', luck: '中签', palace: '申' }),
  Object.freeze({ number: 38, title: '何文秀遇難', poem: '月照天書靜處期，忽遭云霧又昏迷；寬心祈待云霞散，此時更改好施為。', luck: '下签', palace: '申' }),
  Object.freeze({ number: 39, title: '姜女尋夫', poem: '天邊消息實難思，切莫多心望強求；若把石頭磨作鏡，曾知枉費己工夫。', luck: '下签', palace: '酉' }),
  Object.freeze({ number: 40, title: '武則天登位', poem: '紅輪西墜兔東升，陰長陽消百事亭；是若女人宜望用，增添財祿福其心。', luck: '中签', palace: '酉' }),
  Object.freeze({ number: 41, title: '董卓收呂布', poem: '無限好言君記取，卻為認賊將作子；莫貪眼下有些甜，更慮他年前樣看。', luck: '中签', palace: '酉' }),
  Object.freeze({ number: 42, title: '目蓮救母', poem: '君皇圣后總為恩，復待祈禳無損增；一切有情皆受用，人間天上得期亨。', luck: '上签', palace: '酉' }),
  Object.freeze({ number: 43, title: '行者得道', poem: '天地變通萬物全，自榮自養自安然；生羅萬象皆精彩，事事如心謝圣賢。', luck: '上签', palace: '戌' }),
  Object.freeze({ number: 44, title: '姜維鄧艾斗陣', poem: '棋逢敵手著相宜，黑白盤中未決時；皆因一著知勝敗，須教自有好推宜。', luck: '中签', palace: '戌' }),
  Object.freeze({ number: 45, title: '仁宗遇仙', poem: '溫柔自古勝剛強，積善之門大吉昌；若是有人占此卦，宛如正渴湡瓊漿。', luck: '上签', palace: '戌' }),
  Object.freeze({ number: 46, title: '渭水釣魚', poem: '勸君耐守舊生涯，把定心腸勿起歹；直待有人輕著力，枯枝老樹再生花。', luck: '中签', palace: '戌' }),
  Object.freeze({ number: 47, title: '梁灝登科', poem: '錦上添花色愈鮮，運來祿馬喜雙全；時人莫恨功名晚，一舉登科四海傳。', luck: '上签', palace: '亥' }),
  Object.freeze({ number: 48, title: '韓信掛帥', poem: '昆鳥秋來化作鵬，好游快槳喜飛騰；翱翔萬里云霄去，馀外諸禽總不能。', luck: '中签', palace: '亥' }),
  Object.freeze({ number: 49, title: '王祥求鯉', poem: '天寒地凍水成冰，何須貧吝取功名；只好守己靜處坐，待時興變自然明。', luck: '中签', palace: '亥' }),
  Object.freeze({ number: 50, title: '陶朱歸五湖', poem: '五湖四海任君行，高掛帆蓬自在撐；若得順風隨即至，滿船寶貝喜層層。', luck: '中签', palace: '亥' }),
  Object.freeze({ number: 51, title: '孔明入川', poem: '夏日炎天日最長，人人愁熱悶非常；天地也解知人意，薰風拂拂自然涼。', luck: '上签', palace: '子' }),
  Object.freeze({ number: 52, title: '太白醉撈明月', poem: '水中捉月費功夫，費盡功夫卻又無；莫說閑言并亂語，枉勞心力強身孤。', luck: '中签', palace: '子' }),
  Object.freeze({ number: 53, title: '劉備招親', poem: '失意番成得意時，龍呤虎嘯兩相宜；青天自有通霄路，許我功名再有期。', luck: '中签', palace: '子' }),
  Object.freeze({ number: 54, title: '馬超追曹', poem: '夢中得寶醒來無，自謂南山只是鋤；若問婚姻并問病，別尋條路為相扶。', luck: '下签', palace: '子' }),
  Object.freeze({ number: 55, title: '周武王登位', poem: '父賢傳子子傳孫，衣食豐隆只靠天；堂上椿萱人快樂，饑飯渴飲因時眠。', luck: '中签', palace: '丑' }),
  Object.freeze({ number: 56, title: '祿山謀反', poem: '灘小石溪流水響，風清明月貴人忙；路須借問何方去，管取林中花草香。', luck: '中签', palace: '丑' }),
  Object.freeze({ number: 57, title: '董仲尋親', poem: '說是說非風過耳，好衣好祿自然豐；君莫記取當年事，汝意還如我意同。', luck: '中签', palace: '丑' }),
  Object.freeze({ number: 58, title: '文王問卜', poem: '直言說話君須記，莫在他鄉求別藝；切須守己舊生涯，除是其馀都不利。', luck: '中签', palace: '丑' }),
  Object.freeze({ number: 59, title: '張良隱山', poem: '直上重樓去藏身，四圍荊棘遶為林；天高君命長和短，得一番成失二人。', luck: '中签', palace: '寅' }),
  Object.freeze({ number: 60, title: '赤壁鏖兵', poem: '抱薪救火大皆燃，燒遍三千亦復然；若問榮華并出入，不如收拾枉勞心。', luck: '下签', palace: '寅' }),
  Object.freeze({ number: 61, title: '蘇小妹難夫', poem: '日上吟詩月下歌，逢場作戲笑呵呵；相逢會過難藏避，喝彩齊唱連哩羅。', luck: '中签', palace: '寅' }),
  Object.freeze({ number: 62, title: '唐僧得道', poem: '晨昏全賴佛扶持，須是逢危卻不危；若得貴人相引處，那時財帛亦相隋。', luck: '中签', palace: '寅' }),
  Object.freeze({ number: 63, title: '女媧氏煉石', poem: '昔日行船失了針，今朝依舊海中尋；若然尋得原針在，也費工夫也費心。', luck: '中签', palace: '卯' }),
  Object.freeze({ number: 64, title: '馬前覆水', poem: '游魚卻在碧波池，撞遭羅網四邊圍；思量無計番身出，事到頭來惹是非。', luck: '下签', palace: '卯' }),
  Object.freeze({ number: 65, title: '孫濱困龐涓', poem: '眼前歡喜未為歡，亦不危時亦不安；割肉成瘡為甚事，不如守舊待時光。', luck: '下签', palace: '卯' }),
  Object.freeze({ number: 66, title: '霸王被困', poem: '路險馬羸人行急，失群軍卒困相當；灘高風浪船掉破，日暮花殘天降霜。', luck: '下签', palace: '卯' }),
  Object.freeze({ number: 67, title: '金星試竇兒', poem: '一條金線秤君心，無減無增無重輕；為人平生心正直，文章全具藝光明。', luck: '上签', palace: '卯' }),
  Object.freeze({ number: 68, title: '郭汾陽祝壽', poem: '門延吉慶喜非常，積善之門大吉昌；婚姻田蠶諸事遂，病逢妙藥即安康。', luck: '中签', palace: '卯' }),
  Object.freeze({ number: 69, title: '梅開二度', poem: '冬來嶺上一枝梅，葉落枝枯總不催；但得陽春悄急至，依然還我作花魁。', luck: '中签', palace: '辰' }),
  Object.freeze({ number: 70, title: '李密反唐', poem: '朝朝恰似采花蜂，飛出西南又走東；春盡花殘無覓處，此心不變舊行蹤。', luck: '下签', palace: '辰' }),
  Object.freeze({ number: 71, title: '文君訪相如', poem: '誰知倉龍十九衢，女子當年嫁二夫；自是一弓架兩箭，切恐龍馬上安居。', luck: '中签', palace: '辰' }),
  Object.freeze({ number: 72, title: '王莽求賢', poem: '養峰須用求他蜜，只怕遭觸尾上釘；須是眼前有異路，暗裏染如荊棘林。', luck: '中签', palace: '辰' }),
  Object.freeze({ number: 73, title: '陳橋兵變', poem: '春來雷震百蟲鳴，番身一轉離泥中；始知出入還來往，一朝變化便成龍。', luck: '上签', palace: '巳' }),
  Object.freeze({ number: 74, title: '秦敗擒三帥', poem: '似鵠飛來自入籠，欲得番身卻不通；南北東西都難出，此卦誠恐恨無窮。', luck: '下签', palace: '巳' }),
  Object.freeze({ number: 75, title: '伍員夜出昭關', poem: '恰如抱虎過高山，戰戰競競膽碎寒；不覺忽然從好事，切須保守一身安。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 76, title: '洪武看牛', poem: '魚龍混雜意相同，耐守深潭待運通；不覺一朝頭聳出，禹門一跳過龍宮。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 77, title: '捧壁歸趙', poem: '夢中說得是多財，聲名云外總虛來；水遠山遙難信實，貴人點指笑顏開。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 78, title: '臨潼救駕', poem: '冷水未燒白涕湯，不寒不熱有溫涼；要行天下無他事，為有身中百藝強。', luck: '上签', palace: '午' }),
  Object.freeze({ number: 79, title: '暗扶倒銅旗', poem: '虛空結愿保平安，保得身安愿不還；莫忘神圣宜還了，豈知神語莫輕慢。', luck: '中签', palace: '午' }),
  Object.freeze({ number: 80, title: '智遠投軍', poem: '直上仙巖要學仙，豈知一旦帝王宣；青天日月常明照，心正聲名四海傳。', luck: '上签', palace: '未' }),
  Object.freeze({ number: 81, title: '風送滕王閣', poem: '梧桐葉落秋將暮，行客歸程去似云；謝得天公高著力，順風船載寶珍歸。', luck: '上签', palace: '未' }),
  Object.freeze({ number: 82, title: '火燒葫蘆谷', poem: '炎炎烈火焰連天，焰裏還生一朵蓮；到底得成終不害，依然生棄長根枝。', luck: '中签', palace: '未' }),
  Object.freeze({ number: 83, title: '李淵登位', poem: '譬若初三四五缺，半無半有未圓全；等待十五良宵夜，到處光明到處圓。', luck: '中签', palace: '未' }),
  Object.freeze({ number: 84, title: '莊子試妻', poem: '因名喪德如何事，切恐吉中變化兇；酒醉不知何處去，青松影裏夢朦朧。', luck: '下签', palace: '未' }),
  Object.freeze({ number: 85, title: '韓文公遇雪', poem: '云開霧罩山前路，萬物圓中月再圓；若得詩書沉夢醒，貴人指引步天臺。', luck: '中签', palace: '申' }),
  Object.freeze({ number: 86, title: '商輅中三元', poem: '春來花發映陽臺，萬里車來進寶財；若得禹門三級浪，恰如平地一聲雷。', luck: '上签', palace: '申' }),
  Object.freeze({ number: 87, title: '咬金探地穴', poem: '人行半嶺日銜山，峻嶺崖巖未可安；仰望上天為護佑，此身猶在太平間。', luck: '中签', palace: '申' }),
  Object.freeze({ number: 88, title: '龐洪畏包公', poem: '木為一虎在富門，須是有威不害人；分明說是無防事，憂惱遲疑恐懼心。', luck: '中签', palace: '酉' }),
  Object.freeze({ number: 89, title: '大看瓊花', poem: '出入營謀大吉昌，似玉無瑕石裏藏；若得貴人來指引，斯時得寶喜風光。', luck: '上签', palace: '酉' }),
  Object.freeze({ number: 90, title: '葦佩遇仙', poem: '忽言一信向天飛，泰山寶貝滿船歸；若問路途成好事，前頭仍有貴人推。', luck: '上签', palace: '酉' }),
  Object.freeze({ number: 91, title: '三英戰呂布', poem: '好展愁眉出眾來，前途改變喜多財；一條大路如天闊，凡有施財盡暢懷。', luck: '中签', palace: '酉' }),
  Object.freeze({ number: 92, title: '蔡卿報恩', poem: '自幼為商任設謀，財祿盈豐不用求；若是只身謀望事，秀才出去狀元回。', luck: '上签', palace: '酉' }),
  Object.freeze({ number: 93, title: '高君保招親', poem: '鸞鳳翔毛雨淋漓，當時卻被雀兒欺；終教一日云開達，依舊還君整羽衣。', luck: '中签', palace: '戌' }),
  Object.freeze({ number: 94, title: '伯牙訪友', poem: '君子莫體小人為，事若差池各是非；琴鳴須用知音聽，守常安靜得依稀。', luck: '下签', palace: '戌' }),
  Object.freeze({ number: 95, title: '曹丕稱帝', poem: '志氣功業在朝朝，今將酒色不勝饒；若見金雞報君語，錢財福祿與君招。', luck: '中签', palace: '戌' }),
  Object.freeze({ number: 96, title: '竇燕山積善', poem: '巍巍寶塔不尋常，八面玲瓏盡放光；勸君立志勤頂禮，作善蒼天降福祥。', luck: '上签', palace: '戌' }),
  Object.freeze({ number: 97, title: '六出祁山', poem: '當風點燭空疏影，恍惚鋪成楊里花；累被兒竟求牧拾，怎知只是自浮槎。', luck: '中签', palace: '亥' }),
  Object.freeze({ number: 98, title: '吉平遇難', poem: '出入求謀事宜遲，只恐閑愁惹是非；如鳥飛入羅網裏，相逢能有幾多時。', luck: '下签', palace: '亥' }),
  Object.freeze({ number: 99, title: '陶三春掛帥', poem: '勒馬持鞭直過來，半有憂危半有災；恰似遭火焚燒屋，天降時雨蕩成灰。', luck: '下签', palace: '亥' }),
  Object.freeze({ number: 100, title: '三教談道', poem: '佛神靈變與君知，癡人說事轉昏迷；老人求得靈簽去，不知守舊待時來。', luck: '下签', palace: '亥' }),
]);

/** 签数常量：与 SIGNS.length 对拍一致（本文件是唯一权威源）。 */
export const SSGW_SIGNS = SIGNS;

/** 签总数：100。 */
export const SSGW_SIGN_COUNT = 100;

/**
 * 抽取池签号（升序）。
 * ---------------------------------------------------------------------------
 * 口径来源：对拍实测旧实现 `draw.poolSize === 92`、`selectedNumber === selectedIndex + 1`、
 * `resolveSignByNumber(93)` 抛错。故抽取池 ＝ 签号 1–92 升序；
 * 93–100 不在池内，但**签号保持与旧实现同一编号**（本表内第 93 签仍是第 93 签），
 * 老记录不串号：老记录的 selectedNumber 必落在 1–92，按原编号解析完全一致。
 */
export const SSGW_DRAW_POOL_NUMBERS = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
  91, 92,
]);

/**
 * 观音灵签规则总表（只读）。
 * ---------------------------------------------------------------------------
 * - modes：三模式互斥（同时提供会抛错，互斥校验在适配层做）：
 *     · 'seed'   给种子 → index ＝ ssgwIndexFromSeed(seed, 92)，可复现
 *     · 'replay' 给池下标（老记录的 selectedIndex）→ ssgwSignInPool(index)
 *     · 'random' 由调用方注入随机源，本文件不产生随机
 * - seedHash 说明字段中登记了一处与初始描述的纠正：正确实现为「每 UTF-16 码元异或一次」，
 *   而非「先低字节后高字节各乘一次」；前者才复现旧实现实测值 45/76/63/14。
 */
export const SSGW_RULES = Object.freeze({
  dataSource: 'https://www.zhanbugua.com/archives/1851',
  prng: 'mulberry32',
  seedHash: 'FNV-1a 32bit over String(seed) UTF-16 code units（整段 code unit 异或，不拆字节）',
  seedNormalize: 'String(seed)',
  indexFormula: 'Math.floor(uniform * poolSize)',
  poolSize: 92,
  poolNumbers: SSGW_DRAW_POOL_NUMBERS,
  modes: Object.freeze(['seed', 'replay', 'random']),
});

/** 标准 mulberry32：返回值是「取下次均匀分布随机数」的函数（纯函数，无状态外泄）。 */
export function ssgwMulberry32(seedInt) {
  let a = seedInt | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a 32 位哈希（零依赖自实现，不引用任何外部模块）。
 * 对 String(seed) 的每个 UTF-16 code unit 整体异或一次后乘质数 0x01000193；
 * 不拆低字节/高字节（拆分版实测不命中旧实现值 45/76/63/14）。
 */
export function ssgwSeedHash(seed) {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 由种子取首个均匀分布随机数（区间 [0, 1)，首值口径）。 */
export function ssgwUniformFromSeed(seed) {
  return ssgwMulberry32(ssgwSeedHash(seed))();
}

/** 由种子取池下标（0 基）：Math.floor(uniform * poolSize)。 */
export function ssgwIndexFromSeed(seed, poolSize) {
  return Math.floor(ssgwUniformFromSeed(seed) * poolSize);
}

/** 签号 1–100 → 对应签对象；非 1–100 的整数抛 RangeError。 */
export function ssgwSignByNumber(number) {
  if (!Number.isInteger(number) || number < 1 || number > SSGW_SIGN_COUNT) {
    throw new RangeError('签号需为1至100的整数');
  }
  return SIGNS[number - 1];
}

/** 池下标 0–91 → 对应签对象（内部经 SSGW_DRAW_POOL_NUMBERS 再按签号解析）。 */
export function ssgwSignInPool(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SSGW_DRAW_POOL_NUMBERS.length) {
    throw new RangeError('池下标需为0至91的整数');
  }
  return ssgwSignByNumber(SSGW_DRAW_POOL_NUMBERS[index]);
}

export default SSGW_SIGNS;
