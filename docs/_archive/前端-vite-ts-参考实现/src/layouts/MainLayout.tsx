import { Outlet, useNavigate } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { AppOutline, UnorderedListOutline } from 'antd-mobile-icons';

export default function MainLayout() {
  const navigate = useNavigate();
  const tabs = [
    { key: '/', title: '首页', icon: <AppOutline /> },
    { key: '/archive', title: '档案', icon: <UnorderedListOutline /> },
  ];

  return (
    <div style={{ paddingBottom: 50 }}>
      <Outlet />
      <TabBar
        style={{ position: 'fixed', bottom: 0, width: '100%', background: 'var(--surface)' }}
        onChange={(key) => navigate(key)}
      >
        {tabs.map((tab) => (
          <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
        ))}
      </TabBar>
    </div>
  );
}

