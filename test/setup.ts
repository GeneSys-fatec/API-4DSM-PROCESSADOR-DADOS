// test/setup.ts

// Setup global para testes
beforeAll(() => {
  console.log('🧪 Iniciando suite de testes...');
});

afterAll(() => {
  console.log('✅ Suite de testes finalizada');
});

// Mock de variáveis de ambiente
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.RECEPTOR_URL = 'http://localhost:5000';
process.env.PORT = '3000';
