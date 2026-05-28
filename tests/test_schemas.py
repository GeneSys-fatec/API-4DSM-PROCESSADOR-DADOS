from __future__ import annotations

from app.schemas import (
    ProcessingStats,
    ProcessRequest,
    ProcessResponse,
    SchedulerResponse,
    SchedulerStatus,
)


def test_schemas():
    req = ProcessRequest(tipos_sensores=["pluviometro"])
    assert req.tipos_sensores == ["pluviometro"]
    
    stats = ProcessingStats(
        total_processadas=10,
        total_validas=8,
        total_rejeitadas=1,
        total_interpoladas=1,
        total_duplicatas=0,
        total_agregadas=0,
        tempo_ms=150,
    )
    assert stats.total_validas == 8
    
    resp = ProcessResponse(sucesso=True, mensagem="ok", estatisticas=stats)
    assert resp.sucesso is True
    
    status = SchedulerStatus(rodando=True)
    s_resp = SchedulerResponse(sucesso=True, mensagem="ok", status=status)
    assert s_resp.mensagem == "ok"