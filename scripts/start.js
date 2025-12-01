#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('🔄 Running database migrations...');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });

console.log('🚀 Starting Next.js application...');
execSync('next start', { stdio: 'inherit' });

