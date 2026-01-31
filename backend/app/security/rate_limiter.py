from __future__ import annotations

import time
import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Tuple, Optional

@dataclass(frozen=True)
class LimitRule:
    max_attempts: int
    window_seconds: int

class RateLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str, rule: LimitRule) -> Tuple[bool, int]:
        now = time.monotonic()
        window_start = now - rule.window_seconds

        async with self._lock:
            q = self._hits[key]

            # выкидываем старые попытки
            while q and q[0] < window_start:
                q.popleft()

            if len(q) >= rule.max_attempts:
                # сколько осталось ждать до освобождения окна
                retry_after = int((q[0] + rule.window_seconds) - now)
                if retry_after < 1:
                    retry_after = 1
                return False, retry_after
        
        q.append(now)
        return True, 0
    
    async def reset(self, key: str) -> None:
        async with self._lock:
            self._hits.pop(key, None)

#единый инстанс
rate_limiter = RateLimiter()

#правила
RULE_IP_EMAIL = LimitRule(max_attempts=5, window_seconds=5 * 60) # 5 попыток / 5 минут на ip+email
RULE_IP_GLOBAL = LimitRule(max_attempts=30, window_seconds=60) # 30 попыток / минуту на ip (против Dos)