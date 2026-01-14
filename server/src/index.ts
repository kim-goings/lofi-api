import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { ProductService } from './services/productService.js';
import { MetricsService } from './services/metricsService.js';

interface Env {
  Variables: {
    productService: ProductService;
    metricsService: MetricsService;
    startTime: number;
  };
}

export const app = new Hono<Env>();

let productService: ProductService;
let metricsService: MetricsService;

/**
 * middleware: track request start time and initialize services
 */
app.use('*', async (c, next) => {
  if (!productService) {
    await initializeServices();
  }
  preProcess(c);
  await next();
  postProcess(c);
});

async function initializeServices(): Promise<void> {

  metricsService = await MetricsService.getInstance();
  productService = await ProductService.getInstance();

}

/**
 * GET /products
 * Fetch a list of products with cursor-based pagination
 * Query params: limit (default 10), cursor (for pagination)
 */
app.get('/products', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const cursor = c.req.query('cursor') || null;

  if (isNaN(limit) || limit < 1) {
    return c.json({ error: 'Invalid limit parameter' }, 400);
  }

  console.info(`Fetching products list with limit=${limit} and cursor=${cursor}`);
  const ps = c.get('productService');
  const page = await ps.listProducts(limit, cursor);

  return c.json({
    products: page.edges.map((edge) => edge.node),
    nextPage: page.edges.length > 0 ? page.edges[page.edges.length - 1].cursor : null,
  });
});


/**
 * GET /products/:id
 * Return detailed information of a single product by ID
 */
app.get('/products/:id', async (c) => {
  const id = c.req.param('id');

  const ps = c.get('productService');
  const product = await ps.getProductById(id);

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  return c.json(product);
});


/**
 * GET /api-stats
 */
app.get('/api-stats', async (c) => {
  const ms = c.get('metricsService');
  const stats = await ms.getMetrics();

  return c.json(stats);
});

/**
 * POST /reset-stats
 */
app.post('/reset-stats', async (c) => {
  const ms = c.get('metricsService');
  await ms.resetMetrics();
  return c.text('Metrics reset successfully');
});

const preProcess = (c: Context<Env, "*", any>) => {
  c.set('startTime', Date.now());
  c.set('productService', productService);
  c.set('metricsService', metricsService);
}

const postProcess = async (c: Context<Env, "*", any>) => {
  // record endpoint metrics
  const startTime = c.get('startTime');
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  metricsService.recordEndpointCall(responseTime);
}

if (process.env.NODE_ENV !== 'test') {
  initializeServices().then(() => {
    serve({
      fetch: app.fetch,
      port: 3000
    }, (info) => {
      console.log(`Server is running on http://localhost:${info.port}`)
    });
  });
}


