// test/receptor-client.test.ts

import axios from 'axios';
import { buscarDadosDoReceptor, iniciarSincronizacao } from '../src/receptor-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock de Collection do MongoDB
const mockCollection = {
  findOne: jest.fn(),
  insertOne: jest.fn(),
  find: jest.fn()
} as any;

describe('Receptor Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buscarDadosDoReceptor', () => {
    it('deve buscar dados do receptor e inserir na coleção raw', async () => {
      // Arrange
      const dadosSimulados = [
        {
          _id: '507f1f77bcf86cd799439011',
          uid: 'sensor-001',
          unixtime: 1702834800,
          chuva_mm: 2.5,
          umidade: 65,
          temperatura: 22.3
        },
        {
          _id: '507f1f77bcf86cd799439012',
          uid: 'sensor-002',
          unixtime: 1702834801,
          chuva_mm: 3.1,
          umidade: 68,
          temperatura: 21.8
        }
      ];

      mockedAxios.get.mockResolvedValue({ data: dadosSimulados });
      mockCollection.findOne.mockResolvedValue(null); // Não existe duplicata
      mockCollection.insertOne.mockResolvedValue({ insertedId: '123' });

      // Act
      const resultado = await buscarDadosDoReceptor(mockCollection);

      // Assert
      expect(resultado.novos).toBe(2);
      expect(resultado.erros).toBe(0);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/dados-brutos'),
        expect.any(Object)
      );
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(2);
    });

    it('deve evitar duplicatas', async () => {
      // Arrange
      const dados = [
        {
          _id: '507f1f77bcf86cd799439011',
          uid: 'sensor-001',
          unixtime: 1702834800,
          chuva_mm: 2.5,
          umidade: 65,
          temperatura: 22.3
        }
      ];

      mockedAxios.get.mockResolvedValue({ data: dados });
      // Simular que o documento já existe
      mockCollection.findOne.mockResolvedValue({ _id: dados[0]._id });

      // Act
      const resultado = await buscarDadosDoReceptor(mockCollection);

      // Assert
      expect(resultado.novos).toBe(0);
      expect(resultado.erros).toBe(0);
      expect(mockCollection.insertOne).not.toHaveBeenCalled();
    });

    it('deve retornar erro ao falhar na conexão', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      // Act
      const resultado = await buscarDadosDoReceptor(mockCollection);

      // Assert
      expect(resultado.novos).toBe(0);
      expect(resultado.erros).toBe(1);
    });

    it('deve adicionar timestamps ao inserir dados', async () => {
      // Arrange
      const dados = [
        {
          _id: '507f1f77bcf86cd799439011',
          uid: 'sensor-001',
          unixtime: 1702834800,
          chuva_mm: 2.5,
          umidade: 65,
          temperatura: 22.3
        }
      ];

      mockedAxios.get.mockResolvedValue({ data: dados });
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.insertOne.mockResolvedValue({ insertedId: '123' });

      // Act
      await buscarDadosDoReceptor(mockCollection);

      // Assert
      const insertedData = mockCollection.insertOne.mock.calls[0][0];
      expect(insertedData._processada).toBe(false);
      expect(insertedData._data_insercao).toBeInstanceOf(Date);
    });

    it('deve lidar com array vazio do receptor', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: [] });

      // Act
      const resultado = await buscarDadosDoReceptor(mockCollection);

      // Assert
      expect(resultado.novos).toBe(0);
      expect(resultado.erros).toBe(0);
      expect(mockCollection.insertOne).not.toHaveBeenCalled();
    });
  });

  describe('iniciarSincronizacao', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve executar sincronização imediata ao iniciar', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: [] });

      // Act
      iniciarSincronizacao(mockCollection, 30000);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('deve repetir sincronização no intervalo especificado', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: [] });
      const intervalo = 5000;

      // Act
      iniciarSincronizacao(mockCollection, intervalo);
      jest.advanceTimersByTime(intervalo);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Uma inicial + uma do intervalo
    });

    it('deve usar intervalo padrão de 30s se não especificado', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: [] });

      // Act
      iniciarSincronizacao(mockCollection);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });
});
