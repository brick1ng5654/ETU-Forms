from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple
from app.redis_client import get_redis

@dataclass(frozen=True)
class LockoutPolicy:
    fail_limit: int
    fail_window_seconds: int
    lock_seconds: int

DEFAULT_LOCKOUT = LockoutPolicy(
    fail_limit=5,
    fail_window_seconds=600,  # 5 минут
    lock_seconds=900,         # 15 минут
)

class RedisLoginLockout:
    async def is_locked(self, lock_key: str) -> Tuple[bool, int]:
        r = get_redis()
        ttl = await r.ttl(lock_key)
        if ttl is None or ttl < 0:
            return False, 0
        return True, int(ttl)
    
    async def register_failure(
        self,
        fail_key: str,
        lock_key: str,
        policy: LockoutPolicy
    ) -> Tuple[bool, int]:
        r = get_redis()
        fail_count = await r.incr(fail_key)
        if fail_count == 1:
            await r.expire(fail_key, policy.fail_window_seconds)
        
        if fail_count >= policy.fail_limit:
            await r.set(lock_key, "1", ex=policy.lock_seconds)
            await r.delete(fail_key)
            return True, policy.lock_seconds
        
        return False, 0
    
    async def reset(self, fail_key: str, lock_key: str) -> None:
        r = get_redis()
        await r.delete(fail_key)
        await r.delete(lock_key)

login_lockout = RedisLoginLockout()