import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) stop process test');

  console.log('Testing: should be able to stop a running process over api');

  try {
    // First, get all running processes
    const listResponse = await request(API_URL).get('/processes');
    
    if (listResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${listResponse.status}`);
    }

    const runningProcesses = listResponse.body.filter(process => process.status === 'running');

    if (runningProcesses.length === 0) {
      throw new Error('No running processes found to stop');
    }

    const processToStop = runningProcesses[0];

    console.log(`Attempting to stop process with id: ${processToStop.id}`);

    const stopResponse = await request(API_URL)
      .post(`/processes/${processToStop.id}/stop`);

    if (stopResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${stopResponse.status}`);
    }

    console.log('Stop process response:', stopResponse.body);

    if (stopResponse.body.status !== 'stopped') {
      throw new Error(`Expected status to be 'stopped', got '${stopResponse.body.status}'`);
    }

    console.log('Waiting for 2 seconds to ensure the process has stopped');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Verifying that the process is stopped');
    const processInfoResponse = await request(API_URL).get(`/processes/${processToStop.id}`);
    
    if (processInfoResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${processInfoResponse.status}`);
    }

    const processInfo = processInfoResponse.body;
    
    if (processInfo.status !== 'stopped') {
      throw new Error(`Expected process status to be 'stopped', got '${processInfo.status}'`);
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