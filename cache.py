import json
import os

import redis


REDIS_CACHE_URL = os.getenv(
    "REDIS_CACHE_URL",
    "redis://127.0.0.1:6379/2"
)


cache_client = redis.Redis.from_url(

    REDIS_CACHE_URL,

    decode_responses=True,

    socket_connect_timeout=1,

    socket_timeout=1,

    health_check_interval=30,
)


DEFAULT_CACHE_TTL = int(
    os.getenv(
        "CACHE_TTL_SECONDS",
        "120"
    )
)


def get_json_cache(
    key
):
    """
    Return cached JSON.

    Redis failure behaves like
    a normal cache miss.
    """

    try:

        value = cache_client.get(
            key
        )


        if value is None:

            return None


        return json.loads(
            value
        )


    except (
        redis.RedisError,
        json.JSONDecodeError
    ):

        return None


def set_json_cache(
    key,
    value,
    ttl=DEFAULT_CACHE_TTL
):
    """
    Cache JSON-serializable data
    with an expiry.
    """

    try:

        cache_client.setex(
            key,
            ttl,
            json.dumps(
                value
            )
        )


        return True


    except (
        redis.RedisError,
        TypeError
    ):

        return False


def delete_cache_key(
    key
):

    try:

        cache_client.delete(
            key
        )

    except redis.RedisError:

        pass


def delete_cache_pattern(
    pattern
):
    """
    Delete matching keys using SCAN
    instead of Redis KEYS.
    """

    try:

        batch = []


        for key in cache_client.scan_iter(
            match=pattern,
            count=100
        ):

            batch.append(
                key
            )


            if len(batch) >= 100:

                cache_client.delete(
                    *batch
                )

                batch.clear()


        if batch:

            cache_client.delete(
                *batch
            )


    except redis.RedisError:

        pass


def invalidate_trek_cache():

    delete_cache_pattern(
        "trekker:treks:*"
    )


def cache_health():

    try:

        return bool(
            cache_client.ping()
        )

    except redis.RedisError:

        return False