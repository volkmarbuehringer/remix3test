export function globalSetup() {
  process.env.NODE_ENV = 'test'
  process.loadEnvFile('./.env')
}
