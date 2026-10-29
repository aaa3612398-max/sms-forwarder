/** Common Chinese / international verification code patterns */
const CODE_PATTERNS = [
  /验证码[：:\s]*([0-9]{4,8})/i,
  /校验码[：:\s]*([0-9]{4,8})/i,
  /动态码[：:\s]*([0-9]{4,8})/i,
  /(?:code|Code|CODE)[：:\s]*([0-9]{4,8})/,
  /\b([0-9]{6})\b.*(?:验证码|验证|登录|注册)/,
  /(?:验证码|验证|登录|注册).*?\b([0-9]{6})\b/,
];

export function extractVerificationCode(body: string): string | null {
  for (const pattern of CODE_PATTERNS) {
    const match = body.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  const standalone = body.match(/\b(\d{4,8})\b/);
  if (standalone && /验证|码|登录|注册|verify/i.test(body)) {
    return standalone[1];
  }
  return null;
}
