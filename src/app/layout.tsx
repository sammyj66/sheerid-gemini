import "./globals.css";

export const metadata = {
  title: "Gemini 学生认证平台",
  description: "使用卡密激活 SheerID 学生验证",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
