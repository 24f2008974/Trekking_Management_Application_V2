import json

import redis


# =========================================================
# REDIS CACHE CONNECTION
# =========================================================

cache_client = redis.Redis(
    host="127.0.0.1",
    port=6379,
    db=2,
    decode_responses=True
)


# =========================================================
# DEFAULT CACHE EXPIRY
# =========================================================

DEFAULT_CACHE_TTL = 120


# =========================================================
# GET JSON FROM CACHE
# =========================================================

def get_json_cache(key):
    """
    Return cached JSON data.

    If Redis is unavailable, return None so
    the application continues using SQLite.
    """

    try:

        value = cache_client.get(key)

        if value is None:
            return None

        return json.loads(value)

    except (
        redis.RedisError,
        json.JSONDecodeError
    ):

        return None


# =========================================================
# SAVE JSON IN CACHE
# =========================================================

def set_json_cache(
    key,
    value,
    ttl=DEFAULT_CACHE_TTL
):
    """
    Save JSON serializable data in Redis.
    """

    try:

        cache_client.setex(
            key,
            ttl,
            json.dumps(value)
        )

        return True

    except (
        redis.RedisError,
        TypeError
    ):

        return False


# =========================================================
# DELETE ONE CACHE KEY
# =========================================================

def delete_cache_key(key):

    try:

        cache_client.delete(key)

    except redis.RedisError:

        pass


# =========================================================
# DELETE CACHE KEYS BY PATTERN
# =========================================================

def delete_cache_pattern(pattern):
    """
    Delete matching Redis cache keys.

    scan_iter is preferred over KEYS because
    it does not block Redis for large datasets.
    """

    try:

        keys = list(
            cache_client.scan_iter(
                match=pattern
            )
        )

        if keys:

            cache_client.delete(
                *keys
            )

    except redis.RedisError:

        pass


# =========================================================
# INVALIDATE ALL TREK CACHE
# =========================================================

def invalidate_trek_cache():

    delete_cache_pattern(
        "trekker:treks:*"
    )


# =========================================================
# CACHE HEALTH CHECK
# =========================================================

def cache_health():

    try:

        return cache_client.ping()

    except redis.RedisError:

        return False
    