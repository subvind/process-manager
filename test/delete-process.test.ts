import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) delete process test');

  console.log('Testing: should be able to delete a process over api');

  try {
    // First, get all processes
    const listResponse = await request(API_URL).get('/processes');
    
    if (listResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${listResponse.status}`);
    }

    if (listResponse.body.length === 0) {
      throw new Error('No processes found to delete');
    }

    const processToDelete = listResponse.body[0];

    console.log(`Attempting to delete process with id: ${processToDelete.id}`);

    const deleteResponse = await request(API_URL)
      .delete(`/processes/${processToDelete.id}`);

    if (deleteResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${deleteResponse.status}`);
    }

    console.log('Delete process response:', deleteResponse.body);

    if (!deleteResponse.body.message.includes('has been deleted')) {
      throw new Error(`Expected message to include 'has been deleted', got '${deleteResponse.body.message}'`);
    }

    console.log('Verifying that the process has been deleted');
    const processInfoResponse = await request(API_URL).get(`/processes/${processToDelete.id}`);
    
    if (processInfoResponse.status !== 404) {
      throw new Error(`Expected status 404, got ${processInfoResponse.status}`);
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