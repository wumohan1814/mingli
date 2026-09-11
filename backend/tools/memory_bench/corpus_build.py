# -*- coding: utf-8 -*-
"""合成语料生成器（确定性、可复现、零网络）。

产出 `corpus.json`：
  - **约 30 个虚拟用户**，每人 **10~30 条**事实记忆（内容取自下方人工撰写的事实池）；
  - **48 个「问题 → 期望命中的记忆 id」标注**，问题长度**分三档混合**：
    短问 ≤2 字 / 中等 3~8 字 / 自然长问 >8 字（用于验证 <3 字跳过 BM25 的缺陷）。

设计要点（决定了指标是否可信）：
  1. **事实重要性/时效与主题无关**：`importance`、`age_days` 按用户号与序号确定性
     取值，**不按主题倾斜**。因此"recency 通道取到的 6 条"与问题主题基本无关 ——
     这正是要暴露的缺陷，若按主题倾斜会把基线人为抬高；
  2. **噪声是天然的**：每个用户 10~30 条事实只覆盖 14 个主题中的一部分，问某主题
     时其余主题的事实即噪声，保证"准确率"指标有意义；
  3. **完全确定性**：不使用 `random`，仅用整数算术与 `hashlib`，同一版本必得同一语料。

用法：
    python corpus_build.py --emit            # 生成/覆盖 corpus.json
    python corpus_build.py --emit --out x.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

CORPUS_PATH = Path(__file__).resolve().parent / "corpus.json"

N_USERS = 30
MIN_FACTS, MAX_FACTS = 10, 30
MAX_AGE_DAYS = 180
IMPORTANCE_CHOICES = (0.3, 0.5, 0.6, 0.7, 0.8, 0.9)

def _coprime_step(pool_size: int, min_step: int = 7) -> int:
    """取一个与池长互质的步长，保证同一用户取到的下标互不相同（无重复事实）。

    池长会被后续人工增删，硬编码步长会在池长含该因子时退化成短周期
    （例如池长 70 与步长 7 的 gcd 为 7 → 只有 10 个不同下标），故动态求取。
    """
    s = min_step
    while math.gcd(s, pool_size) != 1:
        s += 1
    return s


# --------------------------------------------------------------------------- #
# 事实池：14 主题 × 5 条 = 70 条人工撰写的中文事实（命理场景相关）
# (topic, fact_type, content)  fact_type ∈ preference|identity|goal|event|habit
# --------------------------------------------------------------------------- #
FACT_POOL: list[tuple[str, str, str]] = [
    ("事业", "goal", "用户目前在一家互联网公司做产品经理"),
    ("事业", "goal", "用户想从技术岗转到管理岗"),
    ("事业", "event", "用户在现在的公司已经工作了三年"),
    ("事业", "preference", "用户对现在的工作内容比较满意"),
    ("事业", "event", "用户担心所在行业的裁员风险"),

    ("财运", "goal", "用户希望今年能存下十万元"),
    ("财运", "preference", "用户对高风险投资比较保守"),
    ("财运", "event", "用户有一笔三年期的定期存款"),
    ("财运", "habit", "用户每个月都会固定记账"),
    ("财运", "goal", "用户想学习基金定投"),

    ("婚姻", "identity", "用户目前单身"),
    ("婚姻", "event", "用户有一个交往了两年的对象"),
    ("婚姻", "goal", "用户计划明年结婚"),
    ("婚姻", "preference", "用户比较介意异地恋"),
    ("婚姻", "event", "用户的父母一直在催婚"),

    ("健康", "identity", "用户有慢性胃炎，吃不了辣"),
    ("健康", "habit", "用户长期熬夜到凌晨两点"),
    ("健康", "habit", "用户每周跑步三次"),
    ("健康", "identity", "用户对花粉过敏"),
    ("健康", "event", "用户最近的睡眠质量不太好"),

    ("学业", "goal", "用户准备考公务员"),
    ("学业", "goal", "用户正在准备考研"),
    ("学业", "identity", "用户本科读的是会计专业"),
    ("学业", "event", "用户的英语基础比较薄弱"),
    ("学业", "goal", "用户想考注册会计师证书"),

    ("迁移", "event", "用户 2024 年从杭州搬到了深圳"),
    ("迁移", "identity", "用户的老家在四川成都"),
    ("迁移", "identity", "用户现在在北京租房住"),
    ("迁移", "goal", "用户想在一线城市长期定居"),
    ("迁移", "preference", "用户不喜欢频繁搬家"),

    ("性格", "identity", "用户性格偏内向，不喜欢应酬"),
    ("性格", "identity", "用户做决定的时候比较容易犹豫"),
    ("性格", "event", "用户在人多场合会紧张"),
    ("性格", "habit", "用户喜欢独自思考问题"),
    ("性格", "identity", "用户对细节比较敏感"),

    ("创业", "goal", "用户打算开一家咖啡店"),
    ("创业", "event", "用户和朋友合伙做过小生意"),
    ("创业", "preference", "用户对餐饮行业比较感兴趣"),
    ("创业", "goal", "用户希望三年内自己当老板"),
    ("创业", "event", "用户担心创业的资金压力"),

    ("出行", "goal", "用户今年计划去日本旅行"),
    ("出行", "preference", "用户不喜欢坐飞机"),
    ("出行", "habit", "用户每年至少出远门一次"),
    ("出行", "goal", "用户想带父母一起旅游"),
    ("出行", "event", "用户去过云南三次"),

    ("子女", "identity", "用户已婚并有一个三岁的孩子"),
    ("子女", "preference", "用户很在意孩子的教育"),
    ("子女", "event", "用户的孩子明年要上小学"),
    ("子女", "goal", "用户想给孩子报兴趣班"),
    ("子女", "event", "用户担心孩子的性格太内向"),

    ("房产", "goal", "用户正在考虑买首套房"),
    ("房产", "event", "用户目前没有房贷压力"),
    ("房产", "goal", "用户希望在工作城市买房定居"),
    ("房产", "event", "用户的家庭能提供一部分首付"),
    ("房产", "preference", "用户觉得现在房价还比较高"),

    ("人际", "event", "用户在公司的人际关系比较融洽"),
    ("人际", "event", "用户不太擅长和领导沟通"),
    ("人际", "event", "用户有两三个从小到大的好朋友"),
    ("人际", "preference", "用户不喜欢参加团建活动"),
    ("人际", "event", "用户最近和同事有过一次争执"),

    ("心态", "event", "用户最近的压力比较大"),
    ("心态", "identity", "用户容易焦虑未来"),
    ("心态", "habit", "用户会通过冥想来放松"),
    ("心态", "identity", "用户对自己的要求比较高"),
    ("心态", "event", "用户最近情绪比较低落"),

    ("兴趣", "preference", "用户喜欢看悬疑小说"),
    ("兴趣", "goal", "用户想学一门乐器"),
    ("兴趣", "habit", "用户周末喜欢去爬山"),
    ("兴趣", "preference", "用户对摄影很感兴趣"),
    ("兴趣", "habit", "用户会做饭，并且享受做饭"),
]

# --------------------------------------------------------------------------- #
# 问题模板：(topic, bucket, 问题文本)
# bucket: short ≤2 字 / medium 3~8 字 / long >8 字
# --------------------------------------------------------------------------- #
QUESTION_TEMPLATES: list[tuple[str, str, str]] = [
    ("事业", "short", "事业"),
    ("事业", "medium", "我的事业运势"),
    ("事业", "long", "我的事业在未来三年会如何发展"),
    ("事业", "medium", "事业能顺利吗"),
    ("事业", "long", "我该往哪个方向发展比较好"),

    ("财运", "short", "财运"),
    ("财运", "medium", "我的财运怎么样"),
    ("财运", "long", "我今年财运到底怎么样啊"),
    ("财运", "medium", "今年能存下钱吗"),
    ("财运", "long", "我今年能不能攒下钱来"),

    ("婚姻", "short", "婚姻"),
    ("婚姻", "medium", "什么时候结婚"),
    ("婚姻", "long", "我什么时候能够结婚生子呢"),
    ("婚姻", "medium", "感情运势如何"),
    ("婚姻", "long", "我的感情运势今年会怎么走"),

    ("健康", "short", "健康"),
    ("健康", "medium", "我的健康状况"),
    ("健康", "long", "请问我今年的健康状况怎么样"),
    ("健康", "medium", "身体要注意什么"),
    ("健康", "long", "我平时应该注意哪些身体问题"),

    ("学业", "short", "学业"),
    ("学业", "medium", "要不要考研"),
    ("学业", "long", "我想知道我能不能考上公务员"),
    ("学业", "medium", "学业能进步吗"),
    ("学业", "long", "我继续读书深造合适吗"),

    ("迁移", "short", "搬家"),
    ("迁移", "medium", "要不要换城市"),
    ("迁移", "long", "我搬到深圳之后事业会变好吗"),
    ("迁移", "medium", "适合长期定居吗"),
    ("迁移", "long", "我应该留在现在的城市还是回老家"),

    ("性格", "short", "性格"),
    ("性格", "medium", "我适合做什么工作"),
    ("性格", "long", "我这种性格适合做什么样的工作"),
    ("性格", "medium", "我的性格怎么样"),
    ("性格", "long", "我该怎么发挥自己性格上的优势"),

    ("创业", "short", "创业"),
    ("创业", "medium", "适合创业吗"),
    ("创业", "long", "我适不适合在本地创业做生意"),
    ("创业", "medium", "开店能赚钱吗"),
    ("创业", "long", "我现在开店做生意能赚钱吗"),

    ("出行", "short", "出行"),
    ("出行", "medium", "我适合出国吗"),
    ("出行", "long", "我今年适合安排一次长途旅行吗"),
    ("出行", "medium", "今年能出去玩吗"),
    ("出行", "long", "我想带家人出去玩什么时候合适"),

    ("子女", "short", "孩子"),
    ("子女", "medium", "孩子学业问题"),
    ("子女", "long", "我家孩子以后的学业应该注意什么"),
    ("子女", "medium", "孩子性格怎么样"),
    ("子女", "long", "我该怎样培养孩子的性格和习惯"),

    ("房产", "short", "买房"),
    ("房产", "medium", "买房时机合适吗"),
    ("房产", "long", "我这两年在哪个城市买房比较合适"),
    ("房产", "medium", "今年适合买房吗"),
    ("房产", "long", "我现在出手买房会不会有压力"),

    ("人际", "short", "人际"),
    ("人际", "medium", "我的人缘怎么样"),
    ("人际", "long", "我在职场里的人际关系会顺利吗"),
    ("人际", "medium", "和同事关系如何"),
    ("人际", "long", "我该怎样处理和领导之间的沟通"),

    ("心态", "short", "心态"),
    ("心态", "medium", "我最近状态如何"),
    ("心态", "long", "我最近的心态和状态需要注意什么"),
    ("心态", "medium", "压力大怎么办"),
    ("心态", "long", "我该怎么调整最近焦虑的状态"),

    ("兴趣", "short", "爱好"),
    ("兴趣", "medium", "我适合学什么"),
    ("兴趣", "long", "我适合培养一门什么样的兴趣爱好"),
    ("兴趣", "medium", "有什么爱好适合我"),
    ("兴趣", "long", "我在业余时间适合做点什么好"),
]


def _importance(user_no: int, seq: int) -> float:
    """确定性重要性（与主题无关，见模块 docstring 设计要点 1）。"""
    return IMPORTANCE_CHOICES[(user_no * 31 + seq * 17) % len(IMPORTANCE_CHOICES)]


def _age_days(user_no: int, seq: int) -> int:
    """确定性"距今多少天"（0~179，覆盖 180 天清理阈值以内）。"""
    return (seq * 11 + user_no * 5) % MAX_AGE_DAYS


def _trust(user_no: int, seq: int) -> float:
    """规则抽取固定 0.75 / LLM 抽取默认 0.7 两种取值交替。"""
    return 0.75 if (user_no + seq) % 2 == 0 else 0.7


def _username(user_no: int) -> str:
    return "bench_user_%02d" % user_no


def build_corpus() -> dict:
    """构造并返回完整语料字典（确定性）。"""
    pool_size = len(FACT_POOL)
    step = _coprime_step(pool_size)  # 与池长互质 → 取 n 个下标必互不相同
    if (MAX_FACTS - MIN_FACTS + 1) > pool_size:
        raise RuntimeError("语料自检失败：事实池比单用户上限还小，无法保证无重复")
    users: list[dict] = []
    # topic -> [(user_no, fact_id)]
    by_topic: dict[str, list[tuple[int, str]]] = {}

    for user_no in range(1, N_USERS + 1):
        # 乘数 11 与 21 互质 → (user_no*11)%21 走遍全部余数 → 事实数铺满 10~30
        n_facts = MIN_FACTS + (user_no * 11) % (MAX_FACTS - MIN_FACTS + 1)
        offset = (user_no * 13) % pool_size
        facts: list[dict] = []
        for seq in range(n_facts):
            topic, fact_type, content = FACT_POOL[(offset + seq * step) % pool_size]
            fact_id = "%s_f%02d" % (_username(user_no), seq)
            facts.append({
                "id": fact_id,
                "topic": topic,
                "content": content,
                "fact_type": fact_type,
                "importance": _importance(user_no, seq),
                "trust": _trust(user_no, seq),
                "age_days": _age_days(user_no, seq),
                "tags": [topic, fact_type],
            })
            by_topic.setdefault(topic, []).append((user_no, fact_id))
        contents = [f["content"] for f in facts]
        if len(set(contents)) != len(contents):
            raise RuntimeError("语料自检失败：用户 %d 出现重复事实内容" % user_no)
        users.append({"user_no": user_no, "username": _username(user_no), "facts": facts})

    # 每个用户的 id -> fact 映射（生成问题时定位期望记忆）
    user_facts: dict[int, dict[str, dict]] = {
        u["user_no"]: {f["id"]: f for f in u["facts"]} for u in users
    }

    questions: list[dict] = []
    topic_cursor: dict[str, int] = {}
    for idx, (topic, bucket, text) in enumerate(QUESTION_TEMPLATES):
        candidates = by_topic.get(topic) or []
        if not candidates:
            raise RuntimeError("语料自检失败：主题 %s 没有任何用户命中" % topic)
        cursor = topic_cursor.get(topic, 0)
        user_no, _ = candidates[cursor % len(candidates)]
        topic_cursor[topic] = cursor + 1

        expected = [fid for uid, fid in candidates if uid == user_no][:2]
        # 自检：期望 id 必须真实存在且主题一致
        for fid in expected:
            assert user_facts[user_no][fid]["topic"] == topic, "期望记忆主题不一致"

        questions.append({
            "id": "q%03d" % (idx + 1),
            "user_no": user_no,
            "username": _username(user_no),
            "topic": topic,
            "bucket": bucket,
            "question": text,
            "expected_fact_ids": expected,
        })

    # 自检：每个用户的问题都指向真实用户
    assert all(q["user_no"] in user_facts for q in questions), "问题指向不存在的用户"

    digest = hashlib.sha1(
        json.dumps({"users": users, "questions": questions}, ensure_ascii=False,
                   sort_keys=True).encode("utf-8")
    ).hexdigest()

    return {
        "meta": {
            "generator": "corpus_build.py",
            "n_users": N_USERS,
            "n_facts": sum(len(u["facts"]) for u in users),
            "n_questions": len(questions),
            "min_facts_per_user": MIN_FACTS,
            "max_facts_per_user": MAX_FACTS,
            "max_age_days": MAX_AGE_DAYS,
            "fact_pool_size": pool_size,
            "n_topics": len(by_topic),
            "content_sha1": digest,
        },
        "users": users,
        "questions": questions,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="生成离线记忆基准语料 corpus.json")
    ap.add_argument("--emit", action="store_true", help="写出 corpus.json")
    ap.add_argument("--out", default=str(CORPUS_PATH), help="输出路径")
    args = ap.parse_args()

    corpus = build_corpus()
    meta = corpus["meta"]
    print("用户数 %(n_users)d ｜ 事实数 %(n_facts)d ｜ 问题数 %(n_questions)d "
          "｜ 主题数 %(n_topics)d" % meta)
    buckets: dict[str, int] = {}
    for q in corpus["questions"]:
        buckets[q["bucket"]] = buckets.get(q["bucket"], 0) + 1
    print("问题分档：", buckets)
    print("content_sha1", meta["content_sha1"])

    if args.emit:
        Path(args.out).write_text(
            json.dumps(corpus, ensure_ascii=False, indent=1), encoding="utf-8")
        print("已写出", args.out)
    else:
        print("（未加 --emit，仅预览）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
