"""进程内事件分发器（MVP in-process pub-sub）

Phase2 升级为 Redis Streams / Kafka 时仅替换传输层，Schema 不变。
"""
from typing import Callable, Dict, List
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """事件基类"""
    event_id: str
    case_id: str
    method_key: str = ""
    phase: str = ""


class InProcessDispatcher:
    """进程内发布-订阅分发器"""

    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        """订阅事件"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        logger.info(f"订阅 {event_type} -> {handler.__name__}")

    def publish(self, event_type: str, event: Event):
        """发布事件（同步调用所有处理器）"""
        handlers = self._handlers.get(event_type, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception(f"事件处理失败: {event_type}")

    def unsubscribe(self, event_type: str, handler: Callable):
        """取消订阅"""
        if event_type in self._handlers:
            self._handlers[event_type] = [h for h in self._handlers[event_type] if h != handler]


# 全局单例
dispatcher = InProcessDispatcher()
