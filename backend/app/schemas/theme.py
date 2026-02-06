from pydantic import BaseModel, ConfigDict, Field

HEX_COLOR = r"^#([0-9a-fA-F]{6})$"


class ThemeColors(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    primary: str = Field(..., pattern=HEX_COLOR)
    secondary: str = Field(..., pattern=HEX_COLOR)
    background: str = Field(..., pattern=HEX_COLOR)
    surface: str = Field(..., pattern=HEX_COLOR)
    text: str = Field(..., pattern=HEX_COLOR)


class ThemeDerived(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    primary_hover: str = Field(..., pattern=HEX_COLOR)
    primary_active: str = Field(..., pattern=HEX_COLOR)
    primary_foreground: str = Field(..., pattern=HEX_COLOR)
    secondary_hover: str = Field(..., pattern=HEX_COLOR)
    secondary_active: str = Field(..., pattern=HEX_COLOR)
    secondary_foreground: str = Field(..., pattern=HEX_COLOR)
    text_muted: str = Field(..., pattern=HEX_COLOR)
    bg_muted: str = Field(..., pattern=HEX_COLOR)
    surface_muted: str = Field(..., pattern=HEX_COLOR)
    border: str = Field(..., pattern=HEX_COLOR)
    ring: str = Field(..., pattern=HEX_COLOR)


class ThemeModeConfig(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    colors: ThemeColors
    derived: ThemeDerived


class ThemePreference(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    version: int = 1
    light: ThemeModeConfig
    dark: ThemeModeConfig


class ThemePreferenceResponse(ThemePreference):
    pass
