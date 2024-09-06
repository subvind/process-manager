import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProcessManagerService } from '../src/services/process-manager.service';

async function runTests() {
  console.log('Starting ProcessController (e2e) tests');

  let app: INestApplication;
  let processManagerService: ProcessManagerService;

  console.log('Setting up test module');
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  processManagerService = moduleFixture.get<ProcessManagerService>(ProcessManagerService);
  await app.init();

  console.log('Testing: should be able to start a hello world node.js process over api');
  const helloWorldScript = `
    console.log('Hello, World!');
    setInterval(() => {
      console.log('Still running...');
    }, 1000);
  `;

  try {
    const response = await request(app.getHttpServer())
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
    const processInfo = await processManagerService.getProcessInfo(response.body.id);
    
    if (processInfo.status !== 'running') {
      throw new Error(`Expected process status to be 'running', got '${processInfo.status}'`);
    }

    console.log('Test passed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    console.log('Closing the application');
    await app.close();
  }
}

runTests().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});