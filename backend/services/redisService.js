const redis = require('redis');

let client;
let isConnected = false;
const inMemoryCache = new Map();

try {
  client = redis.createClient({
    url: process.env.REDIS_URI || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: false // Don't retry endlessly if not available
    }
  });

  client.on('error', (err) => {
    // Ignore error logs after initial connection attempt
  });
} catch (e) {}

async function connectRedis() {
  if (!isConnected && client) {
    try {
      await client.connect();
      isConnected = true;
      console.log('Redis connected successfully');
    } catch (e) {
      console.log('Failed to connect to Redis. Falling back to in-memory cache.');
    }
  }
}

async function getCachedData(key) {
  if (isConnected) {
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      return null;
    }
  } else {
    // Fallback
    const item = inMemoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      inMemoryCache.delete(key);
      return null;
    }
    return item.value;
  }
}

async function setCachedData(key, value, expirySeconds = 300) {
  if (isConnected) {
    try {
      await client.setEx(key, expirySeconds, JSON.stringify(value));
    } catch (err) {}
  } else {
    // Fallback
    inMemoryCache.set(key, {
      value,
      expiry: Date.now() + (expirySeconds * 1000)
    });
  }
}

async function invalidateCachePattern(pattern) {
  if (isConnected) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (err) {}
  } else {
    // Fallback (naive pattern match)
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of inMemoryCache.keys()) {
      if (regex.test(key)) {
        inMemoryCache.delete(key);
      }
    }
  }
}

module.exports = { client, connectRedis, getCachedData, setCachedData, invalidateCachePattern };
