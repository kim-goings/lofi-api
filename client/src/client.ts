import type { ProductResponse, Product, ProductStats } from "./types.js";
import axios from 'axios';

export class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    protected async get<T>(endpoint: string): Promise<T> {
        console.debug(`creating client for ${this.baseUrl}${endpoint}`);
        const api = axios.create({
            baseURL: `${this.baseUrl}`,
            timeout: 10000,
        });
        console.debug(`Making GET request to ${this.baseUrl}${endpoint}`);
        //const response = await api.get<T>(endpoint);
        const response = await api.get(endpoint);
        if (!response.status.toString().startsWith('2')) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        return response.data as Promise<T>;
    }

    public async getProducts(limit: number = 10, cursor?: string): Promise<ProductResponse> {
        let endpoint = `/products?limit=${limit}`;
        if (cursor) {
            endpoint += `&cursor=${cursor}`;
        }
        return this.get(endpoint);
    }

    public async getProductById(productId: string): Promise<Product> {
        const endpoint = `/products/${productId}`;
        return this.get(endpoint);
    }

    public async getStats(): Promise<ProductStats> {
        const endpoint = `/api-stats`;
        console.debug(`Fetching stats from ${endpoint}`);
        return this.get(endpoint);
    }
}

