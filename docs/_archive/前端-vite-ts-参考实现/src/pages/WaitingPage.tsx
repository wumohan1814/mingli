import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProgressBar } from 'antd-mobile';
import { caseService } from '../services/api';

export default function WaitingPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(9);

  useEffect(() => {
    if (!caseId) return;
    let timer: ReturnType<typeof setInterval>;
    
    const startDqc = async () => {
      try {
        const { jobId } = await caseService.duanQianChen(caseId);
        timer = setInterval(async () => {
          try {
            const job = await caseService.getJob(jobId);
            setProgress(job.completed);
            setTotal(job.total);
            if (job.status === 'succeeded') {
              clearInterval(timer);
              navigate(`/case/${caseId}/calibration`);
            } else if (job.status === 'failed') {
              clearInterval(timer);
              // handle error
            }
          } catch {}
        }, 2000);
      } catch {}
    };

    startDqc();
    return () => { if (timer) clearInterval(timer); };
  }, [caseId, navigate]);

  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h2>正在为您综合九流派推演…</h2>
      <p style={{ color: 'var(--text-2)', margin: '16px 0' }}>
        已完成 {progress} / {total}
      </p>
      <ProgressBar percent={Math.round((progress / total) * 100)} />
    </div>
  );
}
