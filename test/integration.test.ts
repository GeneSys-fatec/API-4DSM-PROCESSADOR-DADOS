// test/integration.test.ts

import { SensorPluviometro, SensorQualidadeAr } from '../src/types';
import { validarRange, getTipo } from '../src/validators';
import { isDuplicata, clearCache } from '../src/deduplicator';

describe('Teste de Integração - Pipeline de Processamento', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('Fluxo Completo de Leitura', () => {
    it('deve processar uma leitura válida do início ao fim', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-ESTACAO-001',
        unixtime: 1702834800,
        chuva_mm: 5.2,
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);
      const ehDuplicata = isDuplicata(leitura);

      // Assert
      expect(tipo).toBe('pluviometro');
      expect(validacao.valido).toBe(true);
      expect(ehDuplicata).toBe(false);
    });

    it('deve rejeitar leitura duplicada mesmo que válida', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.2,
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      const primeiraChecagem = isDuplicata(leitura);
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);
      const segundaChecagem = isDuplicata(leitura);

      // Assert
      expect(primeiraChecagem).toBe(false);
      expect(validacao.valido).toBe(true);
      expect(segundaChecagem).toBe(true); // É duplicata na segunda vez
    });

    it('deve rejeitar leitura inválida', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5000, // Fora do range
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);

      // Assert
      expect(validacao.valido).toBe(false);
      expect(validacao.erros.length).toBeGreaterThan(0);
    });
  });

  describe('Múltiplos Sensores', () => {
    it('deve processar múltiplos sensores de diferentes tipos', () => {
      // Arrange
      const pluviometro: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 5.2,
        umidade: 65,
        temperatura: 22.3
      };

      const qualidadeAr: SensorQualidadeAr = {
        uid: 'QUALIDADE_AR-001',
        unixtime: 1702834800,
        co2: 450,
        pm25: 25,
        qualidade_index: 3
      };

      // Act
      const tipoPluviometro = getTipo(pluviometro.uid);
      const validacaoPluviometro = validarRange(pluviometro, tipoPluviometro);

      const tipoQualidadeAr = getTipo(qualidadeAr.uid);
      const validacaoQualidadeAr = validarRange(qualidadeAr, tipoQualidadeAr);

      // Assert
      expect(tipoPluviometro).toBe('pluviometro');
      expect(validacaoPluviometro.valido).toBe(true);

      expect(tipoQualidadeAr).toBe('qualidade_ar');
      expect(validacaoQualidadeAr.valido).toBe(true);
    });

    it('deve detectar duplicatas entre múltiplas leituras', () => {
      // Arrange
      const leitura1: SensorPluviometro = {
        uid: 'SENSOR-001',
        unixtime: 1000,
        chuva_mm: 5,
        umidade: 65,
        temperatura: 22.3
      };

      const leitura2: SensorPluviometro = {
        uid: 'SENSOR-002',
        unixtime: 2000,
        chuva_mm: 3,
        umidade: 70,
        temperatura: 20.5
      };

      const leitura1Duplicada: SensorPluviometro = {
        uid: 'SENSOR-001',
        unixtime: 1000,
        chuva_mm: 10, // Valor diferente
        umidade: 75,
        temperatura: 25
      };

      // Act
      const d1 = isDuplicata(leitura1);
      const d2 = isDuplicata(leitura2);
      const d1Dup = isDuplicata(leitura1Duplicada);

      // Assert
      expect(d1).toBe(false); // Primeira
      expect(d2).toBe(false); // Segunda (diferente)
      expect(d1Dup).toBe(true); // Mesmo uid e timestamp da primeira
    });
  });

  describe('Cenários de Erro', () => {
    it('deve lidar com sensor de tipo desconhecido', () => {
      // Arrange
      const sensorDesconhecido = {
        uid: 'TIPO-NOVO-001',
        unixtime: 1702834800,
        valor: 100
      } as any;

      // Act
      const tipo = getTipo(sensorDesconhecido.uid);
      const validacao = validarRange(sensorDesconhecido, tipo);

      // Assert
      expect(tipo).toBe('desconhecido');
      expect(validacao.valido).toBe(false);
    });

    it('deve detectar múltiplos erros de validação', () => {
      // Arrange
      const leituraComMuitosErros: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 2000, // Fora do range
        umidade: 150, // Fora do range
        temperatura: 100 // Fora do range
      };

      // Act
      const tipo = getTipo(leituraComMuitosErros.uid);
      const validacao = validarRange(leituraComMuitosErros, tipo);

      // Assert
      expect(validacao.valido).toBe(false);
      expect(validacao.erros.length).toBe(3); // Todos os campos com erro
    });

    it('deve rejeitar leitura com campos nulos', () => {
      // Arrange
      const leituraIncompletа = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: null,
        umidade: 65,
        temperatura: 22.3
      } as any;

      // Act
      const tipo = getTipo(leituraIncompletа.uid);
      const validacao = validarRange(leituraIncompletа, tipo);

      // Assert
      expect(validacao.valido).toBe(false);
      expect(validacao.erros.some((e) => e.includes('chuva_mm'))).toBe(true);
    });
  });

  describe('Casos Limites', () => {
    it('deve aceitar valores nos limites mínimos', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 0, // Mínimo
        umidade: 0, // Mínimo
        temperatura: -50 // Mínimo
      };

      // Act
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);

      // Assert
      expect(validacao.valido).toBe(true);
    });

    it('deve aceitar valores nos limites máximos', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 1000, // Máximo
        umidade: 100, // Máximo
        temperatura: 60 // Máximo
      };

      // Act
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);

      // Assert
      expect(validacao.valido).toBe(true);
    });

    it('deve rejeitar valores ligeiramente acima do limite', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: 1000.1, // Ligeiramente acima do máximo
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);

      // Assert
      expect(validacao.valido).toBe(false);
    });

    it('deve rejeitar valores ligeiramente abaixo do limite mínimo', () => {
      // Arrange
      const leitura: SensorPluviometro = {
        uid: 'PLUVIOMETRO-001',
        unixtime: 1702834800,
        chuva_mm: -0.1, // Ligeiramente abaixo do mínimo
        umidade: 65,
        temperatura: 22.3
      };

      // Act
      const tipo = getTipo(leitura.uid);
      const validacao = validarRange(leitura, tipo);

      // Assert
      expect(validacao.valido).toBe(false);
    });
  });

  describe('Performance', () => {
    it('deve processar 1000 leituras rapidamente', () => {
      // Arrange
      const leituras: SensorPluviometro[] = Array.from({ length: 1000 }, (_, i) => ({
        uid: `PLUVIOMETRO-${i}`,
        unixtime: 1702834800 + i,
        chuva_mm: 5 + (i % 10),
        umidade: 60 + (i % 20),
        temperatura: 20 + (i % 10)
      }));

      // Act
      const inicio = performance.now();
      leituras.forEach((leitura) => {
        const tipo = getTipo(leitura.uid);
        validarRange(leitura, tipo);
        isDuplicata(leitura);
      });
      const fim = performance.now();
      const tempo = fim - inicio;

      // Assert
      expect(tempo).toBeLessThan(1000); // Deve processar 1000 em menos de 1s
    });
  });
});
