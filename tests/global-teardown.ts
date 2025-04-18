import { teardownTestEnvironment } from './setup';

export default async function globalTeardown() {
    console.log('Running global teardown...');
    await teardownTestEnvironment();
} 