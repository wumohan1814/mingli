import { useNavigate } from 'react-router-dom';
import { Button } from 'antd-mobile';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink-700)' }}>
        太初 · 事业运势趋势参考
      </h1>
      <p style={{ color: 'var(--text-2)', margin: '16px 0 32px' }}>
        多流派综合 · 可修正 · 随时问
      </p>
      <Button color="primary" size="large" onClick={() => navigate('/auth')}>
        开始我的事业运势
      </Button>
    </div>
  );
}
