from pydantic import BaseModel, Field


class ThemePreference(BaseModel):
    base_color: str = Field(..., pattern=r"^#([0-9a-fA-F]{6})$")


class ThemePreferenceResponse(ThemePreference):
    pass
