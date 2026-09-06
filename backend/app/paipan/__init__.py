# -*- coding: utf-8 -*-
"""app.paipan — 排盘基础模块（排盘 / 切片 / 打分）。

对外导出：
  - paipan               排盘引擎（engine.py）：公历出生信息 → chart dict
  - slice_chart          切片（slicer.py）：chart → {方法 key: 片段}
  - score_fit            打分（scorer.py）：契合度三因子
  - calibration_weight   校准权重（scorer.py）
  - compute_shensha      命理神煞查表（shensha.py）
"""

from .engine import paipan
from .slicer import slice_chart
from .scorer import calibration_weight, score_fit
from .shensha import compute_shensha

__all__ = ["paipan", "slice_chart", "score_fit",
           "calibration_weight", "compute_shensha"]
