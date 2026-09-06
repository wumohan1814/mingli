import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Picker, Toast } from 'antd-mobile';
import { caseService } from '../services/api';

const genderColumns = [[{ label: '男', value: 'male' }, { label: '女', value: 'female' }]];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const res = await caseService.createCase({
        birth_year: Number(values.birth_year),
        birth_month: Number(values.birth_month),
        birth_day: Number(values.birth_day),
        birth_hour: Number(values.birth_hour || 0),
        gender: values.gender || 'male',
        birthplace: values.birthplace || '',
        question: '事业运势',
      });
      // 触发排盘
      await caseService.paipan(res.caseId);
      navigate(`/case/${res.caseId}/waiting`);
    } catch (e: any) {
      Toast.show({ content: e.message || '建档失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>建档 · 输入生辰信息</h2>
      <Form onFinish={handleSubmit} layout="horizontal">
        <Form.Item name="birth_year" label="出生年" rules={[{ required: true }]}>
          <Input placeholder="如 1990" type="number" />
        </Form.Item>
        <Form.Item name="birth_month" label="月" rules={[{ required: true }]}>
          <Input placeholder="1-12" type="number" />
        </Form.Item>
        <Form.Item name="birth_day" label="日" rules={[{ required: true }]}>
          <Input placeholder="1-31" type="number" />
        </Form.Item>
        <Form.Item name="birth_hour" label="时辰(0-23)">
          <Input placeholder="如 14" type="number" />
        </Form.Item>
        <Form.Item name="gender" label="性别">
          <Picker columns={genderColumns}>
            {(items) => <Input placeholder="选择性别" value={items[0]?.label || ''} readOnly />}
          </Picker>
        </Form.Item>
        <Form.Item name="birthplace" label="出生地">
          <Input placeholder="如 北京" />
        </Form.Item>
        <Button block type="submit" color="primary" loading={loading} size="large">
          开始排盘
        </Button>
      </Form>
    </div>
  );
}
