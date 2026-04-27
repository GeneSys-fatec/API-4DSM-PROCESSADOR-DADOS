// test/deduplicator.test.ts

import { isDuplicata, clearCache, isDuplicataAsync, estatisticasDuplicatas } from '../src/deduplicator';
import { SensorPluviometro } from '../src/types';
import { Collection } from 'mongodb';

describe('Deduplicador - Detecção de Leituras Duplicadas', () => {
  describe('isDuplicata - Cache em Memória', () => {
    beforeEach(() => {
      clearCache();
    });

    const sensorBase: SensorPluviometro = {
      uid: 'PLUVIOMETRO-001',
      unixtime: 1702834800,
      chuva_mm: 5.0,
      umidade: 65,
      temperatura: 22.3
    };

    it('deve retornar false para primeira leitura', () => {
      // Act
      const resultado = isDuplicata(sensorBase);

      // Assert
      expect(resultado).toBe(false);
    });

    it('deve retornar true para segunda leitura com uid e unixtime iguais', () => {
      // Arrange
      isDuplicata(sensorBase); // Primeira leitura

      // Act
      const resultado = isDuplicata(sensorBase);

      // Assert
      expect(resultado).toBe(true);
    });

    it('deve usar uid e unixtime como chave de duplicação', () => {
      // Arrange
      const primeira = { ...sensorBase, chuva_mm: 5.0 };
      const segunda = { ...sensorBase, chuva_mm: 10.0 }; // Mesmo uid e unixtime, dados diferentes

      // Act
      isDuplicata(primeira);
      const resultado = isDuplicata(segunda);

      // Assert
      expect(resultado).toBe(true); // Mesma chave uid+unixtime, mesmo com dados diferentes
    });

    it('deve diferenciar sensores por UID', () => {
      // Arrange
      const sensor1 = { ...sensorBase, uid: 'PLUVIOMETRO-001' };
      const sensor2 = { ...sensorBase, uid: 'PLUVIOMETRO-002' };

      isDuplicata(sensor1);

      // Act
      const resultado = isDuplicata(sensor2);

      // Assert
      expect(resultado).toBe(false); // UIDs diferentes
    });

    it('deve diferenciar sensores por timestamp', () => {
      // Arrange
      const sensor1 = { ...sensorBase, unixtime: 1702834800 };
      const sensor2 = { ...sensorBase, unixtime: 1702834801 };

      isDuplicata(sensor1);

      // Act
      const resultado = isDuplicata(sensor2);

      // Assert
      expect(resultado).toBe(false); // Timestamps diferentes
    });

    it('deve limpar cache corretamente', () => {
      // Arrange
      isDuplicata(sensorBase);
      expect(isDuplicata(sensorBase)).toBe(true); // Em cache

      // Act
      clearCache();

      // Assert
      expect(isDuplicata(sensorBase)).toBe(false); // Após clear
    });

    it('deve lidar com múltiplos sensores diferentes', () => {
      // Arrange
      const sensor1 = { ...sensorBase, uid: 'PLUVIOMETRO-001' };
      const sensor2 = { ...sensorBase, uid: 'QUALIDADE_AR-001' };
      const sensor3 = { ...sensorBase, uid: 'SOLO-001' };

      // Act & Assert
      expect(isDuplicata(sensor1)).toBe(false);
      expect(isDuplicata(sensor2)).toBe(false);
      expect(isDuplicata(sensor3)).toBe(false);
      expect(isDuplicata(sensor1)).toBe(true); // Repetição
    });
  });

  describe('isDuplicataAsync - Persistência no MongoDB', () => {
    let colecaoDuplicatasMock: Partial<Collection>;

    beforeEach(() => {
      clearCache();
      colecaoDuplicatasMock = {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' })
      };
    });

    const sensorBase: SensorPluviometro = {
      uid: 'PLUVIOMETRO-001',
      unixtime: 1702834800,
      chuva_mm: 5.0,
      umidade: 65,
      temperatura: 22.3
    };

    it('deve retornar false para primeira ocorrência', async () => {
      // Act
      const resultado = await isDuplicataAsync(sensorBase, colecaoDuplicatasMock as Collection);

      // Assert
      expect(resultado).toBe(false);
      expect(colecaoDuplicatasMock.insertOne).toHaveBeenCalled();
    });

    it('deve retornar true se encontrado no MongoDB', async () => {
      // Arrange
      const jaExistente = { chave: 'PLUVIOMETRO-001_1702834800' };
      (colecaoDuplicatasMock.findOne as jest.Mock).mockResolvedValueOnce(jaExistente);

      // Act
      const resultado = await isDuplicataAsync(sensorBase, colecaoDuplicatasMock as Collection);

      // Assert
      expect(resultado).toBe(true);
      expect(colecaoDuplicatasMock.insertOne).not.toHaveBeenCalled();
    });

    it('deve retornar true para segunda ocorrência (cache em memória)', async () => {
      // Arrange
      (colecaoDuplicatasMock.findOne as jest.Mock).mockResolvedValue(null);

      // Primeira chamada
      await isDuplicataAsync(sensorBase, colecaoDuplicatasMock as Collection);

      // Act - Segunda chamada (usa cache)
      const resultado = await isDuplicataAsync(sensorBase, colecaoDuplicatasMock as Collection);

      // Assert
      expect(resultado).toBe(true);
      // findOne chamado uma vez (segunda chamada usa cache)
      expect(colecaoDuplicatasMock.findOne).toHaveBeenCalledTimes(1);
    });

    it('deve incluir metadados ao inserir no MongoDB', async () => {
      // Act
      await isDuplicataAsync(sensorBase, colecaoDuplicatasMock as Collection);

      // Assert
      expect(colecaoDuplicatasMock.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          chave: 'PLUVIOMETRO-001_1702834800',
          uid: 'PLUVIOMETRO-001',
          unixtime: 1702834800,
          timestamp_deteccao: expect.any(Date)
        })
      );
    });
  });

  describe('estatisticasDuplicatas', () => {
    let colecaoDuplicatasMock: Partial<Collection>;

    beforeEach(() => {
      clearCache();
      colecaoDuplicatasMock = {
        countDocuments: jest.fn().mockResolvedValue(42)
      };
    });

    it('deve retornar estatísticas de cache e persistência', async () => {
      // Arrange
      const sensor = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 22.3
      } as SensorPluviometro;
      isDuplicata(sensor);
      isDuplicata(sensor);

      // Act
      const stats = await estatisticasDuplicatas(colecaoDuplicatasMock as Collection);

      // Assert
      expect(stats.total_em_cache).toBe(1);
      expect(stats.total_persistido).toBe(42);
    });
  });

  describe('Casos de Uso Realistas', () => {
    beforeEach(() => {
      clearCache();
    });

    it('deve detectar stream com duplicatas intercaladas', () => {
      // Arrange
      const sensor1 = { ...{ uid: 'PLUVIOMETRO-001', unixtime: 1702834800, chuva_mm: 5.0, umidade: 65, temperatura: 22.3 } } as SensorPluviometro;
      const sensor2 = { ...{ uid: 'PLUVIOMETRO-002', unixtime: 1702834800, chuva_mm: 3.0, umidade: 70, temperatura: 23.0 } } as SensorPluviometro;

      // Act & Assert
      expect(isDuplicata(sensor1)).toBe(false);
      expect(isDuplicata(sensor2)).toBe(false);
      expect(isDuplicata(sensor1)).toBe(true);
      expect(isDuplicata(sensor2)).toBe(true);
      expect(isDuplicata(sensor1)).toBe(true);
    });

    it('deve lidar com grande volume de sensores únicos', () => {
      // Arrange
      const sensoresUnicos = Array.from({ length: 100 }, (_, i) => ({
        uid: `SENSOR-${i}`,
        unixtime: 1702834800 + i,
        chuva_mm: Math.random() * 100,
        umidade: Math.random() * 100,
        temperatura: Math.random() * 30 - 10
      })) as SensorPluviometro[];

      // Act
      const resultados = sensoresUnicos.map(sensor => isDuplicata(sensor));

      // Assert
      expect(resultados.every(r => r === false)).toBe(true);
    });
  });
});

    it('deve diferenciar por uid', () => {
      // Arrange
      const primeira = { ...sensorOriginal, uid: 'PLUVIOMETRO-001' };
      const segunda = { ...sensorOriginal, uid: 'PLUVIOMETRO-002' };

      // Act
      isDuplicata(primeira);
      const resultado = isDuplicata(segunda);

      // Assert
      expect(resultado).toBe(false); // UIDs diferentes
    });

    it('deve diferenciar por unixtime', () => {
      // Arrange
      const primeira = { ...sensorOriginal, unixtime: 1702834800 };
      const segunda = { ...sensorOriginal, unixtime: 1702834801 };

      // Act
      isDuplicata(primeira);
      const resultado = isDuplicata(segunda);

      // Assert
      expect(resultado).toBe(false); // Timestamps diferentes
    });

    it('deve detectar duplicatas para múltiplos sensores', () => {
      // Arrange
      const sensor1 = { ...sensorOriginal, uid: 'SENSOR-001', unixtime: 1000 };
      const sensor2 = { ...sensorOriginal, uid: 'SENSOR-002', unixtime: 2000 };
      const sensor1Duplicado = { ...sensorOriginal, uid: 'SENSOR-001', unixtime: 1000 };

      // Act
      isDuplicata(sensor1);
      isDuplicata(sensor2);
      const resultado = isDuplicata(sensor1Duplicado);

      // Assert
      expect(resultado).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('deve limpar o cache de duplicatas', () => {
      // Arrange
      const sensor: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      isDuplicata(sensor); // Adiciona à cache
      clearCache(); // Limpa cache
      const resultado = isDuplicata(sensor); // Mesma leitura após cache limpo

      // Assert
      expect(resultado).toBe(false); // Não é mais considerada duplicata
    });

    it('deve permitir reutilização de chaves após limpeza', () => {
      // Arrange
      const sensor: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.0,
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      isDuplicata(sensor);
      isDuplicata(sensor);
      clearCache();
      const primeiraAposLimpeza = isDuplicata(sensor);
      const segundaAposLimpeza = isDuplicata(sensor);

      // Assert
      expect(primeiraAposLimpeza).toBe(false);
      expect(segundaAposLimpeza).toBe(true);
    });
  });

  describe('Casos extremos', () => {
    it('deve lidar com sensores com UIDs muito similares', () => {
      // Arrange
      const sensor1 = {
        uid: 'SENSOR-001',
        unixtime: 1000,
        chuva_mm: 5,
        umidade: 65,
        temperatura: 22.3
      } as SensorPluviometro;

      const sensor2 = {
        uid: 'SENSOR-0010',
        unixtime: 1000,
        chuva_mm: 5,
        umidade: 65,
        temperatura: 22.3
      } as SensorPluviometro;

      // Act
      isDuplicata(sensor1);
      const resultado = isDuplicata(sensor2);

      // Assert
      expect(resultado).toBe(false);
    });

    it('deve lidar com timestamps 0', () => {
      // Arrange
      const sensor = {
        uid: 'SENSOR-001',
        unixtime: 0,
        chuva_mm: 5,
        umidade: 65,
        temperatura: 22.3
      } as SensorPluviometro;

      // Act
      isDuplicata(sensor);
      const resultado = isDuplicata(sensor);

      // Assert
      expect(resultado).toBe(true);
    });

    it('deve lidar com UIDs contendo caracteres especiais', () => {
      // Arrange
      const sensor1 = {
        uid: 'SENSOR@001',
        unixtime: 1000,
        chuva_mm: 5,
        umidade: 65,
        temperatura: 22.3
      } as SensorPluviometro;

      const sensor2 = {
        uid: 'SENSOR@001',
        unixtime: 1000,
        chuva_mm: 5,
        umidade: 65,
        temperatura: 22.3
      } as SensorPluviometro;

      // Act
      isDuplicata(sensor1);
      const resultado = isDuplicata(sensor2);

      // Assert
      expect(resultado).toBe(true);
    });
  });
});
