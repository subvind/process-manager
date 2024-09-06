import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) list processes test');

  console.log('Testing: should be able to list all processes over api');

  try {
    const response = await request(API_URL).get('/processes');

    console.log('Response status:', response.status);
    console.log('Response body:', response.body);

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.body)) {
      throw new Error('Response body should be an array');
    }

    console.log(`Successfully listed ${response.body.length} processes`);

    // Check if each process in the list has the expected properties
    const expectedFields = ['id', 'name', 'command', 'status', 'pid', 'cpu', 'memory', 'maxMemory', 'createdAt', 'updatedAt'];
    for (const process of response.body) {
      for (const field of expectedFields) {
        if (!(field in process)) {
          throw new Error(`Expected field '${field}' not found in process ${process.id}`);
        }
      }
    }

    console.log('All processes have the expected fields');
    console.log('Test passed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.body);
    }
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});