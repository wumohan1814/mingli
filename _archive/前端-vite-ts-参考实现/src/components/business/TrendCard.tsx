import { Card } from 'antd-mobile';

interface TrendCardProps {
  title: string;
  direction: '吉' | '凶' | '平';
  description: string;
  confidence: string;
}

const directionConfig: Record<string, { color: string; emoji: string }> = {
  '吉': { color: 'var(--jade)', emoji: '☰' },
  '凶': { color: 'var(--cinnabar)', emoji: '☷' },
  '平': { color: 'var(--ink-400)', emoji: '◎' },
};

export default function TrendCard({ title, direction, description, confidence }: TrendCardProps) {
  const cfg = directionConfig[direction];
  return (
    <div style={{
      margin: '8px 0',
      borderLeft: '3px solid ' + cfg.color,
      borderRadius: 12,
      background: 'var(--surface)',
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24 }}>{cfg.emoji}</span>
        <div>
          <h4 style={{ margin: 0 }}>{title}</h4>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{description}</p>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>置信度: {confidence}</span>
        </div>
      </div>
    </div>
  );
}

