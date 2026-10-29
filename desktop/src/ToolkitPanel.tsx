import { useEffect, useState } from 'react';

export default function ToolkitPanel() {
  const [autoClip, setAutoClip] = useState(false);
  const [clipIn, setClipIn] = useState('');
  const [clipOut, setClipOut] = useState('');
  const [notifs, setNotifs] = useState<
    { appName: string; title: string; text: string; time: number }[]
  >([]);
  const [calls, setCalls] = useState<{ type: string; number: string; time: number }[]>([]);
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [simSlot, setSimSlot] = useState<number | null>(null);
  const [fileProgress, setFileProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    window.smsForwarder.getToolkitSettings().then((s) => setAutoClip(s.autoClipboardSync));
    const off1 = window.smsForwarder.onToolkit('clipboard', (e) => {
      const ev = e as { text: string };
      setClipIn(ev.text);
    });
    const off2 = window.smsForwarder.onToolkit('notification', (e) => {
      const ev = e as { appName: string; title: string; text: string; timestamp: number };
      setNotifs((prev) => [ev, ...prev].slice(0, 30));
    });
    const off3 = window.smsForwarder.onToolkit('call', (e) => {
      const ev = e as { callType: string; number: string; timestamp: number };
      setCalls((prev) =>
        [{ type: ev.callType, number: ev.number, time: ev.timestamp }, ...prev].slice(0, 20),
      );
    });
    const off4 = window.smsForwarder.onToolkit('file-progress', (e) => {
      const ev = e as { name: string; percent: number };
      setFileProgress(`${ev.name} ${ev.percent}%`);
    });
    const off5 = window.smsForwarder.onToolkit('file-done', (e) => {
      const ev = e as { name: string; path: string };
      setFileProgress(`已保存：${ev.name}`);
    });
    const off6 = window.smsForwarder.onToolkit('sms-result', (e) => {
      const ev = e as { ok: boolean; error?: string };
      alert(ev.ok ? '短信已提交发送' : `发送失败：${ev.error ?? '未知'}`);
    });
    return () => {
      off1();
      off2();
      off3();
      off4();
      off5();
      off6();
    };
  }, []);

  const toggleAutoClip = async (v: boolean) => {
    setAutoClip(v);
    await window.smsForwarder.setToolkitSettings({ autoClipboardSync: v });
  };

  const sendClip = async () => {
    const text = clipOut.trim();
    if (!text) return;
    const ok = await window.smsForwarder.sendClipboardToPhone(text);
    if (!ok) alert('发送失败：请确认已有配对手机');
  };

  const sendSms = async () => {
    const ok = await window.smsForwarder.sendSmsFromDesktop({
      to: smsTo.trim(),
      body: smsBody,
      simSlot,
    });
    if (!ok) alert('发送失败：请确认已有配对手机');
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file?.path) return;
    try {
      await window.smsForwarder.sendFileToPhone(file.path);
      setFileProgress(`已排队：${file.name}`);
    } catch (err) {
      alert(String(err));
    }
  };

  return (
    <div className="toolkit">
      <h2>互联工具箱</h2>

      <section className="tool-card">
        <h3>剪贴板</h3>
        <label className="checkbox-row">
          <input type="checkbox" checked={autoClip} onChange={(e) => toggleAutoClip(e.target.checked)} />
          自动同步到手机（复制后约 2 秒内发送）
        </label>
        <textarea
          className="tool-textarea"
          placeholder="输入内容发送到手机剪贴板…"
          value={clipOut}
          onChange={(e) => setClipOut(e.target.value)}
        />
        <button type="button" className="small primary" onClick={sendClip}>
          发送到手机
        </button>
        {clipIn ? (
          <p className="muted">
            最近来自手机：
            <button type="button" className="linkish" onClick={() => window.smsForwarder.copyText(clipIn)}>
              复制
            </button>
            {clipIn.slice(0, 120)}
          </p>
        ) : null}
      </section>

      <section
        className={`tool-card dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <h3>文件 / 照片</h3>
        <p className="muted">将文件拖放到此处发送到手机（保存到「下载」目录，单文件最大 10MB）</p>
        {fileProgress ? <p>{fileProgress}</p> : null}
      </section>

      <section className="tool-card">
        <h3>从电脑发送短信</h3>
        <input className="tool-input" placeholder="收件号码" value={smsTo} onChange={(e) => setSmsTo(e.target.value)} />
        <textarea
          className="tool-textarea"
          placeholder="短信内容"
          value={smsBody}
          onChange={(e) => setSmsBody(e.target.value)}
        />
        <div className="sim-row">
          <label>SIM 卡槽：</label>
          <select value={simSlot ?? ''} onChange={(e) => setSimSlot(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">默认</option>
            <option value="0">SIM 1</option>
            <option value="1">SIM 2</option>
          </select>
        </div>
        <button type="button" className="small primary" onClick={sendSms}>
          通过手机号发送
        </button>
      </section>

      <section className="tool-card">
        <h3>手机通知镜像</h3>
        <p className="muted">需在手机端开启通知监听权限，并可在应用内按应用开关过滤。</p>
        <ul className="mirror-list">
          {notifs.length === 0 && <li className="muted">暂无通知</li>}
          {notifs.map((n, i) => (
            <li key={i}>
              <strong>{n.appName}</strong> · {n.title}
              <div className="muted">{n.text}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="tool-card">
        <h3>来电 / 未接</h3>
        <ul className="mirror-list">
          {calls.length === 0 && <li className="muted">暂无记录</li>}
          {calls.map((c, i) => (
            <li key={i}>
              {c.type === 'missed' ? '未接' : '来电'} · {c.number || '未知号码'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
