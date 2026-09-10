import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'antd-mobile';

export default function CalibrationPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 32 }}>
      <h2>问卷校准</h2>
      <p>断前尘结果已生成，请确认以下断言…</p>
      <Button color="primary" onClick={() => navigate(`/case/${caseId}/result`)}>
        确认并查看预测结果
      </Button>
    </div>
  );
}
