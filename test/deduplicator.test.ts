// test/deduplicator.test.ts

import { isDuplicata, clearCache } from '../src/deduplicator';
import { SensorPluviometro } from '../src/types';

describe('Deduplicador', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('isDuplicata', () => {
    const sensorOriginal: SensorPluviometro = {
      uid: 'PLUVIOMETRO-001',
      unixtime: 1702834800,
      chuva_mm: 5.0,
      umidade: 65,
      temperatura: 22.3
    };

    it('deve retornar false para primeira leitura', () => {
      // Act
      const resultado = isDuplicata(sensorOriginal);

      // Assert
      expect(resultado).toBe(false);
    });

    it('deve retornar true para segunda leitura idêntica', () => {
      // Arrange
      isDuplicata(sensorOriginal); // Primeira leitura

      // Act
      const resultado = isDuplicata(sensorOriginal);

      // Assert
      expect(resultado).toBe(true);
    });

    it('deve usar uid e unixtime como chave de duplicação', () => {
      // Arrange
      const primeira = { ...sensorOriginal, chuva_mm: 5.0 };
      const segunda = { ...sensorOriginal, chuva_mm: 10.0 }; // Mesmo uid e unixtime

      // Act
      isDuplicata(primeira);
      const resultado = isDuplicata(segunda);

      // Assert
      expect(resultado).toBe(true); // Mesma chave, mesmo com dados diferentes
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
