import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) list processes test');

  console.log('Testing: should be able to list all processes over api');

  try {
    const response = await request(API_URL).get('/processes');

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    console.log('List processes response:', response.body);

    if (!Array.isArray(response.body)) {
      throw new Error('Response body should be an array');
    }

    // Check if each process in the list has the expected properties
    const expectedFields = ['id', 'name', 'command', 'status', 'pid', 'cpu', 'memory', 'maxMemory', 'createdAt', 'updatedAt'];
    for (const process of response.body) {
      for (const field of expectedFields) {
        if (!(field in process)) {
          throw new Error(`Expected field '${field}' not found in process ${process.id}`);
        }
      }
    }

    console.log(`Successfully listed ${response.body.length} processes`);
    console.log('Test passed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});