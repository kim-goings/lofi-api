export type ProductResponse = {
    /**
     * A list of products
     */
    products?: Array<{
        id?: string;
        title?: string;
        price?: number;
        inventory?: number;
        created_at?: string;
    }>;
    next_cursor?: string;
};

export type Product = {
    /**
     * A product object
     */
    id?: string;
    title?: string;
    price?: number;
    inventory?: number;
    created_at?: string;
};

export type ProductStats = {
    /**
     * API usage statistics
     */
    endpoint_response_times_ms?: {
        average?: number;
        max?: number;
        min?: number;
    };
    total_endpoint_calls?: number;
    average_shopify_response_time_ms?: number;
    total_shopify_api_calls?: number;
};

