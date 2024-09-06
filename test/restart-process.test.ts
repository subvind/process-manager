import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) restart process test');

  console.log('Testing: should be able to restart a running process over api');

  try {
    // First, get all running processes
    const listResponse = await request(API_URL).get('/processes');
    
    if (listResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${listResponse.status}`);
    }

    const runningProcesses = listResponse.body.filter(process => process.status === 'running');

    if (runningProcesses.length === 0) {
      throw new Error('No running processes found to restart');
    }

    const processToRestart = runningProcesses[0];

    console.log(`Attempting to restart process with id: ${processToRestart.id}`);

    const restartResponse = await request(API_URL)
      .post(`/processes/${processToRestart.id}/restart`);

    if (restartResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${restartResponse.status}`);
    }

    console.log('Restart process response:', restartResponse.body);

    if (restartResponse.body.status !== 'running') {
      throw new Error(`Expected status to be 'running', got '${restartResponse.body.status}'`);
    }

    console.log('Waiting for 5 seconds to ensure the process has restarted and stabilized');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Verifying that the process is running');
    const processInfoResponse = await request(API_URL).get(`/processes/${processToRestart.id}`);
    
    if (processInfoResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${processInfoResponse.status}`);
    }

    const processInfo = processInfoResponse.body;
    
    if (processInfo.status !== 'running') {
      throw new Error(`Expected process status to be 'running', got '${processInfo.status}'`);
    }

    if (processInfo.restartAttempts <= processToRestart.restartAttempts) {
      throw new Error(`Expected restart attempts to increase, but it didn't`);
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