"""Case Repository — userId-scoped 数据访问层"""
from sqlalchemy.orm import Session
from app.models import Case, CaseStatus


class CaseRepository:
    """所有查询必须带 user_id 条件（多用户隔离硬约束）"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, case_id: int, user_id: int) -> Case | None:
        return (
            self.db.query(Case)
            .filter_by(id=case_id, user_id=user_id)
            .first()
        )

    def get_or_404(self, case_id: int, user_id: int) -> Case:
        case = self.get_by_id(case_id, user_id)
        if not case:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="case不存在")
        return case

    def create(self, user_id: int, input_data: dict) -> Case:
        case = Case(user_id=user_id, input_json=input_data, status=CaseStatus.created)
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        return case

    def update_status(self, case: Case, status: CaseStatus):
        case.status = status
        self.db.commit()

    def list_by_user(self, user_id: int, limit: int = 20) -> list[Case]:
        return (
            self.db.query(Case)
            .filter_by(user_id=user_id)
            .order_by(Case.created_at.desc())
            .limit(limit)
            .all()
        )
