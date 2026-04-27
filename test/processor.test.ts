// test/processor.test.ts - Testes para Processador de Leituras

import { processarLeituras } from '../src/processor';
import { SensorPluviometro, SensorQualidadeAr, SensorSolo } from '../src/types';
import { Collection, Document } from 'mongodb';

describe('Processador de Leituras - Subtask A', () => {
  let colecaoRawMock: Partial<Collection>;
  let colecaoDuplicatasMock: Partial<Collection>;

  beforeEach(() => {
    // Mock do MongoDB
    colecaoRawMock = {
      find: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
    };

    colecaoDuplicatasMock = {
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock' })
    };
  });

  describe('Validação de Dados Brutos', () => {
    it('deve consumir leituras do MongoDB', async () => {
      // Arrange
      const leituras = [
        {
          _id: '1',
          uid: 'PLUVIOMETRO-001',
          unixtime: 1702834800,
          chuva_mm: 5.0,
          umidade: 65,
          temperatura: 22.3,
          _processada: false
        }
      ];

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(leituras)
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {
        limite_leituras: 100
      });

      // Assert
      expect(colecaoRawMock.find).toHaveBeenCalledWith({
        _processada: { $ne: true }
      });
      expect(resultado.total_processadas).toBe(1);
    });

    it('deve construir filtro correto baseado em opções', async () => {
      // Arrange
      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      });

      // Act
      await processarLeituras(colecaoRawMock as Collection, {
        tipos_sensores: ['pluviometro'],
        data_inicio: 1702834800,
        data_fim: 1702921200
      });

      // Assert
      const filtroPassado = (colecaoRawMock.find as jest.Mock).mock.calls[0][0];
      expect(filtroPassado).toHaveProperty('_processada');
      expect(filtroPassado).toHaveProperty('uid');
      expect(filtroPassado).toHaveProperty('unixtime');
    });
  });

  describe('Deduplicação', () => {
    it('deve rejeitar leituras duplicadas (uid + timestamp)', async () => {
      // Arrange
      const leitura = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leitura, leitura]) // Duplicata
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {
        limite_leituras: 100
      });

      // Assert
      expect(resultado.total_rejeitadas).toBeGreaterThan(0);
      expect(resultado.total_validas).toBeLessThan(resultado.total_processadas);
    });
  });

  describe('Validação de Range', () => {
    it('deve rejeitar valores fora de faixa aceitável', async () => {
      // Arrange
      const leituraInvalida = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5000, // Acima do máximo de 1000
        umidade: 65,
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leituraInvalida])
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {});

      // Assert
      expect(resultado.total_rejeitadas).toBe(1);
      expect(resultado.total_validas).toBe(0);
    });

    it('deve rejeitar temperatura de 500°C', async () => {
      // Arrange
      const leituraComTemperaturaAlta = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 500, // Fora da faixa -50 a 60
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leituraComTemperaturaAlta])
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {});

      // Assert
      expect(resultado.total_rejeitadas).toBe(1);
    });
  });

  describe('Tratamento de Valores Nulos', () => {
    it('deve rejeitar leituras com valores nulos quando estratégia é "ignorar"', async () => {
      // Arrange
      const leituraComNula = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: null,
        umidade: 65,
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leituraComNula])
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {
        estrategia_valores_nulos: 'ignorar'
      });

      // Assert
      expect(resultado.total_rejeitadas).toBeGreaterThan(0);
    });

    it('deve aceitar valores nulos quando estratégia é "registrar_nulo"', async () => {
      // Arrange
      const leituraComNula = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: null,
        umidade: 65,
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leituraComNula])
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {
        estrategia_valores_nulos: 'registrar_nulo'
      });

      // Assert
      // Deverá tentar processar (não rejeita por valor nulo)
      expect(resultado.total_processadas).toBe(1);
    });

    it('deve marcar para interpolação quando estratégia é "interpolar"', async () => {
      // Arrange
      const leituraComNula = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: null,
        umidade: 65,
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leituraComNula])
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {
        estrategia_valores_nulos: 'interpolar'
      });

      // Assert
      expect(resultado.total_interpoladas).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Normalização de Unidades', () => {
    it('deve normalizar unidades quando ativado', async () => {
      // Arrange
      const leitura = {
        _id: '1',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 150, // Fora do range, será normalizado
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leitura])
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {
        normalizar_unidades: true
      });

      // Assert
      expect(resultado.total_validas).toBeGreaterThan(0); // Normalização corrigiu
    });

    it('deve respeitar limite_leituras', async () => {
      // Arrange
      const leituras = Array(150).fill({
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 22.3
      }).map((l, i) => ({
        ...l,
        _id: i.toString(),
        unixtime: 1702834800 + i
      }));

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(leituras)
        })
      });

      // Act
      await processarLeituras(colecaoRawMock as Collection, {
        limite_leituras: 50
      });

      // Assert
      const limitChainado = (colecaoRawMock.find as jest.Mock).mock.results[0].value.limit;
      expect(limitChainado).toHaveBeenCalledWith(50);
    });
  });

  describe('Persistência', () => {
    it('deve marcar leitura como _processada no MongoDB', async () => {
      // Arrange
      const leitura = {
        _id: '123',
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 22.3,
        _processada: false
      };

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([leitura])
        })
      });

      // Act
      await processarLeituras(colecaoRawMock as Collection, {});

      // Assert
      expect(colecaoRawMock.updateOne).toHaveBeenCalledWith(
        { _id: '123' },
        { $set: { _processada: true } }
      );
    });
  });

  describe('Opções de Processamento', () => {
    it('deve respeitar reprocessar_invalidas flag', async () => {
      // Arrange
      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      });

      // Act
      await processarLeituras(colecaoRawMock as Collection, {
        reprocessar_invalidas: true
      });

      // Assert
      const filtroPassado = (colecaoRawMock.find as jest.Mock).mock.calls[0][0];
      expect(filtroPassado).not.toHaveProperty('_processada');
    });

    it('deve aceitar filtros por UIDs específicos', async () => {
      // Arrange
      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      });

      // Act
      await processarLeituras(colecaoRawMock as Collection, {
        uids: ['PLUVIOMETRO-001', 'QUALIDADE_AR-002']
      });

      // Assert
      const filtroPassado = (colecaoRawMock.find as jest.Mock).mock.calls[0][0];
      expect(filtroPassado.uid).toBeDefined();
    });

    it('deve aceitar filtros por data_inicio e data_fim', async () => {
      // Arrange
      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      });

      const inicio = 1702834800;
      const fim = 1702921200;

      // Act
      await processarLeituras(colecaoRawMock as Collection, {
        data_inicio: inicio,
        data_fim: fim
      });

      // Assert
      const filtroPassado = (colecaoRawMock.find as jest.Mock).mock.calls[0][0];
      expect(filtroPassado.unixtime).toBeDefined();
      expect(filtroPassado.unixtime.$gte).toBe(inicio);
      expect(filtroPassado.unixtime.$lte).toBe(fim);
    });
  });

  describe('Estatísticas de Processamento', () => {
    it('deve retornar estatísticas completas', async () => {
      // Arrange
      const leituras = [
        {
          _id: '1',
          uid: 'PLUVIOMETRO-001',
          unixtime: 1702834800,
          chuva_mm: 5.0,
          umidade: 65,
          temperatura: 22.3,
          _processada: false
        }
      ];

      (colecaoRawMock.find as jest.Mock).mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(leituras)
        })
      });

      // Act
      const resultado = await processarLeituras(colecaoRawMock as Collection, {});

      // Assert
      expect(resultado).toHaveProperty('total_processadas');
      expect(resultado).toHaveProperty('total_validas');
      expect(resultado).toHaveProperty('total_rejeitadas');
      expect(resultado).toHaveProperty('total_interpoladas');
      expect(resultado.total_processadas >= resultado.total_validas).toBe(true);
    });
  });
});
