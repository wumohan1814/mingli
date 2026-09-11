# -*- coding: utf-8 -*-
"""app.paipan — 排盘基础模块（排盘 / 切片 / 打分 / 标记）。

对外导出：
  - paipan               排盘引擎（engine.py）：公历出生信息 → chart dict
  - slice_chart          切片（slicer.py）：chart → {方法 key: 片段}
  - score_fit            打分（scorer.py）：契合度三因子
  - calibration_weight   校准权重（scorer.py）
  - compute_shensha      命理神煞查表（shensha.py）
  - mark_chart           预判标记（marker.py）：chart → 各法确定性标记
  - 节116 第④步 · 方向级模糊否定：
      collect_vague_denials / merge_vague_denials / vague_denial_summary
      vague_denial_rank_penalty / apply_confidence_penalty
"""

from .engine import paipan
from .slicer import slice_chart
from .scorer import (
    calibration_weight,
    score_fit,
    collect_vague_denials,
    merge_vague_denials,
    vague_denial_summary,
    vague_denial_rank_penalty,
    apply_confidence_penalty,
)
from .shensha import compute_shensha
from .marker import mark_chart

__all__ = [
    "paipan", "slice_chart", "score_fit",
    "calibration_weight", "compute_shensha",
    "mark_chart",
    "collect_vague_denials", "merge_vague_denials", "vague_denial_summary",
    "vague_denial_rank_penalty", "apply_confidence_penalty",
]
