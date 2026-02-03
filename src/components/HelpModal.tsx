"use client";

type HelpModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">使用帮助</div>
          <button type="button" className="modal-close" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="error-list">
          建议退出浏览器，跟着操作步骤来！关键提示：必须右键复制链接，不要点击进入后再复制！
        </div>

        <div>
          <div className="card-title">操作步骤</div>
          <div className="steps">
            <div className="step">
              1.{" "}
              <a
                href="https://one.google.com/ai-student"
                target="_blank"
                rel="noreferrer"
              >
                👉 点我获取 SheerID 链接
              </a>
            </div>
            <div className="step">2. 右键复制链接地址，不要点进去！</div>
            <div className="step">3. 粘贴 SheerID 链接，使用卡密并提交验证</div>
          </div>
        </div>

        <div>
          <div className="card-title">常见错误与解决方案</div>
          <table className="table">
            <thead>
              <tr>
                <th>错误</th>
                <th>原因</th>
                <th>解决方案</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>verificationId 无效</td>
                <td>复制了短链接/不完整链接</td>
                <td>务必右键复制完整链接地址</td>
              </tr>
              <tr>
                <td>卡密不可用/已消耗</td>
                <td>卡密已用完、被作废或过期</td>
                <td>更换新卡密或联系管理员</td>
              </tr>
              <tr>
                <td>链接数量不匹配</td>
                <td>一卡一链模式下数量不一致</td>
                <td>确保链接数量 = 卡密数量</td>
              </tr>
              <tr>
                <td>剩余次数不足</td>
                <td>一卡多链模式下次数不足</td>
                <td>减少链接数量或更换高次数卡密</td>
              </tr>
              <tr>
                <td>超时</td>
                <td>上游响应缓慢或网络波动</td>
                <td>稍后重试或更换网络环境</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div className="card-title">卡密使用规则</div>
          <ul className="helper-list">
            <li>一卡一链模式：每条链接对应一条卡密，数量必须一致。</li>
            <li>一卡多链模式：一张卡密可验证多条链接，但不能超过剩余次数。</li>
            <li>验证成功：消耗 1 次卡密次数。</li>
            <li>验证失败/超时：不消耗次数，卡密会回滚可用状态。</li>
          </ul>
        </div>

        <div>
          <div className="card-title">SheerID 链接示例</div>
          <div className="progress-link">
            https://services.sheerid.com/verify/?verificationId=6a1234abcd5678ef9012abcd
          </div>
        </div>
      </div>
    </div>
  );
}
