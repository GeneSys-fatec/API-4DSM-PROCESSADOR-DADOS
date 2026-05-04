# Sensor Data Processor

API em Python para processar leituras de sensores, persistindo os dados válidos no PostgreSQL e removendo os documentos de origem do MongoDB após o envio.

## Setup rápido

```bash
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
```

## Executar a aplicação

```bash
python src/main.py
```

## Endpoints

### `GET /health`
Health check da aplicação.

```bash
curl http://localhost:3000/health
```

### `POST /processar`
Processa as leituras pendentes da collection MongoDB e salva os resultados no PostgreSQL.

```bash
curl -X POST http://localhost:3000/processar
```

### `POST /scheduler/iniciar`
Inicia o scheduler com a requisição padrão ou com um payload opcional de processamento.

### `POST /scheduler/parar`
Para o scheduler.

### `POST /scheduler/reiniciar`
Reinicia o scheduler.

### `GET /scheduler/status`
Exibe o estado atual do scheduler.

## Fluxo de processamento

1. Busca leituras no MongoDB.
2. Limpa e normaliza os dados.
3. Remove duplicatas e valores inválidos.
4. Persiste as medições no PostgreSQL.
5. Exclui do MongoDB os documentos que já foram enviados.

## Scheduler

O scheduler está configurado para rodar a cada 2 minutos por padrão.

Você pode ajustar isso com a variável `SCHEDULER_INTERVAL_MS` em config.py.