import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) info process test');

  console.log('Testing: should be able to get info about a process over api');

  try {
    // First, get all processes
    const listResponse = await request(API_URL).get('/processes');
    
    if (listResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${listResponse.status}`);
    }

    if (listResponse.body.length === 0) {
      throw new Error('No processes found to get info');
    }

    const processToCheck = listResponse.body[0];

    console.log(`Attempting to get info for process with id: ${processToCheck.id}`);

    const infoResponse = await request(API_URL).get(`/processes/${processToCheck.id}`);

    if (infoResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${infoResponse.status}`);
    }

    console.log('Process info response:', infoResponse.body);

    // Check if all expected fields are present
    const expectedFields = ['id', 'name', 'command', 'status', 'pid', 'cpu', 'memory', 'maxMemory', 'createdAt', 'updatedAt'];
    for (const field of expectedFields) {
      if (!(field in infoResponse.body)) {
        throw new Error(`Expected field '${field}' not found in process info`);
      }
    }

    // Check if the returned info matches the process we queried
    if (infoResponse.body.id !== processToCheck.id) {
      throw new Error(`Returned process id ${infoResponse.body.id} does not match requested id ${processToCheck.id}`);
    }

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