from __future__ import annotations

import time
import asyncio
from dataclasses import dataclass
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Tuple, Optional
from app.redis_client import get_redis

@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int

#правила
RULE_IP_EMAIL = RateLimitRule(limit=5, window_seconds=60) # 5 попыток /мин на ip+email
RULE_IP_GLOBAL = RateLimitRule(limit=20, window_seconds=60) # 20 запросов / минуту на ip (против Dos)

class RedisRateLimiter:
    async def check(self, key: str, rule: RateLimitRule) -> Tuple[bool, int]:
        r = get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, rule.window_seconds)
        if count <= rule.limit:
            return True, 0
        
        ttl = await r.ttl(key)
        if ttl is None or ttl < 0:
            ttl = rule.window_seconds
            await r.expire(key, rule.window_seconds)
        return False, int(ttl)
rate_limiter = RedisRateLimiter()

