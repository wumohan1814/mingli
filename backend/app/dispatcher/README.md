# dispatcher/ — 模块 3：进程内事件分发器

MVP 的模块间通信总线：**in-process pub-sub**，接口隔离但不跨网络。

## 事件

```
MethodAnalysisRequested / MethodAnalysisCompleted / SynthesisCompleted
RecordPersisted / FeedbackReceived / CalibrationUpdated
```

契约见 `docs/standards/03-接口与数据字典.md` §2；**Schema 在 Phase2 升总线时保持不变**。

## 语义

- 至少一次 + 幂等：MVP 单进程内无网络重投，**幂等属防御性预留**（C25），Phase2 激活为必需。
  幂等键 `caseId + methodKey + phase + eventId`，两阶段一致。
- 断前尘：**串行**派发（等上一法 `MethodAnalysisCompleted` 再发下一法，控成本）。
- 预测：**并行扇出**派发。
- Phase2：替换传输层为 Redis Streams / Kafka，分区键 `methodKey` 保序。

## 边界

分发器只负责路由，**不承载业务逻辑**；任何领域规则放所属模块。
