
# LOFI-API TypeScript SDK 1.0.0-beta

Welcome to the LOFIAPI SDK documentation. This guide will help you get started with integrating and using the LOFIAPI SDK in your project.

## Versions

- SDK version: `1.0.0-beta`

## Installation & Use - Server

The server requires the following environment variables to be set: 

**SHOP_ID**

**SHOP_TOKEN**

**PRODUCT_DB_PASSWORD**

**METRICS_DB_PASSWORD**

*Your sales representative can provide these values for you.*


If you wish to self-host the cache and metrics DB, you may optionally specify: 

**METRICS_DB_URL**

**METRICS_DB_USERNAME**

**PRODUCT_DB_URL**

**PRODUCT_DB_USERNAME**

To run the server: 

```bash
cd server
npm install
npm run dev
```

```
open http://localhost:3000
```

# Sample Usage

Below is an example demonstrating how to use the SDK:

```ts
import LOFISDK from "../index.js";

const BASE_URL = 'http://localhost:3000';

async function main() {
  try {
    const lofiapi = new LOFISDK(BASE_URL);

    const stats = await lofiapi['apiClient'].getStats();
    console.log('Stats:', stats);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

The BASE_URL should be set to your own server (if self-hosting) or the server endpoint provided by your sales representative.  


## Installation & Run - Client SDK Example

```bash
cd client
npm install
npm run build
cd example
npm run start
```
  

Enjoy!  
