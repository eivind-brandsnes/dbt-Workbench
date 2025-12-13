import yaml
from pathlib import Path
from typing import Dict, List, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.config import get_settings, Settings
# Assuming auth dependency exists, but for now open or match other routes
# from app.api.deps import get_current_active_user

router = APIRouter(prefix="/profiles", tags=["profiles"])

class ProfileContent(BaseModel):
    content: str

class ProfileInfo(BaseModel):
    name: str
    targets: List[str]

class ProfilesResponse(BaseModel):
    content: str
    profiles: List[ProfileInfo]

def get_profiles_file(settings: Settings = Depends(get_settings)) -> Path:
    path = Path(settings.dbt_profiles_path)
    if path.is_dir():
        return path / "profiles.yml"
    return path

@router.get("", response_model=ProfilesResponse)
def get_profiles(
    profiles_file: Path = Depends(get_profiles_file)
):
    if not profiles_file.exists():
        return ProfilesResponse(content="", profiles=[])
    
    try:
        content = profiles_file.read_text()
        parsed = yaml.safe_load(content) or {}
        
        profiles_info = []
        if isinstance(parsed, dict):
            for profile_name, config in parsed.items():
                if profile_name == 'config': continue
                if not isinstance(config, dict): continue
                
                targets = []
                if 'outputs' in config and isinstance(config['outputs'], dict):
                    targets = list(config['outputs'].keys())
                profiles_info.append(ProfileInfo(name=profile_name, targets=targets))
            
        return ProfilesResponse(content=content, profiles=profiles_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read profiles: {str(e)}")

@router.put("", response_model=ProfilesResponse)
def update_profiles(
    body: ProfileContent,
    profiles_file: Path = Depends(get_profiles_file)
):
    try:
        # Validate YAML
        yaml.safe_load(body.content)
        
        profiles_file.parent.mkdir(parents=True, exist_ok=True)
        profiles_file.write_text(body.content)
        
        # Return updated info
        return get_profiles(profiles_file)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save profiles: {str(e)}")
