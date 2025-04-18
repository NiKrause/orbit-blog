import { setupTestEnvironment } from './setup';

export default async function globalSetup() {
    console.log('Running global setup...');
    await setupTestEnvironment();
} 