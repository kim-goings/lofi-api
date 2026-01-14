import { ApiClient } from "./client.js";

export default class LOFISDK {
    private apiClient: ApiClient;
 
    constructor(baseUrl: string) {
        this.apiClient = new ApiClient(baseUrl);
    }
}
