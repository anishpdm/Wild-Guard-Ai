# auth.py — bcrypt-safe version (no passlib bcrypt backend issue)
import os, bcrypt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY  = os.getenv("SECRET_KEY","change-me")
ALGORITHM   = os.getenv("ALGORITHM","HS256")
ACCESS_EXP  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES",60))
REFRESH_EXP = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS",7))

oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")
USERS: dict = {}

# Use bcrypt directly — bypasses passlib entirely, no 72-byte bug
def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=12)).decode()

def _verify(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except Exception:
        return False

def init_users():
    u = os.getenv("ADMIN_USERNAME","admin")
    p = os.getenv("ADMIN_PASSWORD","wayanad2024")
    USERS[u] = {"username":u,"hashed_password":_hash(p),
                "role":"admin","full_name":"Forest Intelligence Admin"}

def make_token(data:dict, exp:timedelta)->str:
    return jwt.encode({**data,"exp":datetime.utcnow()+exp}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token:str)->dict:
    try: return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError: raise HTTPException(401,"Invalid or expired token")

async def current_user(token:str=Depends(oauth2)):
    p = decode_token(token)
    u = USERS.get(p.get("sub"))
    if not u: raise HTTPException(401,"User not found")
    return u

def ws_user(token:Optional[str])->Optional[dict]:
    if not token: return None
    try:
        p = decode_token(token)
        return USERS.get(p.get("sub"))
    except: return None
