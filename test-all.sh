#!/bin/bash

# Script de teste automatizado para Linux/Mac
# Usage: chmod +x test-all.sh && ./test-all.sh

echo -e "\033[36m🧪 Iniciando testes da integração...\033[0m"

# Cores
VERDE='\033[0;32m'
VERMELHO='\033[0;31m'
AMARELO='\033[1;33m'
AZUL='\033[0;36m'
NC='\033[0m' # No Color

# URLs base
PROCESSADOR_URL="http://localhost:3000"
RECEPTOR_URL="http://localhost:5000"

echo -e "\n${AZUL}📋 TESTE 1: Verificar conectividade${NC}"
echo "=================================================="

# Teste 1: Health Check Processador
if curl -s "$PROCESSADOR_URL/health" > /dev/null 2>&1; then
    echo -e "${VERDE}✅ Processador está online (Port 3000)${NC}"
else
    echo -e "${VERMELHO}❌ Processador não está respondendo!${NC}"
    echo -e "${AMARELO}   Inicie com: npm run dev${NC}"
    exit 1
fi

# Teste 2: Receptor
if curl -s "$RECEPTOR_URL/dados-brutos" > /dev/null 2>&1; then
    echo -e "${VERDE}✅ Receptor está online (Port 5000)${NC}"
    DATA_COUNT=$(curl -s "$RECEPTOR_URL/dados-brutos" | grep -o '"uid"' | wc -l)
    echo -e "${AZUL}   Encontrados $DATA_COUNT registros no receptor${NC}"
else
    echo -e "${VERMELHO}❌ Receptor não está respondendo!${NC}"
    echo -e "${AMARELO}   Inicie com: python -m flask run --port=5000${NC}"
fi

# Teste 3: MongoDB
echo -e "\n${AZUL}📊 TESTE 2: Verificar MongoDB${NC}"
echo "=================================================="

if command -v mongosh &> /dev/null; then
    echo -e "${VERDE}✅ MongoDB CLI está instalado${NC}"
    
    if mongosh --eval "db.runCommand({ping: 1})" > /dev/null 2>&1; then
        echo -e "${VERDE}✅ MongoDB está conectado${NC}"
    else
        echo -e "${VERMELHO}❌ MongoDB não está respondendo${NC}"
    fi
else
    echo -e "${AMARELO}⚠️  MongoDB CLI não encontrado${NC}"
fi

# Teste 4: Sincronizar Receptor
echo -e "\n${AZUL}🔄 TESTE 3: Sincronizar com Receptor${NC}"
echo "=================================================="

SYNC_RESPONSE=$(curl -s -X POST "$PROCESSADOR_URL/sincronizar-receptor")
if echo "$SYNC_RESPONSE" | grep -q "sucesso"; then
    echo -e "${VERDE}✅ Sincronização bem-sucedida${NC}"
    NOVOS=$(echo "$SYNC_RESPONSE" | grep -o '"novos":[0-9]*' | grep -o '[0-9]*')
    ERROS=$(echo "$SYNC_RESPONSE" | grep -o '"erros":[0-9]*' | grep -o '[0-9]*')
    echo -e "${AZUL}   Novos: $NOVOS | Erros: $ERROS${NC}"
else
    echo -e "${VERMELHO}❌ Erro ao sincronizar${NC}"
fi

# Teste 5: Processar Leituras
echo -e "\n${AZUL}⚙️  TESTE 4: Processar Leituras${NC}"
echo "=================================================="

PROCESS_RESPONSE=$(curl -s -X POST "$PROCESSADOR_URL/processar")
if echo "$PROCESS_RESPONSE" | grep -q "sucesso"; then
    echo -e "${VERDE}✅ Processamento concluído${NC}"
    echo -e "${AZUL}   $(echo $PROCESS_RESPONSE | grep -o '"mensagem":"[^"]*"')${NC}"
else
    echo -e "${VERMELHO}❌ Erro ao processar${NC}"
fi

# Teste 6: Query MongoDB
echo -e "\n${AZUL}📈 TESTE 5: Verificar dados no MongoDB${NC}"
echo "=================================================="

if command -v mongosh &> /dev/null; then
    RAW_COUNT=$(mongosh --eval "db.raw.countDocuments()" 2>/dev/null | tail -1)
    TRATADA_COUNT=$(mongosh --eval "db.tratada.countDocuments()" 2>/dev/null | tail -1)
    REJEITADA_COUNT=$(mongosh --eval "db.rejeitada.countDocuments()" 2>/dev/null | tail -1)
    
    echo -e "${AZUL}📊 Coleção Raw: $RAW_COUNT documentos${NC}"
    echo -e "${AZUL}📊 Coleção Tratada: $TRATADA_COUNT documentos${NC}"
    echo -e "${AZUL}📊 Coleção Rejeitada: $REJEITADA_COUNT documentos${NC}"
fi

echo -e "\n${VERDE}✅ Testes completos!${NC}"
echo -e "\n${AMARELO}💡 Próximos passos:${NC}"
echo "   1. Verifique os logs nos terminais de cada serviço"
echo "   2. Envie dados via simulator.py"
echo "   3. Monitore o sincronismo automático (a cada 30s)"
echo "   4. Verifique os dados em cada coleção do MongoDB"
