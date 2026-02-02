const VALID_ID_REGEX = /^(69|6a)[a-fA-F0-9]{22}$/i;

export function validateVerificationId(id: string): string | null {
  if (!id || id.length !== 24) return "长度必须为24位";
  if (!/^[a-fA-F0-9]+$/.test(id)) return "必须是十六进制字符";
  if (!/^(69|6a)/i.test(id)) return "前缀不合法（仅支持69或6a开头）";
  if (!VALID_ID_REGEX.test(id)) return "verificationId 格式不正确";
  return null;
}

export function extractVerificationId(input: string): string | null {
  if (!input) return null;
  const urlMatch = input.match(/verificationId=([a-fA-F0-9]+)/);
  if (urlMatch) return urlMatch[1];
  const pathMatch = input.match(/\/([a-fA-F0-9]{24,})/);
  if (pathMatch) return pathMatch[1];
  if (/^[a-fA-F0-9]{24,}$/.test(input)) return input;
  return null;
}
