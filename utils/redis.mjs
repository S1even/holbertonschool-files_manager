import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      enable_offline_queue: false,
    });

    this.client.on('error', (err) => {
      console.log(`Redis client not connected to the server: ${err.message}`);
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setexAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    if (!this.isAlive()) {
      return null;
    }

    return this.getAsync(key);
  }

  async set(key, value, duration) {
    if (!this.isAlive()) {
      return null;
    }

    return this.setexAsync(key, duration, value);
  }

  async del(key) {
    if (!this.isAlive()) {
      return null;
    }

    return this.delAsync(key);
  }
}

const redisClient = new RedisClient();

export default redisClient;
