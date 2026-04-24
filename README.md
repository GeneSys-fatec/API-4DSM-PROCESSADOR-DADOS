# Sensor Data Processor

Backend Express + TypeScript para processamento de dados de sensores meteorológicos.

## 🚀 Setup Rápido

```bash
# 1. Instalar dependências
npm install

# 2. Build TypeScript
npm run build

# 3. Rodar
npm start
```

## 🔧 Desenvolvimento

```bash
npm run dev
```

## 📡 API

### POST /processar
Inicia o processamento de leituras não processadas da collection `leituras`.

```bash
curl -X POST http://localhost:3000/processar
```

Response:
```json
{
  "sucesso": true,
  "mensagem": "Processamento concluído"
}
```

### GET /health
Health check.

```bash
curl http://localhost:3000/health
```

## 📊 Dados Processados

### Input: Collection `leituras`
- Dados brutos de 3 tipos de sensores

### Output: Collection `leituras_tratadas`
- Dados validados e normalizados

### Output: Collection `leituras_rejeitadas`
- Dados com erros de validação

## 🔍 Fluxo de Processamento

1. **Deduplicação** - Detecta registros duplicados
2. **Validação** - Verifica faixas aceitáveis
3. **Normalização** - Converte unidades
4. **Persistência** - Salva em collection apropriada

## 📋 Tipos de Sensores

### PLUVIOMETRO
- chuva_mm: 0-1000
- umidade: 0-100
- temperatura: -50 a 60°C

### QUALIDADE_AR
- co2: 200-5000 ppm
- pm25: 0-500
- qualidade_index: 1-5

### SOLO
- umidade_solo: 0-100
- ph: 3-10
- temp_solo: -20 a 60°C

## 📝 Variáveis de Ambiente

```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=app
PORT=3000
```

## 📁 Estrutura

```
src/
├── types.ts           # Interfaces TypeScript
├── validators.ts      # Validação de ranges
├── normalizer.ts      # Normalização de dados
├── deduplicator.ts    # Detecção de duplicatas
├── processor.ts       # Orquestrador
├── db.ts              # Conexão MongoDB
└── server.ts          # Servidor Express
```