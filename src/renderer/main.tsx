import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import './styles/global.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#237a57',
          colorInfo: '#2866b1',
          colorSuccess: '#237a57',
          colorWarning: '#c77700',
          colorError: '#b6423b',
          colorText: '#202723',
          colorBgLayout: '#f4f0e8',
          borderRadius: 6,
          fontFamily:
            '"Segoe UI", "Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", sans-serif'
        },
        components: {
          Layout: {
            bodyBg: '#f4f0e8',
            siderBg: '#202723',
            triggerBg: '#202723'
          },
          Table: {
            headerBg: '#ece6dc',
            rowHoverBg: '#f7f2ea'
          },
          Button: {
            borderRadius: 6
          }
        }
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
