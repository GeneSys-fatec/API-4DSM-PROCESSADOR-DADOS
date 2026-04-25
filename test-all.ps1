# Script de teste automatizado
# Usage: .\test-all.ps1

Write-Host "🧪 Iniciando testes da integração..." -ForegroundColor Cyan

# Cores
$verde = 'Green'
$vermelho = 'Red'
$amarelo = 'Yellow'
$azul = 'Cyan'

# URLs base
$PROCESSADOR_URL = "http://localhost:3000"
$RECEPTOR_URL = "http://localhost:5000"

Write-Host "`n📋 TESTE 1: Verificar conectividade" -ForegroundColor $azul
Write-Host "=" * 50

# Teste 1: Health Check Processador
try {
    $response = Invoke-RestMethod -Uri "$PROCESSADOR_URL/health" -Method Get -TimeoutSec 5
    Write-Host "✅ Processador está online (Port 3000)" -ForegroundColor $verde
} catch {
    Write-Host "❌ Processador não está respondendo!" -ForegroundColor $vermelho
    Write-Host "   Inicie com: npm run dev" -ForegroundColor $amarelo
    exit 1
}

# Teste 2: Receptador
try {
    $response = Invoke-RestMethod -Uri "$RECEPTOR_URL/dados-brutos" -Method Get -TimeoutSec 5
    Write-Host "✅ Receptor está online (Port 5000)" -ForegroundColor $verde
    $dataCount = ($response | Measure-Object).Count
    Write-Host "   Encontrados $dataCount registros no receptor" -ForegroundColor $azul
} catch {
    Write-Host "⚠️  Receptor não está respondendo" -ForegroundColor $vermelho
    Write-Host "   Inicie com: python -m flask run --port=5000" -ForegroundColor $amarelo
}

# Teste 3: MongoDB
Write-Host "`n📊 TESTE 2: Verificar MongoDB" -ForegroundColor $azul
Write-Host "=" * 50

try {
    $mongoTest = mongosh --version 2>$null
    if ($mongoTest) {
        Write-Host "✅ MongoDB CLI está instalado" -ForegroundColor $verde
        
        # Tentar conectar
        $mongoConnection = mongosh --eval "db.runCommand({ping: 1})" 2>&1
        if ($mongoConnection -match "ok") {
            Write-Host "✅ MongoDB está conectado" -ForegroundColor $verde
        } else {
            Write-Host "❌ MongoDB não está respondendo" -ForegroundColor $vermelho
        }
    }
} catch {
    Write-Host "⚠️  Não conseguiu verificar MongoDB" -ForegroundColor $amarelo
}

# Teste 4: Sincronizar Receptor
Write-Host "`n🔄 TESTE 3: Sincronizar com Receptor" -ForegroundColor $azul
Write-Host "=" * 50

try {
    $response = Invoke-RestMethod -Uri "$PROCESSADOR_URL/sincronizar-receptor" -Method Post -TimeoutSec 10
    if ($response.sucesso) {
        Write-Host "✅ Sincronização bem-sucedida" -ForegroundColor $verde
        Write-Host "   Novos: $($response.novos) | Erros: $($response.erros)" -ForegroundColor $azul
    }
} catch {
    Write-Host "❌ Erro ao sincronizar: $_" -ForegroundColor $vermelho
}

# Teste 5: Processar Leituras
Write-Host "`n⚙️  TESTE 4: Processar Leituras" -ForegroundColor $azul
Write-Host "=" * 50

try {
    $response = Invoke-RestMethod -Uri "$PROCESSADOR_URL/processar" -Method Post -TimeoutSec 10
    if ($response.sucesso) {
        Write-Host "✅ Processamento concluído" -ForegroundColor $verde
        Write-Host "   Mensagem: $($response.mensagem)" -ForegroundColor $azul
    }
} catch {
    Write-Host "❌ Erro ao processar: $_" -ForegroundColor $vermelho
}

# Teste 6: Query MongoDB
Write-Host "`n📈 TESTE 5: Verificar dados no MongoDB" -ForegroundColor $azul
Write-Host "=" * 50

if (Get-Command mongosh -ErrorAction SilentlyContinue) {
    try {
        $rawOutput = & mongosh --eval 'db.raw.countDocuments()' 2>&1 | Select-Object -Last 1
        $treatadaOutput = & mongosh --eval 'db.tratada.countDocuments()' 2>&1 | Select-Object -Last 1
        $rejeitadaOutput = & mongosh --eval 'db.rejeitada.countDocuments()' 2>&1 | Select-Object -Last 1
        
        $rawCount = if ($rawOutput -match '^[0-9]+$') { [int]$rawOutput } else { 0 }
        $treatadaCount = if ($treatadaOutput -match '^[0-9]+$') { [int]$treatadaOutput } else { 0 }
        $rejeitadaCount = if ($rejeitadaOutput -match '^[0-9]+$') { [int]$rejeitadaOutput } else { 0 }
        
        Write-Host "📊 Coleção Raw: $rawCount documentos" -ForegroundColor $azul
        Write-Host "📊 Coleção Tratada: $treatadaCount documentos" -ForegroundColor $azul
        Write-Host "📊 Coleção Rejeitada: $rejeitadaCount documentos" -ForegroundColor $azul
    }
    catch {
        Write-Host "⚠️  Não conseguiu contar documentos" -ForegroundColor $amarelo
    }
}
else {
    Write-Host "⚠️  MongoDB CLI (mongosh) não encontrado" -ForegroundColor $amarelo
}

Write-Host "`n✅ Testes completos!" -ForegroundColor $verde
Write-Host "`n💡 Próximos passos:" -ForegroundColor $amarelo
Write-Host "   1. Verifique os logs nos terminais de cada serviço"
Write-Host "   2. Envie dados via simulator.py"
Write-Host "   3. Monitore o sincronismo automático (a cada 30s)"
Write-Host "   4. Verifique os dados em cada coleção do MongoDB"
