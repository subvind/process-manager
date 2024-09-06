import * as request from 'supertest';

const API_URL = 'http://localhost:9393';

async function runTests() {
  console.log('Starting ProcessController (e2e) tests');

  console.log('Testing: should be able to start a hello world node.js process over api');
  const helloWorldScript = `
    console.log('Hello, World!');
    setInterval(() => {
      console.log('Still running...');
    }, 1000);
  `;

  try {
    const response = await request(API_URL)
      .post('/processes')
      .send({
        name: 'hello-world',
        command: `node -e "${helloWorldScript}"`,
      });

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    console.log('Response body:', response.body);

    if (!response.body.id) {
      throw new Error('Response body should have an id property');
    }

    if (response.body.name !== 'hello-world') {
      throw new Error(`Expected name to be 'hello-world', got '${response.body.name}'`);
    }

    if (response.body.status !== 'running') {
      throw new Error(`Expected status to be 'running', got '${response.body.status}'`);
    }

    console.log('Waiting for 2 seconds to ensure the process has started');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Verifying that the process is running');
    const processInfoResponse = await request(API_URL).get(`/processes/${response.body.id}`);
    
    if (processInfoResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${processInfoResponse.status}`);
    }

    const processInfo = processInfoResponse.body;
    
    if (processInfo.status !== 'running') {
      throw new Error(`Expected process status to be 'running', got '${processInfo.status}'`);
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