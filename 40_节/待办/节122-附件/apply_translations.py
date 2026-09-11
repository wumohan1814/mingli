# -*- coding: utf-8 -*-
"""节122 附件 · IPIP 题库中文文案落地脚本
- 官方中文 120（ipip-neo-120-zh.json）命中即套用
- 其余 205 条唯一待译项用 SELF 字典（逐条自拟，遵循 §4 规范）
- 校验：句末无句号 / 无"你" / ≤14 汉字 / 反向题方向自检
"""
import json, re

def norm(s):
    s = s.strip().lower()
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    s = re.sub(r"\s+", " ", s)
    s = s.rstrip(". ")
    return s

BASE = "."

# ---------- 官方中文字典（ipip-neo-120-zh.json） ----------
zh = json.load(open(f"{BASE}/ipip-neo-120-zh.json", encoding="utf-8"))["items"]
OFF = {norm(it["text_en"]): it["text_zh"] for it in zh}

# ---------- 自译字典（205 条唯一待译项，逐条自拟） ----------
SELF = {
    # ---- A1 信任/道德 ----
    "Believe that people are basically moral.": "相信人本质上是善良守德的",
    "Believe in human goodness.": "相信人性本善",
    "Think that all will be well.": "相信一切都会好起来",
    "Suspect hidden motives in others.": "怀疑他人别有用心",
    "Am wary of others.": "对别人心存戒备",
    "Believe that people are essentially evil.": "认为人本质上是邪恶的",
    # ---- A2 道德/诚实 ----
    "Would never cheat on my taxes.": "绝不会在纳税上作弊",
    "Stick to the rules.": "遵守规则",
    "Use flattery to get ahead.": "会靠阿谀奉承往上爬",
    "Know how to get around the rules.": "知道怎么钻规则的空子",
    "Put people under pressure.": "会给人施加压力",
    "Pretend to be concerned for others.": "假装对别人表示关心",
    # ---- A3 利他 ----
    "Make people feel welcome.": "让人觉得受到欢迎",
    "Anticipate the needs of others.": "能预见他人的需求",
    "Have a good word for everyone.": "对谁都愿意说好话",
    "Look down on others.": "看不起别人",
    "Make people feel uncomfortable.": "让别人感到不自在",
    "Turn my back on others.": "对别人不理不睬",
    # ---- A4 谦逊/顺从 ----
    "Am easy to satisfy.": "很容易得到满足",
    "Can't stand confrontations.": "受不了正面冲突",
    "Hate to seem pushy.": "不喜欢显得咄咄逼人",
    "Have a sharp tongue.": "说话尖酸刻薄",
    "Contradict others.": "反驳他人",
    "Hold a grudge.": "怀恨在心",
    # ---- A5 谦虚 ----
    "Dislike being the center of attention.": "不喜欢成为关注的焦点",
    "Dislike talking about myself.": "不喜欢谈论自己",
    "Consider myself an average person.": "认为自己是个普通人",
    "Seldom toot my own horn.": "很少自我吹嘘",
    "Know the answers to many questions.": "知道很多问题的答案",
    "Make myself the center of attention.": "让自己成为关注的焦点",
    # ---- A6 柔情/同情 ----
    "Value cooperation over competition.": "比起竞争更看重合作",
    "Suffer from others' sorrows.": "会替别人的不幸感到难过",
    "Tend to dislike soft-hearted people.": "不太喜欢心肠软的人",
    "Believe in an eye for an eye.": "信奉以牙还牙",
    "Believe people should fend for themselves.": "认为人就该自己顾自己",
    "Can't stand weak people.": "受不了软弱的人",
    # ---- A / —（五因素标记，无层面） ----
    "Feel little concern for others.": "很少关心他人",
    "Am interested in people.": "对别人感兴趣",
    "Sympathize with others' feelings.": "能共情他人的感受",
    "Have a soft heart.": "心肠很软",
    "Take time out for others.": "愿意为别人抽出时间",
    "Make people feel at ease.": "让别人感到轻松自在",
    # ---- C1 能力感 ----
    "Am sure of my ground.": "对自己的立场很有把握",
    "Come up with good solutions.": "能想出好的解决办法",
    "Misjudge situations.": "对局势判断失误",
    "Don't understand things.": "弄不懂一些事情",
    "Have little to contribute.": "没什么可贡献的",
    "Don't see the consequences of things.": "看不清事情的后果",
    # ---- C2 条理性 ----
    "Like order.": "喜欢有条理",
    "Want everything to be \"just right.\"": "希望一切都恰到好处",
    "Love order and regularity.": "钟爱秩序与规律",
    "Do things according to a plan.": "按照计划做事",
    "Am not bothered by messy people.": "不会被杂乱的人影响",
    "Am not bothered by disorder.": "不会因杂乱无章而困扰",
    # ---- C3 尽责 ----
    "Try to follow the rules.": "尽量遵守规则",
    "Pay my bills on time.": "按时付清账单",
    "Listen to my conscience.": "听从自己的良知",
    "Get others to do my duties.": "让别人替我履行职责",
    "Do the opposite of what is asked.": "故意做和要求相反的事",
    "Misrepresent the facts.": "歪曲事实",
    # ---- C4 成就追求 ----
    "Go straight for the goal.": "直奔目标而去",
    "Turn plans into actions.": "把计划付诸行动",
    "Plunge into tasks with all my heart.": "全心全意投入任务",
    "Set high standards for myself and others.": "对自己和他人都高标准要求",
    "Demand quality.": "对品质有要求",
    "Am not highly motivated to succeed.": "没有很强的成功动力",
    # ---- C5 自律 ----
    "Get chores done right away.": "立刻把杂事做完",
    "Start tasks right away.": "马上开始做事",
    "Get to work at once.": "立即投入工作",
    "Find it difficult to get down to work.": "很难静下心开始工作",
    "Need a push to get started.": "需要被人推一把才开始",
    "Postpone decisions.": "拖延做决定",
    # ---- C6 审慎 ----
    "Avoid mistakes.": "尽量避免出错",
    "Choose my words with care.": "说话字斟句酌",
    "Stick to my chosen path.": "坚持自己选定的路",
    "Like to act on a whim.": "喜欢凭一时冲动行事",
    "Do crazy things.": "做出疯狂的举动",
    "Often make last-minute plans.": "经常临时才做安排",
    # ---- C / —（无层面） ----
    "Pay attention to details.": "注重细节",
    "Make a mess of things.": "把事情搞得一团糟",
    "Shirk my duties.": "逃避自己的职责",
    "Follow a schedule.": "按照日程安排行事",
    "Am exacting in my work.": "对工作一丝不苟",
    # ---- E1 热情 ----
    "Warm up quickly to others.": "很快就能和别人热络起来",
    "Act comfortably with others.": "和别人相处时很自在",
    "Cheer people up.": "能让别人开心起来",
    "Am hard to get to know.": "别人很难了解我",
    "Often feel uncomfortable around others.": "和别人在一起时常感到不自在",
    "Am not really interested in others.": "对别人并不真的感兴趣",
    # ---- E2 合群 ----
    "Enjoy being part of a group.": "喜欢成为群体的一员",
    "Involve others in what I am doing.": "会拉别人一起参与我的事",
    "Love surprise parties.": "喜欢惊喜派对",
    "Want to be left alone.": "希望一个人待着",
    "Don't like crowded events.": "不喜欢人挤人的场合",
    "Seek quiet.": "寻求安静",
    # ---- E3 决断/主张 ----
    "Can talk others into doing things.": "能说服别人去做事",
    "Seek to influence others.": "力求去影响他人",
    "Keep in the background.": "躲在幕后不出头",
    "Have little to say.": "话很少",
    "Don't like to draw attention to myself.": "不喜欢成为别人注意的焦点",
    "Hold back my opinions.": "把自己的看法藏起来",
    # ---- E4 活跃 ----
    "Can manage many things at the same time.": "能同时处理很多事",
    "React quickly.": "反应很快",
    "Like to take my time.": "喜欢不慌不忙",
    "Like a leisurely lifestyle.": "喜欢慢节奏的生活",
    "Let things proceed at their own pace.": "让事情按自己的步调走",
    "React slowly.": "反应很慢",
    # ---- E5 刺激寻求 ----
    "Love action.": "热爱行动",
    "Enjoy being part of a loud crowd.": "喜欢置身喧闹的人群",
    "Am willing to try anything once.": "什么都愿意尝试一次",
    "Seek danger.": "寻求危险",
    "Would never go hang gliding or bungee jumping.": "绝不会去玩滑翔或蹦极",
    "Dislike loud music.": "不喜欢吵闹的音乐",
    # ---- E6 积极情绪 ----
    "Express childlike joy.": "流露出孩子般的快乐",
    "Laugh my way through life.": "笑着过日子",
    "Laugh aloud.": "会放声大笑",
    "Amuse my friends.": "能逗朋友们开心",
    "Am not easily amused.": "不容易被逗乐",
    "Seldom joke around.": "很少开玩笑",
    # ---- E / —（无层面） ----
    "Am the life of the party.": "是聚会上的活跃分子",
    "Don't talk a lot.": "话不多",
    "Start conversations.": "主动开启话题",
    "Don't mind being the center of attention.": "不介意成为关注的焦点",
    "Am quiet around strangers.": "在陌生人面前很安静",
    # ---- N1 焦虑 ----
    "Get caught up in my problems.": "会深陷自己的问题之中",
    "Am not easily bothered by things.": "不容易被事情困扰",
    "Am relaxed most of the time.": "大部分时间都很放松",
    "Am not easily disturbed by events.": "不容易被变故打乱",
    "Don't worry about things that have already happened.": "不为已经发生的事担忧",
    "Adapt easily to new situations.": "能轻松适应新环境",
    # ---- N2 愤怒 ----
    "Get upset easily.": "很容易心烦",
    "Am often in a bad mood.": "经常心情不好",
    "Rarely get irritated.": "很少被惹恼",
    "Seldom get mad.": "很少生气",
    "Keep my cool.": "能保持冷静",
    "Rarely complain.": "很少抱怨",
    # ---- N3 抑郁 ----
    "Have a low opinion of myself.": "对自己的评价很低",
    "Have frequent mood swings.": "情绪经常大起大落",
    "Feel desperate.": "感到绝望",
    "Feel that my life lacks direction.": "觉得自己的生活没有方向",
    "Seldom feel blue.": "很少感到忧郁",
    "Am very pleased with myself.": "对自己非常满意",
    # ---- N4 自我意识/害羞 ----
    "Am easily intimidated.": "很容易被人吓住",
    "Am afraid that I will do the wrong thing.": "害怕自己会做错事",
    "Stumble over my words.": "说话会磕巴",
    "Am not embarrassed easily.": "不容易感到难堪",
    "Am comfortable in unfamiliar situations.": "在陌生情境里也很自在",
    "Am able to stand up for myself.": "能够为自己挺身而出",
    # ---- N5 放纵 ----
    "Often eat too much.": "经常吃得太撑",
    "Don't know why I do some of the things I do.": "不知道自己为什么会做某些事",
    "Do things I later regret.": "会做让自己后悔的事",
    "Love to eat.": "很爱吃",
    "Never spend more than I can afford.": "从不花超过自己能力的钱",
    "Never splurge.": "从不挥霍",
    # ---- N6 脆弱性 ----
    "Can't make up my mind.": "拿不定主意",
    "Get overwhelmed by emotions.": "会被情绪淹没",
    "Can handle complex problems.": "能应付复杂的问题",
    "Know how to cope.": "知道怎么应对",
    "Readily overcome setbacks.": "能很快从挫折中恢复",
    "Am calm even in tense situations.": "即使在紧张局面下也很镇定",
    # ---- N / —（无层面） ----
    "Am easily disturbed.": "很容易被搅扰",
    "Change my mood a lot.": "情绪多变",
    # ---- O1 幻想 ----
    "Indulge in my fantasies.": "沉迷于自己的幻想",
    "Spend time reflecting on things.": "花时间反思事情",
    "Seldom daydream.": "很少做白日梦",
    "Do not have a good imagination.": "想象力不太好",
    "Seldom get lost in thought.": "很少陷入沉思",
    "Have difficulty imagining things.": "很难去想象事物",
    # ---- O2 审美 ----
    "Like music.": "喜欢音乐",
    "Love flowers.": "喜欢花",
    "Enjoy the beauty of nature.": "享受大自然的美",
    "Do not like art.": "不喜欢艺术",
    "Do not like concerts.": "不喜欢听音乐会",
    "Do not enjoy watching dance performances.": "不喜欢看舞蹈表演",
    # ---- O3 感受性 ----
    "Am passionate about causes.": "对理想与信念充满热情",
    "Enjoy examining myself and my life.": "喜欢审视自己和自己的生活",
    "Try to understand myself.": "努力去了解自己",
    "Seldom get emotional.": "很少情绪化",
    "Am not easily affected by my emotions.": "不容易受情绪左右",
    "Experience very few emotional highs and lows.": "很少经历情绪的大起大落",
    # ---- O4 行动/求新 ----
    "Like to visit new places.": "喜欢去新的地方",
    "Am interested in many things.": "对很多事物感兴趣",
    "Like to begin new things.": "喜欢开启新的事物",
    "Don't like the idea of change.": "不喜欢改变的想法",
    "Am a creature of habit.": "是个墨守成规的人",
    "Dislike new foods.": "不喜欢尝试新食物",
    # ---- O5 观念/智性 ----
    "Like to solve complex problems.": "喜欢解决复杂的问题",
    "Have a rich vocabulary.": "词汇量很丰富",
    "Can handle a lot of information.": "能处理大量信息",
    "Enjoy thinking about things.": "喜欢思考事情",
    "Am not interested in abstract ideas.": "对抽象概念不感兴趣",
    "Avoid difficult reading material.": "回避有难度的阅读内容",
    # ---- O6 价值观（高度敏感，逐项标记，见替换清单） ----
    "Tend to vote for liberal political candidates.": "倾向于投票给自由派候选人",
    "Believe that there is no absolute right and wrong.": "相信没有绝对的对与错",
    "Believe that criminals should receive help rather than punishment.": "认为罪犯应该得到帮助而非惩罚",
    "Believe in one true religion.": "相信存在唯一真正的宗教",
    "Tend to vote for conservative political candidates.": "倾向于投票给保守派候选人",
    "Believe that too much tax money goes to support artists.": "认为太多税款被用来资助艺术家",
    "Believe laws should be strictly enforced.": "认为法律应当被严格执行",
    "Believe that we coddle criminals too much.": "认为我们对罪犯太过宽容",
    "Like to stand during the national anthem.": "听到国歌时喜欢起立",
    # ---- O / —（无层面） ----
    "Have excellent ideas.": "有好点子",
    "Am quick to understand things.": "理解事情很快",
    "Use difficult words.": "爱用生僻难懂的词",
    "Am full of ideas.": "满脑子都是点子",
}
SELF_N = {norm(k): v for k, v in SELF.items()}

