process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '4';

if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--max-old-space-size=2048';
}

const { execSync } = require('child_process');

try {
  console.log('Running Prisma generate...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('Running Next.js build with limited workers...');
  execSync('next build', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
