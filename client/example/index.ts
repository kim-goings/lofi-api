import LOFISDK from "../src/index.js"

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