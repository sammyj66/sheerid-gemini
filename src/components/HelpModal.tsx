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
          ⚠️ 关键提示：必须右键复制链接，不要点击进入后再复制。
        </div>

        <div>
          <div className="card-title">操作步骤图示</div>
          <div className="steps">
            <div className="step">1. 获取 SheerID 链接</div>
            <div className="step">2. 右键复制链接地址</div>
            <div className="step">3. 粘贴并提交验证</div>
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
                <td>复制了短链接或链接不完整</td>
                <td>请右键复制完整链接地址</td>
              </tr>
              <tr>
                <td>卡密不可用</td>
                <td>卡密已使用或被锁定</td>
                <td>更换新的卡密</td>
              </tr>
              <tr>
                <td>超时</td>
                <td>上游暂时无响应</td>
                <td>稍后重试或联系客服</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div className="card-title">SheerID 链接示例</div>
          <div className="progress-link">
            https://services.sheerid.com/verify/?verificationId=6a1234abcd5678ef9012abcd
          </div>
        </div>

        <div>
          <div className="card-title">卡密使用规则</div>
          <ul className="helper-list">
            <li>每条验证链接对应一个卡密。</li>
            <li>验证成功后卡密被消耗。</li>
            <li>失败或超时会自动回滚卡密状态。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
