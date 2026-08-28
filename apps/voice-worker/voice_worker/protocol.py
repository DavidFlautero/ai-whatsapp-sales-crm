from typing import Literal

from pydantic import BaseModel, Field


class StartFrame(BaseModel):
    type: Literal["start"]
    call_id: str = Field(min_length=1, max_length=128)
    company_id: str = Field(min_length=1, max_length=128)
    language: str = "es"


class CommitFrame(BaseModel):
    type: Literal["commit"]


class StopFrame(BaseModel):
    type: Literal["stop"]


ControlFrame = StartFrame | CommitFrame | StopFrame


def parse_control(payload: str) -> ControlFrame:
    import json

    raw = json.loads(payload)
    frame_type = raw.get("type")
    mapping = {"start": StartFrame, "commit": CommitFrame, "stop": StopFrame}
    model = mapping.get(frame_type)
    if model is None:
        raise ValueError("unsupported control frame")
    return model.model_validate(raw)
