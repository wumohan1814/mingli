import { Button } from 'antd-mobile';

interface AssertionCardProps {
  method: string;
  domain: string;
  claim: string;
  yearRange?: string;
  onFeedback: (feedback: 'confirmed' | 'denied' | 'corrected') => void;
}

export default function AssertionCard({ method, domain, claim, yearRange, onFeedback }: AssertionCardProps) {
  return (
    <div style={{
      margin: '8px 0',
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: 16,
    }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--gold)', background: 'var(--ink-900)', padding: '2px 8px', borderRadius: 999 }}>
          {method}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '2px 8px' }}>
          {domain}
        </span>
        {yearRange && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{yearRange}</span>
        )}
      </div>
      <p style={{ fontSize: 14, margin: '8px 0' }}>{claim}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button size="small" color="success" onClick={() => onFeedback('confirmed')}>确认</Button>
        <Button size="small" color="danger" onClick={() => onFeedback('denied')}>否认</Button>
        <Button size="small" onClick={() => onFeedback('corrected')}>修正</Button>
      </div>
    </div>
  );
}

