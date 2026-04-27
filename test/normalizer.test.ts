// test/normalizer.test.ts

import { normalizarLeitura, interpolarValor } from '../src/normalizer';
import { SensorPluviometro, SensorQualidadeAr, SensorSolo } from '../src/types';

describe('Normalizador - Normalização de Unidades de Medida', () => {
  describe('Normalização de Pluviômetro', () => {
    const sensorBruto: SensorPluviometro = {
      uid: 'PLUVIOMETRO-001',
      unixtime: 1702834800,
      chuva_mm: 5.0,
      umidade: 65,
      temperatura: 22.3
    };

    it('deve manter valores válidos como estão', () => {
      // Act
      const resultado = normalizarLeitura(sensorBruto, 'pluviometro') as SensorPluviometro;

      // Assert
      expect(resultado.chuva_mm).toBe(5.0);
      expect(resultado.umidade).toBe(65);
      expect(resultado.temperatura).toBe(22.3);
    });

    it('deve remover chuva negativa', () => {
      // Arrange
      const sensor = { ...sensorBruto, chuva_mm: -10.5 };

      // Act
      const resultado = normalizarLeitura(sensor, 'pluviometro') as SensorPluviometro;

      // Assert
      expect(resultado.chuva_mm).toBe(10.5); // valor absoluto
    });

    it('deve limitar umidade a 0-100%', () => {
      // Arrange
      const sensorAlto = { ...sensorBruto, umidade: 150 };
      const sensorBaixo = { ...sensorBruto, umidade: -50 };

      // Act
      const resultadoAlto = normalizarLeitura(sensorAlto, 'pluviometro') as SensorPluviometro;
      const resultadoBaixo = normalizarLeitura(sensorBaixo, 'pluviometro') as SensorPluviometro;

      // Assert
      expect(resultadoAlto.umidade).toBe(100);
      expect(resultadoBaixo.umidade).toBe(0);
    });

    it('deve manter temperatura como está (em °C)', () => {
      // Arrange
      const sensor = { ...sensorBruto, temperatura: 45.7 };

      // Act
      const resultado = normalizarLeitura(sensor, 'pluviometro') as SensorPluviometro;

      // Assert
      expect(resultado.temperatura).toBe(45.7);
    });
  });

  describe('Normalização de Qualidade do Ar', () => {
    const sensorBruto: SensorQualidadeAr = {
      uid: 'QUALIDADE_AR-001',
      unixtime: 1702834800,
      co2: 450,
      pm25: 25,
      qualidade_index: 3
    };

    it('deve manter valores válidos', () => {
      // Act
      const resultado = normalizarLeitura(sensorBruto, 'qualidade_ar') as SensorQualidadeAr;

      // Assert
      expect(resultado.co2).toBe(450);
      expect(resultado.pm25).toBe(25);
      expect(resultado.qualidade_index).toBe(3);
    });

    it('deve limitar CO2 a faixa normal 200-5000', () => {
      // Arrange
      const sensorAlto = { ...sensorBruto, co2: 6500 };
      const sensorBaixo = { ...sensorBruto, co2: 100 };

      // Act
      const resultadoAlto = normalizarLeitura(sensorAlto, 'qualidade_ar') as SensorQualidadeAr;
      const resultadoBaixo = normalizarLeitura(sensorBaixo, 'qualidade_ar') as SensorQualidadeAr;

      // Assert
      expect(resultadoAlto.co2).toBe(5000);
      expect(resultadoBaixo.co2).toBe(200);
    });

    it('deve remover PM2.5 negativo', () => {
      // Arrange
      const sensor = { ...sensorBruto, pm25: -15 };

      // Act
      const resultado = normalizarLeitura(sensor, 'qualidade_ar') as SensorQualidadeAr;

      // Assert
      expect(resultado.pm25).toBe(0);
    });

    it('deve normalizar índice de qualidade para 1-5', () => {
      // Arrange
      const sensorAlto = { ...sensorBruto, qualidade_index: 7.8 };
      const sensorBaixo = { ...sensorBruto, qualidade_index: 0.3 };

      // Act
      const resultadoAlto = normalizarLeitura(sensorAlto, 'qualidade_ar') as SensorQualidadeAr;
      const resultadoBaixo = normalizarLeitura(sensorBaixo, 'qualidade_ar') as SensorQualidadeAr;

      // Assert
      expect(resultadoAlto.qualidade_index).toBe(5);
      expect(resultadoBaixo.qualidade_index).toBe(1);
    });
  });

  describe('Normalização de Solo', () => {
    const sensorBruto: SensorSolo = {
      uid: 'SOLO-001',
      unixtime: 1702834800,
      umidade_solo: 45,
      ph: 6.5,
      temp_solo: 18
    };

    it('deve manter valores válidos', () => {
      // Act
      const resultado = normalizarLeitura(sensorBruto, 'solo') as SensorSolo;

      // Assert
      expect(resultado.umidade_solo).toBe(45);
      expect(resultado.ph).toBe(6.5);
      expect(resultado.temp_solo).toBe(18);
    });

    it('deve limitar umidade_solo a 0-100%', () => {
      // Arrange
      const sensorAlto = { ...sensorBruto, umidade_solo: 200 };
      const sensorBaixo = { ...sensorBruto, umidade_solo: -30 };

      // Act
      const resultadoAlto = normalizarLeitura(sensorAlto, 'solo') as SensorSolo;
      const resultadoBaixo = normalizarLeitura(sensorBaixo, 'solo') as SensorSolo;

      // Assert
      expect(resultadoAlto.umidade_solo).toBe(100);
      expect(resultadoBaixo.umidade_solo).toBe(0);
    });

    it('deve limitar pH a 3-10', () => {
      // Arrange
      const sensorMuitoAcido = { ...sensorBruto, ph: 1 };
      const sensorMuitoAlcalino = { ...sensorBruto, ph: 14 };

      // Act
      const resultadoAcido = normalizarLeitura(sensorMuitoAcido, 'solo') as SensorSolo;
      const resultadoAlcalino = normalizarLeitura(sensorMuitoAlcalino, 'solo') as SensorSolo;

      // Assert
      expect(resultadoAcido.ph).toBe(3);
      expect(resultadoAlcalino.ph).toBe(10);
    });

    it('deve manter temperatura como está (em °C)', () => {
      // Arrange
      const sensor = { ...sensorBruto, temp_solo: -5.2 };

      // Act
      const resultado = normalizarLeitura(sensor, 'solo') as SensorSolo;

      // Assert
      expect(resultado.temp_solo).toBe(-5.2);
    });
  });

  describe('Interpolação de Valores', () => {
    it('deve calcular média de valores válidos', () => {
      // Arrange
      const valores = [10, 20, 30];

      // Act
      const resultado = interpolarValor(valores);

      // Assert
      expect(resultado).toBe(20);
    });

    it('deve ignorar valores nulos/NaN', () => {
      // Arrange
      const valores = [10, null, 30, undefined, 50] as any;

      // Act
      const resultado = interpolarValor(valores);

      // Assert
      expect(resultado).toBe(30); // (10 + 30 + 50) / 3 = 30
    });

    it('deve retornar null se todos valores são nulos', () => {
      // Arrange
      const valores = [null, undefined, null];

      // Act
      const resultado = interpolarValor(valores);

      // Assert
      expect(resultado).toBeNull();
    });

    it('deve arredondar resultado para 2 casas decimais', () => {
      // Arrange
      const valores = [10.5, 20.7, 30.9];

      // Act
      const resultado = interpolarValor(valores);

      // Assert
      expect(resultado).toBe(20.7); // (10.5 + 20.7 + 30.9) / 3 = 20.7
    });

    it('deve lidar com um único valor válido', () => {
      // Arrange
      const valores = [42.5];

      // Act
      const resultado = interpolarValor(valores);

      // Assert
      expect(resultado).toBe(42.5);
    });
  });

  describe('Tipo de sensor desconhecido', () => {
    it('deve retornar dados sem modificação para tipo desconhecido', () => {
      // Arrange
      const sensor = {
        uid: 'SENSOR-NOVO',
        unixtime: 1702834800,
        valor: 999
      } as any;

      // Act
      const resultado = normalizarLeitura(sensor, 'tipo_novo');

      // Assert
      expect(resultado).toEqual(sensor);
    });
  });
});
