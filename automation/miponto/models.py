from typing import List, Optional

from pydantic import BaseModel, Field


class MotoristaPayload(BaseModel):
    agendamento_id: str
    condutor_id: str
    nome: str
    cpf: Optional[str] = None
    codigo: Optional[str] = None
    telefone: Optional[str] = None
    status: str


class DispatchPayload(BaseModel):
    coleta_id: str
    data_coleta: str
    turno: int
    horario: str
    horario_fim: Optional[str] = None
    hub_id: str
    hub_sigla: str
    hub_nome: str
    motoristas: List[MotoristaPayload] = Field(default_factory=list)


class DispatchResultado(BaseModel):
    nome: str
    cpf: Optional[str] = None
    status: str
    detalhe: str


class DispatchResponse(BaseModel):
    ok: bool
    message: str
    processed: int
    selected: int
    submit_performed: bool
    resultados: List[DispatchResultado] = Field(default_factory=list)