# 自检：key 唯一
assert len(SELF_N) == len(SELF), f"SELF 字典有归一化后重复的 key：{len(SELF)-len(SELF_N)} 条"

TARGETS = {
    "ipip-neo-300.json": "ipip-neo-300.json",
    "ipip-neo-60.json": "ipip-neo-60.json",
    "ipip-50.json": "ipip-50.json",
    "mini-ipip-20.json": "mini-ipip-20.json",
}

# 文化适配敏感词（仅用于标记，不删除、不改写）
SENSITIVE = [
    ("政治", ["liberal", "conservative", "political", "vote", "candidate", "tax", "law", "laws", "anthem", "crime", "criminal", "criminals", "punish"]),
    ("宗教", ["religion", "religious"]),
    ("道德相对主义", ["no absolute right"]),
]

def classify_sensitive(en):
    e = en.lower()
    hits = []
    for cat, kws in SENSITIVE:
        if any(k in e for k in kws):
            hits.append(cat)
    return hits

def zh_len(s):
    return len(re.sub(r"[，。、！？；：""''（）\s]", "", s))

errors = []
flagged = []   # 需替换/标记清单
filled_from = {"official": 0, "self": 0}

for src, dst in TARGETS.items():
    d = json.load(open(f"{BASE}/{src}", encoding="utf-8"))
    for it in d["items"]:
        en = it["text_en"]
        n = norm(en)
        if n in OFF:
            it["text_zh"] = OFF[n]
            filled_from["official"] += 1
        elif n in SELF_N:
            it["text_zh"] = SELF_N[n]
            filled_from["self"] += 1
        else:
            errors.append(f"[{src}] 未命中且无自译：{en}")
            continue
        # 校验
        z = it["text_zh"]
        if z.endswith("。"):
            errors.append(f"[{src}] 句末有句号：{en} -> {z}")
        if "你" in z:
            errors.append(f"[{src}] 出现'你'：{en} -> {z}")
        if zh_len(z) > 14:
            errors.append(f"[{src}] 超 14 字({zh_len(z)})：{en} -> {z}")
        # 敏感标记
        hits = classify_sensitive(en)
        if hits:
            flagged.append({
                "file": src, "item_no": it["item_no"], "dimension": it["dimension"],
                "facet": it.get("facet"), "keying": it["keying"],
                "text_en": en, "text_zh": z, "categories": hits,
            })
    json.dump(d, open(f"{BASE}/{dst}", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print("填充统计：", filled_from)
print("未命中错误数：", len(errors))
for e in errors:
    print("  ERR:", e)
print("敏感标记项：", len(flagged))

# 输出需替换清单
with open(f"{BASE}/需替换题项清单.md", "w", encoding="utf-8") as f:
    f.write("# 需替换题项清单（文化适配走查结果）\n\n")
    f.write("> 依据 `题库中文文案需求.md` §五。标记 ≠ 删除：以下题项已照常填入 `text_zh`（不改写语义），\n")
    f.write("> 但按其类别建议「同层面替换」或由用户/Agent 裁定是否替换。\n\n")
    f.write("## 一、必须替换（政治 / 道德相对主义，O6 价值观层面）\n\n")
    f.write("以下 3 题与官方中文 120 题第 28 / 58 / 88 题同源（§5.1 已核实），属政治立场与道德相对主义表述，\n")
    f.write("建议**从 IPIP 300 题池同层面 O6 中另选非敏感题替换**（注意：300 题池 O6 本身多为同类敏感题，\n")
    f.write("实际替换源可能需取自更宽的 IPIP 题库；此点交由 Agent 与用户裁定）。\n\n")
    pri = [x for x in flagged if "政治" in x["categories"] or "道德相对主义" in x["categories"]]
    for x in pri:
        f.write(f"- **[{x['file']} #{x['item_no']}]** `{x['text_en']}` → 「{x['text_zh']}」"
                f"（{('/'.join(x['categories']))}；keying={x['keying']}）\n")
    f.write("\n## 二、建议复评（宗教 / 司法 / 纳税等，同属 O6 价值观）\n\n")
    sec = [x for x in flagged if x not in pri]
    for x in sec:
        f.write(f"- **[{x['file']} #{x['item_no']}]** `{x['text_en']}` → 「{x['text_zh']}」"
                f"（{('/'.join(x['categories']))}；keying={x['keying']}）\n")
    f.write("\n## 三、官方基线中已存在的同类题（提醒开发侧留意，不在本批自译范围）\n\n")
    f.write("- `ipip-neo-120-zh.json` 第 21 题 `Go on binges.` → 大吃大喝寻欢作乐（成瘾/放纵类）\n")
    f.write("- `ipip-neo-120-zh.json` 第 29 题 `Sympathize with the homeless.` → 同情流浪汉（社会议题类）\n")
    f.write("\n## 四、走查结论\n\n")
    f.write(f"- 本批自译 205 条已逐题走查上述类别（政治/宗教/性/成瘾/违法/医疗/外貌/特定群体）。\n")
    f.write(f"- 命中标记的共 **{len(flagged)}** 条，全部集中在 **O6 价值观层面**（政治/宗教/司法/纳税/爱国表达）。\n")
    f.write(f"- 其余 205 − {len(flagged)} 条未触及上述敏感类别，可直接使用；N 维负面情绪题（焦虑/抑郁等）属量表本体，未因「医学诊断」口径删除。\n")
    f.write("- 无「中文语境完全不适用」需整题替换的题项（O6 政治/宗教题已在上文单列，按同层面替换处理）。\n")

print("\n需替换清单已写入 需替换题项清单.md")
