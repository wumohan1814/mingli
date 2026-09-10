import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'antd-mobile';

export default function ResultPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 32 }}>
      <h2>综合解读</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, margin: '16px 0' }}>
        <h3>总体趋势 · 温和上扬</h3>
        <p>多流派综合显示，未来一年事业运势整体呈温和上扬趋势，宜把握春季关键节点。</p>
      </div>
      <Button onClick={() => navigate(`/case/${caseId}/revise`)}>追问修正</Button>
      <p style={{ fontSize: 11, color: 'var(--cinnabar)', marginTop: 16 }}>
        本结果为运势趋势参考，非确定结论；禁医疗、投资、司法预测。
      </p>
    </div>
  );
}
