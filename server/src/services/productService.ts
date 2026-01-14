import axios, { type AxiosInstance } from 'axios';
import { RateLimiter } from './rateLimiter.js';
import { MetricsService } from './metricsService.js';
import { ProductsPersistenceService } from '../persistence/productsPersistenceService.js';

export interface Product {
  id: string;
  title: string;
  price: string;
  inventory: number;
  created_at: string;
}

export interface ProductResponse {
  edges: Array<{
    cursor: string;
    node: Product;
  }>;
  pageInfo: {
    hasNextPage: boolean;
  };
}

const GET_PRODUCTS_QUERY = `
  query ($first: Int!, $after: String, $sortKey: ProductSortKeys) {
    products(first: $first, after: $after, sortKey: $sortKey) {
      edges {
        cursor
        node {
          id
          title
          priceRange {
            minVariantPrice {
              amount
            }
          }
          totalInventory
          createdAt
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

const GET_PRODUCT_BY_ID_QUERY = `
  query ($id: ID!) {
    product(id: $id) {
      id
      title
      priceRange {
        minVariantPrice {
          amount
        }
      }
      totalInventory
      createdAt
    }
  }
`;


export class ProductService {
  private shopId: string = process.env.SHOP_ID || '';
  private token: string = process.env.SHOP_TOKEN || '';

  private api!: AxiosInstance;
  private metricsService!: MetricsService;
  private persistenceService!: ProductsPersistenceService;

  private rateLimiter!: RateLimiter;
  private apiVersion = '2024-01';

  private static instance: ProductService;

  private constructor(productsPersistenceService: ProductsPersistenceService) {
    this.persistenceService = productsPersistenceService;

    this.rateLimiter = new RateLimiter(this.persistenceService);

    if (this.shopId === '' || this.token === '') {
      throw new Error('SHOP_ID and SHOP_TOKEN must be set as environment variables');
    }

    this.api = axios.create({
      baseURL: `https://${this.shopId}/admin/api/${this.apiVersion}`,
      headers: {
        'X-Shopify-Access-Token': this.token,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  static async getInstance(): Promise<ProductService> {
    if (null == ProductService.instance) {
      const persistenceService = new ProductsPersistenceService();
      await persistenceService.connect();

      const ps = new ProductService(persistenceService);
      ps.metricsService = await MetricsService.getInstance();
      ProductService.instance = ps;
    }
    return ProductService.instance;
  }

  /**
  * get a single product by ID
  */
  async getProductById(id: string): Promise<Product | null> {
    try {

      id = `gid://shopify/Product/${id}`;
      console.info(`Fetching product by ID: ${id}`);

      // check cache first
      const cached = await this.persistenceService.getCachedProduct(id);
      if (cached) {
        console.info('Returning product from cache');
        return cached;
      }

      // Query Shopify
      console.info('Product not in cache, querying Shopify');
      const response = await this.executeQuery<any>(GET_PRODUCT_BY_ID_QUERY, { id });

      if (!response.product) {
        return null;
      }

      const product = this.marshallProduct(response.product);

      // Cache the result
      this.persistenceService.cacheProduct(id, product);

      return product;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }

  /**
   * List products sorted by title with cursor-based pagination
   */
  async listProducts(limit: number = 10, cursor: string | null = null): Promise<ProductResponse> {
    try {
      // Shopify's maximum
      const first = Math.min(Math.max(1, limit), 250);

      // Check cache first
      const cached = await this.persistenceService.getCachedProductsList(cursor);
      if (cached && cached.edges.length >= limit) {
        console.info('Returning products list from cache');
        return cached;
      }

      // Query Shopify
      const response = await this.executeQuery<any>(GET_PRODUCTS_QUERY, {
        first,
        after: cursor || null,
        sortKey: 'TITLE',
      });

      const edges = response.products.edges.map((edge: any) => ({
        cursor: edge.cursor,
        node: this.marshallProduct(edge.node),
      }));

      const page: ProductResponse = {
        edges,
        pageInfo: response.products.pageInfo,
      };

      // cache the result
      this.persistenceService.cacheProductsList(cursor, page);

      return page;
    } catch (error) {
      console.error('Error listing products:', error);
      return {
        edges: [],
        pageInfo: { hasNextPage: false },
      };
    }
  }
  /**
   * execute a GraphQL query with rate limiting
   */
  //but this doesn't handle the response time issue, like, at all 
  //the spec indicates that cursor should be a part of the client request, so i guess this is acceptable? 
  //i don't see how queuing would help here as there is no def in the spec for polling, etc. 
  private async executeQuery<T>(query: string, variables?: Record<string, any>): Promise<T> {
    console.debug('Executing Shopify GraphQL query');
    // check rate limit and wait if necessary
    const queryComplexity = 10; // avg query complexity
    if (!this.rateLimiter.canExecute(queryComplexity)) {
      const waitTime = await this.rateLimiter.getWaitTimeMs(queryComplexity);
      console.log(`Rate limit: waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }

    console.debug("Sending GraphQL request to Shopify");
    const startTime = Date.now();
    try {
      const response = await this.api.post<any>('graphql.json', {
        query,
        variables,
      });
      console.debug("Received GraphQL response from Shopify");
      // consume rate limit points
      this.rateLimiter.consume(response.data.extensions.cost.actualQueryCost);

      const endTime = Date.now();
      this.metricsService.recordShopifyCall(endTime - startTime);

      if (response.data.errors) {
        const errorMessage = response.data.errors
          .map((e: any) => e.message)
          .join('; ');
        throw new Error(`GraphQL Error: ${errorMessage}`);
      }

      return response.data.data as T;
    } catch (error) {
      const endTime = Date.now();
      this.metricsService.recordShopifyCall(endTime - startTime);
      throw error;
    }
  }

  /**
   * Utility to sleep for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * transform raw product data to Product interface
   */
  private marshallProduct(node: any): Product {
    return {
      id: node.id,
      title: node.title,
      price: node.priceRange?.minVariantPrice?.amount || '0',
      inventory: node.totalInventory || 0,
      created_at: node.createdAt,
    };
  }

}


