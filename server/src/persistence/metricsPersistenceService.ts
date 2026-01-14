import { createClient, type RedisClientType } from 'redis';
import type { ProductStats } from '../services/metricsService.js';

export class MetricsPersistenceService {
  private client!: RedisClientType;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const redisUrl = process.env.METRICS_DB_URL || 'redis-12410.c232.us-east-1-2.ec2.cloud.redislabs.com:12410';
    const redisUsername = process.env.METRICS_DB_USERNAME || 'default';
    const redisPassword = process.env.METRICS_DB_PASSWORD || '';

    if (redisUrl === '' || redisUsername === '' || redisPassword === '') {
      throw new Error('METRICS_DB_URL, METRICS_DB_USERNAME, and METRICS_DB_PASSWORD must be set as environment variables');
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
      console.error('Redis Client Error in MetricsPersistenceService', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('MetricsPersistenceService connected to Redis');
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
      console.error('MetricsPersistenceService failed to connect to Redis:', err);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      this.client.quit();
      this.isConnected = false;
    }
  }


  async recordEndpointMetric(responseTimeMs: number): Promise<void> {
    if (this.failedConnection()) return;

    try {
      const timestamp = Date.now();
      const key = `metrics:endpoint:${timestamp}`;
      this.client.setEx(key, 3600, JSON.stringify({ responseTimeMs, timestamp }));

      // maintain a list for aggregation
      this.client.lPush('metrics:endpoint:times', responseTimeMs.toString());
      this.client.expire('metrics:endpoint:times', 3600);

      // increment call counter
      this.client.incr('metrics:endpoint:calls');
      this.client.expire('metrics:endpoint:calls', 3600);
    } catch (err) {
      console.error('Failed to record endpoint metric:', err);
    }
  }

  async recordShopifyMetric(responseTimeMs: number): Promise<void> {
    if (this.failedConnection()) return;


    try {
      const timestamp = Date.now();
      const key = `metrics:shopify:${timestamp}`;
      this.client.setEx(key, 3600, JSON.stringify({ responseTimeMs, timestamp }));

      // maintain a list for aggregation
      this.client.lPush('metrics:shopify:times', responseTimeMs.toString());
      this.client.expire('metrics:shopify:times', 3600);

      // increment call counter
      this.client.incr('metrics:shopify:calls');
      this.client.expire('metrics:shopify:calls', 3600);
    } catch (err) {
      console.error('Failed to record Shopify metric:', err);
    }
  }

  async getMetrics(): Promise<ProductStats> {
    if (this.failedConnection()) {
      return {
        endpoint_response_times_ms: { average: 0, max: 0, min: 0 },
        total_endpoint_calls: 0,
        average_shopify_call_responsetime_ms: 0,
        total_shopify_api_calls: 0,
      };
    }

    try {
      const endpointTimes = await this.client.lRange('metrics:endpoint:times', 0, -1);
      const endpointCalls = await this.client.get('metrics:endpoint:calls');

      const shopifyTimes = await this.client.lRange('metrics:shopify:times', 0, -1);
      const shopifyCalls = await this.client.get('metrics:shopify:calls');

      // calculate endpoint response times
      let endpointAvg = 0;
      let endpointMax = 0;
      let endpointMin = 0;

      if (endpointTimes.length > 0) {
        const times = endpointTimes.map((t) => parseInt(t, 10));
        endpointAvg = times.reduce((a, b) => a + b, 0) / times.length;
        endpointMax = Math.max(...times);
        endpointMin = Math.min(...times);
      }

      // calculate shopify response times
      let shopifyAvg = 0;
      if (shopifyTimes.length > 0) {
        const times = shopifyTimes.map((t) => parseInt(t, 10));
        shopifyAvg = times.reduce((a, b) => a + b, 0) / times.length;
      }

      return {
        endpoint_response_times_ms: {
          average: Math.round(endpointAvg),
          max: endpointMax,
          min: endpointMin,
        },
        total_endpoint_calls: parseInt(endpointCalls || '0', 10),
        average_shopify_call_responsetime_ms: Math.round(shopifyAvg),
        total_shopify_api_calls: parseInt(shopifyCalls || '0', 10),
      };
    } catch (err) {
      console.error('Failed to get metrics:', err);
      return {
        endpoint_response_times_ms: { average: 0, max: 0, min: 0 },
        total_endpoint_calls: 0,
        average_shopify_call_responsetime_ms: 0,
        total_shopify_api_calls: 0,
      };
    }
  }

  async resetMetrics(): Promise<void> {
    if (this.failedConnection()) return;

    try {
      await this.client.del([
        'metrics:endpoint:times',
        'metrics:endpoint:calls',
        'metrics:shopify:times',
        'metrics:shopify:calls',
      ]);
    } catch (err) {
      console.error('Failed to reset metrics:', err);
    }
  }


  private failedConnection(): boolean {
    return (!this.isConnected || !this.client);
  }

}







