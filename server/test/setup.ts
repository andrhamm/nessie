// Global test setup
// Set required env vars for tests so config.ts doesn't throw
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "sk-ant-test-key-for-tests";
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "el-test-key-for-tests";
process.env.NODE_ENV = "test";
