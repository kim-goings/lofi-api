import { MetricsPersistenceService } from '../persistence/metricsPersistenceService.js';

export interface ProductStats {
  endpoint_response_times_ms: {
    average: number;
    max: number;
    min: number;
  };
  total_endpoint_calls: number;
  average_shopify_call_responsetime_ms: number;
  total_shopify_api_calls: number;
}

export class MetricsService {
  private static instance: MetricsService;
  private persistenceService!: MetricsPersistenceService;

  private constructor(metricsPersistenceService: MetricsPersistenceService) {
    this.persistenceService = metricsPersistenceService;
  }

  static async getInstance(): Promise<MetricsService> {
    if (null == MetricsService.instance) {
      const persistenceService = new MetricsPersistenceService();
      await persistenceService.connect();
      MetricsService.instance = new MetricsService(persistenceService);
    }
    return MetricsService.instance;
  }

  async recordEndpointCall(responseTimeMs: number): Promise<void> {
    this.persistenceService.recordEndpointMetric(responseTimeMs);
  }

  async recordShopifyCall(responseTimeMs: number): Promise<void> {
    this.persistenceService.recordShopifyMetric(responseTimeMs);
  }

  async getMetrics(): Promise<ProductStats> {
    return await this.persistenceService.getMetrics();
  }

  async resetMetrics(): Promise<void> {
    this.persistenceService.resetMetrics();
  }
}