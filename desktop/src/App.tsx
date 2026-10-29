import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import type { PairedPhoneRecord, SmsPayload } from '@sms-forwarder/protocol';

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
  const [pairing, setPairing] = useState<{
    host: string;
    port: number;
    pairingQr: string;
    deviceName: string;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pairedPhones, setPairedPhones] = useState<PairedPhoneRecord[]>([]);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [senders, setSenders] = useState<
    { sender: string; lastTimestamp: number; count: number }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<SmsPayload[]>([]);
  const [search, setSearch] = useState('');

  const refreshPairing = useCallback(async () => {
    const p = await window.smsForwarder.getPairing();
    setPairing({
      host: p.host,
      port: p.port,
      pairingQr: p.pairingQr,
      deviceName: p.deviceName,
    });
    setPairedPhones(p.pairedPhones);
    setQrDataUrl(await QRCode.toDataURL(p.pairingQr, { margin: 1, width: 240 }));
  }, []);

  const refreshSenders = useCallback(async () => {
    const list = await window.smsForwarder.listSenders();
    setSenders(list);
  }, []);

  const loadThread = useCallback(async (sender: string) => {
    const msgs = await window.smsForwarder.listBySender(sender);
    setThread(msgs);
  }, []);

  useEffect(() => {
    refreshPairing();
    refreshSenders();
    window.smsForwarder.getLaunchAtLogin().then(setLaunchAtLogin);
    const hostTimer = setInterval(refreshPairing, 8000);
    return () => {
      clearInterval(hostTimer);
    };
  }, [refreshPairing, refreshSenders]);

  useEffect(() => {
    const offMsg = window.smsForwarder.onNewMessage((msg) => {
      refreshSenders();
      if (selected === msg.sender) setThread((prev) => [...prev, msg]);
    });
    const offDev = window.smsForwarder.onDevicesChanged(refreshPairing);
    return () => {
      offMsg();
      offDev();
    };
  }, [refreshSenders, refreshPairing, selected]);

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

  const onUnpair = async (deviceId: string) => {
    if (!confirm('确定取消与该手机的配对？该手机将无法再转发短信，直至重新扫码。')) return;
    setPairedPhones(await window.smsForwarder.unpairDevice(deviceId));
  };

  const onRegenerate = async () => {
    if (
      !confirm(
        '将生成新的配对密钥并清空已配对手机列表。已配对手机需重新扫码，是否继续？',
      )
    ) {
      return;
    }
    const next = await window.smsForwarder.regeneratePairing();
    setPairedPhones(next.pairedPhones);
    setQrDataUrl(await QRCode.toDataURL(next.pairingQr, { margin: 1, width: 240 }));
    setPairing({ host: next.host, port: next.port, pairingQr: next.pairingQr, deviceName: pairing?.deviceName ?? '我的电脑' });
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
          <div className="pairing-details">
            <p>
              <strong>手机扫码配对</strong>（同一 Wi‑Fi；IP 变化时手机会自动重新发现）
            </p>
            {pairing ? (
              <p>
                当前地址：<code>{pairing.host}:{pairing.port}</code>（固定端口，DHCP 换 IP 后仍可用）
              </p>
            ) : null}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={launchAtLogin}
                onChange={(e) => {
                  const v = e.target.checked;
                  setLaunchAtLogin(v);
                  window.smsForwarder.setLaunchAtLogin(v);
                }}
              />
              开机自动启动桌面端
            </label>
            <div className="device-panel">
              <div className="device-panel-head">
                <strong>已配对手机</strong>
                <button type="button" className="small" onClick={onRegenerate}>
                  重新生成配对码
                </button>
              </div>
              {pairedPhones.length === 0 ? (
                <p className="muted">尚无手机配对；首次转发后会自动出现在此列表。</p>
              ) : (
                <ul className="device-list">
                  {pairedPhones.map((d) => (
                    <li key={d.deviceId}>
                      <div>
                        <div>{d.name}</div>
                        <div className="muted">
                          最近在线 {formatTime(d.lastSeenAt)}
                        </div>
                      </div>
                      <button type="button" className="small" onClick={() => onUnpair(d.deviceId)}>
                        取消配对
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
