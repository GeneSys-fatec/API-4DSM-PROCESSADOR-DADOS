// test/validators.test.ts

import { validarRange, getTipo, RANGES } from '../src/validators';
import { SensorPluviometro, SensorQualidadeAr, SensorSolo } from '../src/types';

describe('Validadores', () => {
  describe('getTipo', () => {
    it('deve retornar pluviometro para UID contendo PLUVIOMETRO', () => {
      // Act
      const tipo = getTipo('PLUVIOMETRO-001');

      // Assert
      expect(tipo).toBe('pluviometro');
    });

    it('deve retornar qualidade_ar para UID contendo QUALIDADE_AR', () => {
      // Act
      const tipo = getTipo('QUALIDADE_AR-001');

      // Assert
      expect(tipo).toBe('qualidade_ar');
    });

    it('deve retornar solo para UID contendo SOLO', () => {
      // Act
      const tipo = getTipo('SOLO-001');

      // Assert
      expect(tipo).toBe('solo');
    });

    it('deve retornar desconhecido para UID não reconhecido', () => {
      // Act
      const tipo = getTipo('SENSOR-DESCONHECIDO');

      // Assert
      expect(tipo).toBe('desconhecido');
    });
  });

  describe('validarRange - Pluviômetro', () => {
    const sensorValido: SensorPluviometro = {
      uid: 'PLUVIOMETRO-001',
      unixtime: 1702834800,
      chuva_mm: 5.0,
      umidade: 65,
      temperatura: 22.3
    };

    it('deve validar sensor com valores válidos', () => {
      // Act
      const resultado = validarRange(sensorValido, 'pluviometro');

      // Assert
      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toEqual([]);
    });

    it('deve rejeitar chuva_mm fora do range', () => {
      // Arrange
      const sensor = { ...sensorValido, chuva_mm: 1500 };

      // Act
      const resultado = validarRange(sensor, 'pluviometro');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.length).toBeGreaterThan(0);
      expect(resultado.erros[0]).toContain('chuva_mm');
    });

    it('deve rejeitar umidade fora do range', () => {
      // Arrange
      const sensor = { ...sensorValido, umidade: 150 };

      // Act
      const resultado = validarRange(sensor, 'pluviometro');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('umidade'))).toBe(true);
    });

    it('deve rejeitar temperatura fora do range', () => {
      // Arrange
      const sensor = { ...sensorValido, temperatura: 100 };

      // Act
      const resultado = validarRange(sensor, 'pluviometro');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('temperatura'))).toBe(true);
    });

    it('deve rejeitar campo ausente', () => {
      // Arrange
      const sensor = { ...sensorValido, umidade: undefined } as any;

      // Act
      const resultado = validarRange(sensor, 'pluviometro');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('umidade'))).toBe(true);
    });
  });

  describe('validarRange - Qualidade do Ar', () => {
    const sensorValido: SensorQualidadeAr = {
      uid: 'QUALIDADE_AR-001',
      unixtime: 1702834800,
      co2: 450,
      pm25: 25,
      qualidade_index: 3
    };

    it('deve validar sensor com valores válidos', () => {
      // Act
      const resultado = validarRange(sensorValido, 'qualidade_ar');

      // Assert
      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toEqual([]);
    });

    it('deve rejeitar CO2 muito alto', () => {
      // Arrange
      const sensor = { ...sensorValido, co2: 6000 };

      // Act
      const resultado = validarRange(sensor, 'qualidade_ar');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('co2'))).toBe(true);
    });

    it('deve rejeitar PM2.5 negativo', () => {
      // Arrange
      const sensor = { ...sensorValido, pm25: -10 };

      // Act
      const resultado = validarRange(sensor, 'qualidade_ar');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('pm25'))).toBe(true);
    });
  });

  describe('validarRange - Solo', () => {
    const sensorValido: SensorSolo = {
      uid: 'SOLO-001',
      unixtime: 1702834800,
      umidade_solo: 45,
      ph: 6.5,
      temp_solo: 18
    };

    it('deve validar sensor com valores válidos', () => {
      // Act
      const resultado = validarRange(sensorValido, 'solo');

      // Assert
      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toEqual([]);
    });

    it('deve rejeitar pH muito ácido', () => {
      // Arrange
      const sensor = { ...sensorValido, ph: 2 };

      // Act
      const resultado = validarRange(sensor, 'solo');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('ph'))).toBe(true);
    });

    it('deve rejeitar pH muito alcalino', () => {
      // Arrange
      const sensor = { ...sensorValido, ph: 12 };

      // Act
      const resultado = validarRange(sensor, 'solo');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('ph'))).toBe(true);
    });
  });

  describe('validarRange - Tipo desconhecido', () => {
    it('deve retornar erro para tipo desconhecido', () => {
      // Arrange
      const sensor = { uid: 'test', unixtime: 1702834800 } as any;

      // Act
      const resultado = validarRange(sensor, 'tipo_inexistente');

      // Assert
      expect(resultado.valido).toBe(false);
      expect(resultado.erros[0]).toBe('Tipo de sensor desconhecido');
    });
  });

  describe('RANGES constante', () => {
    it('deve ter ranges para pluviometro', () => {
      expect(RANGES.pluviometro).toBeDefined();
      expect(RANGES.pluviometro.chuva_mm).toBeDefined();
      expect(RANGES.pluviometro.umidade).toBeDefined();
      expect(RANGES.pluviometro.temperatura).toBeDefined();
    });

    it('deve ter ranges para qualidade_ar', () => {
      expect(RANGES.qualidade_ar).toBeDefined();
      expect(RANGES.qualidade_ar.co2).toBeDefined();
      expect(RANGES.qualidade_ar.pm25).toBeDefined();
      expect(RANGES.qualidade_ar.qualidade_index).toBeDefined();
    });

    it('deve ter ranges para solo', () => {
      expect(RANGES.solo).toBeDefined();
      expect(RANGES.solo.umidade_solo).toBeDefined();
      expect(RANGES.solo.ph).toBeDefined();
      expect(RANGES.solo.temp_solo).toBeDefined();
    });
  });
});
