import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import { authService } from '../services/api';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      if (isLogin) {
        const res = await authService.login(values.username, values.password);
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('refresh_token', res.refresh_token);
      } else {
        const res = await authService.register(values.username, values.password);
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('refresh_token', res.refresh_token);
      }
      navigate('/onboarding');
    } catch (e: any) {
      Toast.show({ content: e.message || '操作失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>
        {isLogin ? '登录' : '注册'}
      </h2>
      <Form onFinish={handleSubmit} layout="horizontal">
        <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
          <Input type="password" placeholder="请输入密码" />
        </Form.Item>
        <Button block type="submit" color="primary" loading={loading} size="large">
          {isLogin ? '登录' : '注册'}
        </Button>
      </Form>
      <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-3)' }}>
        <a onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
        </a>
      </p>
    </div>
  );
}
