import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProcessManagerService } from '../src/services/process-manager.service';

async function runTests() {
  console.log('Starting ProcessController (e2e) stop process test');

  let app: INestApplication;
  let processManagerService: ProcessManagerService;

  console.log('Setting up test module');
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  processManagerService = moduleFixture.get<ProcessManagerService>(ProcessManagerService);
  await app.init();

  console.log('Testing: should be able to stop a running process over api');

  try {
    // First, get all running processes
    const listResponse = await request(app.getHttpServer()).get('/processes');
    
    if (listResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${listResponse.status}`);
    }

    const runningProcesses = listResponse.body.filter(process => process.status === 'running');

    if (runningProcesses.length === 0) {
      throw new Error('No running processes found to stop');
    }

    const processToStop = runningProcesses[0];

    console.log(`Attempting to stop process with id: ${processToStop.id}`);

    const stopResponse = await request(app.getHttpServer())
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
    const processInfo = await processManagerService.getProcessInfo(processToStop.id);
    
    if (processInfo.status !== 'stopped') {
      throw new Error(`Expected process status to be 'stopped', got '${processInfo.status}'`);
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