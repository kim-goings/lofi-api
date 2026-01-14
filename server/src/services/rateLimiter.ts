/**
 * handle shopify rate limiting   
 * assumes 'standard' limit of 50pts/second
 * max bucket: 1000 pts
 * 
 */

import type { ProductsPersistenceService } from "../persistence/productsPersistenceService.js";

export class RateLimiter {
  private static readonly MAX_POINTS = 1000;
  private static readonly REFILL_RATE = 50; // points per second

  //we need to track the bucket state across all instances
  private persistenceService!: ProductsPersistenceService;

  constructor(persistenceService: ProductsPersistenceService) {
    this.persistenceService = persistenceService
  }


  /**
   * check if enough points are available for a query
   * @param queryComplexity cost in points 
   */
  async canExecute(queryComplexity: number = 5): Promise<boolean> {
    console.debug(`Checking if ${queryComplexity} rate limit points are available`);
    const availablePoints = await this.refillBucket();
    console.debug(`Available rate limit points: ${availablePoints}`);
    return availablePoints >= queryComplexity;
  }

  /**
   * consume points for a query execution
   * @param queryComplexity cost in points
   */
  consume(queryComplexity: number = 5): void {
    console.debug(`Consuming ${queryComplexity} rate limit points`);
    this.persistenceService.getRateLimitState().then(state => {
      if (state) {
        this.persistenceService.updateRateLimitState(
          state.points - queryComplexity,
          state.lastRefillTime
        );
      }
    });
  }

  /**
   * calculate current available points by simulating bucket refill
   */
  private async refillBucket(): Promise<number> {
    const now = Date.now();
    const state = await this.persistenceService.getRateLimitState() || { points: RateLimiter.MAX_POINTS, lastRefillTime: now };
    const timeSinceLastRefill = (now - state.lastRefillTime) / 1000; // convert to seconds
    const pointsToAdd = timeSinceLastRefill * RateLimiter.REFILL_RATE;
    const availablePoints = Math.min(RateLimiter.MAX_POINTS, state.points + pointsToAdd);
    this.persistenceService.updateRateLimitState(
      availablePoints,
      now
    );
    //return the points after refill
    return availablePoints;
  }
  /**
   * calculate wait time in milliseconds until enough points are available
   */
  getWaitTimeMs(queryComplexity: number = 5): Promise<number> {
    return this.refillBucket().then(points => {
      if (points >= queryComplexity) {
        return 0;
      }
      const pointsNeeded = queryComplexity - points;
      const secondsToWait = pointsNeeded / RateLimiter.REFILL_RATE;
      return Math.ceil(secondsToWait * 1000);
    });
  }

}