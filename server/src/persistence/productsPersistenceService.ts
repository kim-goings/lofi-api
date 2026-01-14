import { fail } from 'assert';
import { createClient, type RedisClientType } from 'redis';

export class ProductsPersistenceService {
  private client!: RedisClientType;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const redisUrl = process.env.PRODUCT_DB_URL || 'redis-12410.c232.us-east-1-2.ec2.cloud.redislabs.com:12410';
    const redisUsername = process.env.PRODUCT_DB_USERNAME || 'default';
    const redisPassword = process.env.PRODUCT_DB_PASSWORD || '';

    if (redisUrl === '' || redisUsername === '' || redisPassword === '') {
      throw new Error('PRODUCT_DB_URL, PRODUCT_DB_USERNAME, and PRODUCT_DB_PASSWORD must be set as environment variables');
    }

    this.client = createClient({
      username: redisUsername,
      password: redisPassword,
      socket: {
        host: redisUrl.split(':')[0],
        port: parseInt(redisUrl.split(':')[1], 10)
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error in CachingPersistenceService', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('CachingPersistenceService connected to Redis');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (err) {
      console.error('CachingPersistenceService failed to connect to Redis:', err);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  async cacheProduct(productId: string, productData: any, ttlSeconds = 300): Promise<void> {
    if (this.failedConnection()) return;

    try {
      const key = `product:${productId}`;
      this.client.setEx(key, ttlSeconds, JSON.stringify(productData));
    } catch (err) {
      console.error('Failed to cache product:', err);
    }
  }

  async getCachedProduct(productId: string): Promise<any | null> {
    if (this.failedConnection()) return null;

    try {
      const key = `product:${productId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Failed to retrieve cached product:', err);
      return null;
    }
  }

  async cacheProductsList(cursor: string | null, productsData: any, ttlSeconds = 300): Promise<void> {
    if (this.failedConnection()) return;

    try {
      const key = `products:list:${cursor || 'start'}`;
      this.client.setEx(key, ttlSeconds, JSON.stringify(productsData));
    } catch (err) {
      console.error('Failed to cache products list:', err);
    }
  }

  async getCachedProductsList(cursor: string | null): Promise<any | null> {
    if (this.failedConnection()) return null;

    try {
      //if cursor is null, grab from start
      const key = `products:list:${cursor || 'start'}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Failed to retrieve cached products list:', err);
      return null;
    }
  }

  // Rate limiter state persistence methods here as rate limits apply to products
  async updateRateLimitState(points: number, lastRefillTime: number): Promise<void> {
    if (this.failedConnection()) return;

    try {
      const key = `ratelimiter:state`;
      const state = { points, lastRefillTime };
      this.client.set(key, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to update rate limit state:', err);
    }
  }

  async getRateLimitState(): Promise<{ points: number, lastRefillTime: number } | null> {
    if (this.failedConnection()) return null;

    try {
      const key = `ratelimiter:state`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Failed to retrieve rate limit state:', err);
      return null;
    }
  }

  private failedConnection(): boolean {
    return (!this.isConnected || !this.client);
  }


}

