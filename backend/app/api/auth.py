from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import client_ip, get_current_user, require
from app.core.permissions import ROLE_PERMISSIONS
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Employee, User
from app.schemas import LoginIn, UserIn
from app.services import audit

router = APIRouter(tags=["Autenticación"])


def user_out(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role,
        "is_active": u.is_active, "permissions": ROLE_PERMISSIONS.get(u.role, []),
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }


@router.post("/auth/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    ip = client_ip(request)
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        audit.log(db, None, "auth.login_failed", "user", None, {"email": payload.email}, ip, email=payload.email)
        db.commit()
        raise HTTPException(401, "Correo o contraseña incorrectos")
    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    token, expires = create_access_token(user.id, user.role)
    audit.log(db, user, "auth.login", "user", user.id, None, ip)
    db.commit()
    return {"access_token": token, "token_type": "bearer", "expires_in": expires, "user": user_out(user)}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.get("/users")
def list_users(user: User = Depends(require("users:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(User).where(User.company_id == user.company_id).order_by(User.full_name))
    return [user_out(u) for u in rows]


@router.post("/users", status_code=201)
def create_user(payload: UserIn, request: Request, user: User = Depends(require("users:write")), db: Session = Depends(get_db)):
    if not payload.password:
        raise HTTPException(422, "La contraseña es obligatoria")
    if db.scalar(select(User.id).where(User.email == payload.email)):
        raise HTTPException(409, "Ya existe un usuario con ese correo")
    u = User(company_id=user.company_id, email=payload.email, full_name=payload.full_name,
             password_hash=hash_password(payload.password), role=payload.role, is_active=payload.is_active)
    db.add(u)
    db.flush()
    if payload.role == "vendedor":
        db.add(Employee(company_id=user.company_id, user_id=u.id, full_name=u.full_name))
    audit.log(db, user, "user.create", "user", u.id, {"email": u.email, "role": u.role}, client_ip(request))
    db.commit()
    return user_out(u)


@router.put("/users/{user_id}")
def update_user(user_id: int, payload: UserIn, request: Request, user: User = Depends(require("users:write")), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u or u.company_id != user.company_id:
        raise HTTPException(404, "Usuario no encontrado")
    if u.id == user.id and (not payload.is_active or payload.role != "admin"):
        raise HTTPException(409, "No puede desactivarse ni quitarse el rol de administrador a sí mismo")
    clash = db.scalar(select(User.id).where(User.email == payload.email, User.id != u.id))
    if clash:
        raise HTTPException(409, "Ya existe un usuario con ese correo")
    u.email, u.full_name, u.role, u.is_active = payload.email, payload.full_name, payload.role, payload.is_active
    if payload.password:
        u.password_hash = hash_password(payload.password)
    audit.log(db, user, "user.update", "user", u.id, {"role": u.role, "active": u.is_active}, client_ip(request))
    db.commit()
    return user_out(u)
