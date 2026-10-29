import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import type { SmsPayload } from '@sms-forwarder/protocol';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN');
}

function extractCode(body: string): string | null {
  const patterns = [
    /验证码[：:\s]*([0-9]{4,8})/i,
    /校验码[：:\s]*([0-9]{4,8})/i,
    /(?:code|Code)[：:\s]*([0-9]{4,8})/,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export default function App() {
  const [pairing, setPairing] = useState<{ host: string; port: number; pairingQr: string } | null>(
    null,
  );
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [senders, setSenders] = useState<
    { sender: string; lastTimestamp: number; count: number }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<SmsPayload[]>([]);
  const [search, setSearch] = useState('');

  const refreshSenders = useCallback(async () => {
    const list = await window.smsForwarder.listSenders();
    setSenders(list);
  }, []);

  const loadThread = useCallback(async (sender: string) => {
    const msgs = await window.smsForwarder.listBySender(sender);
    setThread(msgs);
  }, []);

  useEffect(() => {
    window.smsForwarder.getPairing().then(async (p) => {
      setPairing(p);
      setQrDataUrl(await QRCode.toDataURL(p.pairingQr, { margin: 1, width: 240 }));
    });
    refreshSenders();
    return window.smsForwarder.onNewMessage((msg) => {
      refreshSenders();
      if (selected === msg.sender) {
        setThread((prev) => [...prev, msg]);
      }
    });
  }, [refreshSenders, selected]);

  useEffect(() => {
    if (!search.trim()) {
      refreshSenders();
      return;
    }
    const t = setTimeout(async () => {
      const results = await window.smsForwarder.searchMessages(search);
      const map = new Map<string, { sender: string; lastTimestamp: number; count: number }>();
      for (const m of results) {
        const cur = map.get(m.sender);
        if (!cur || m.timestamp > cur.lastTimestamp) {
          map.set(m.sender, {
            sender: m.sender,
            lastTimestamp: m.timestamp,
            count: (cur?.count ?? 0) + 1,
          });
        } else if (cur) {
          cur.count += 1;
        }
      }
      setSenders([...map.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp));
    }, 300);
    return () => clearTimeout(t);
  }, [search, refreshSenders]);

  const onSelectSender = (sender: string) => {
    setSelected(sender);
    loadThread(sender);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>短信转发助手</h1>
          <input
            className="search"
            placeholder="搜索号码或内容…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>
        <div className="sender-list">
          {senders.map((s) => (
            <button
              key={s.sender}
              type="button"
              className={`sender-item ${selected === s.sender ? 'active' : ''}`}
              onClick={() => onSelectSender(s.sender)}
            >
              <div className="name">{s.sender}</div>
              <div className="meta">
                {s.count} 条 · {formatTime(s.lastTimestamp)}
              </div>
            </button>
          ))}
          {senders.length === 0 && <div className="empty">暂无短信，请先在手机上配对</div>}
        </div>
      </aside>
      <main className="main">
        <section className="pairing">
          {qrDataUrl ? <img src={qrDataUrl} alt="配对二维码" /> : null}
          <div>
            <p>
              <strong>手机扫码配对</strong>（请确保手机与电脑在同一 Wi‑Fi）
            </p>
            {pairing ? (
              <p>
                地址：{pairing.host}:{pairing.port}
              </p>
            ) : null}
            <p style={{ fontSize: 13, color: '#667085' }}>
              在 Android 应用中点击「扫码配对」，扫描此二维码即可建立加密连接。
            </p>
          </div>
        </section>
        <section className="messages">
          {!selected && <div className="empty">选择左侧发件人查看会话</div>}
          {selected &&
            thread.map((m) => {
              const code = extractCode(m.body);
              return (
                <article key={m.id} className="bubble">
                  <div className="time">
                    {formatTime(m.timestamp)}
                    {m.simSlot != null ? ` · SIM${m.simSlot + 1}` : ''}
                  </div>
                  <div>{m.body}</div>
                  <div className="actions">
                    <button
                      type="button"
                      className="small"
                      onClick={() => window.smsForwarder.copyText(m.body)}
                    >
                      复制全文
                    </button>
                    {code ? (
                      <button
                        type="button"
                        className="small primary"
                        onClick={() => window.smsForwarder.copyText(code)}
                      >
                        复制验证码 ({code})
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
        </section>
      </main>
    </div>
  );
}
