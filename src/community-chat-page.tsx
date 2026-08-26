import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "./api";

const CHAT_ENDPOINT =
  "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-community-chat";
const MEMBER_KEY = "mumei-note-insight:member";
const OWNER_KEY = "mumei-unified-owner-token";
const REACTIONS = ["👍", "✨", "❤️", "😂", "🙏", "🔥"];

type Person = {
  noteId: string;
  name: string;
  role?: string;
  image: string | null;
  owner?: boolean;
};

type Room = {
  id: string;
  title: string;
  room_type: "chat" | "advice" | "progress";
  description: string;
  created_by_note_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

type Reaction = { message_id: string; note_id: string; emoji: string };
type Message = {
  id: string;
  room_id: string;
  note_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  kind: "normal" | "idea" | "work" | "system";
  is_pinned: boolean;
  created_at: string;
  reactions: Reaction[];
};

type Bootstrap = {
  ok: true;
  me: Person & { owner: boolean };
  rooms: Room[];
  members: Person[];
  topics: string[];
};

function authHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const memberToken = localStorage.getItem(MEMBER_KEY);
  const ownerToken = localStorage.getItem(OWNER_KEY);
  if (memberToken) {
    headers["X-Insight-Member"] = memberToken;
    headers["X-Insight-Device"] = getDeviceId();
  }
  if (ownerToken) headers["X-Owner-Token"] = ownerToken;
  return headers;
}

function errorLabel(code: string) {
  const labels: Record<string, string> = {
    INSIGHT_LOGIN_REQUIRED: "INSIGHTへの本人ログインが必要です。",
    INSIGHT_SESSION_INVALID: "本人ログインの有効期限が切れています。もう一度認証してください。",
    INSIGHT_APPROVAL_REQUIRED: "INSIGHTの参加承認後に利用できます。",
    COMMUNITY_INVITE_REQUIRED: "界隈会話窓は、招待・承認済みの名鑑参加者だけが利用できます。",
    ROOM_NOT_FOUND: "この会話ルームは見つからないか、終了しています。",
    NOT_ALLOWED: "この操作を行う権限がありません。",
    MESSAGE_REQUIRED: "メッセージを入力してください。",
    ROOM_TITLE_REQUIRED: "ルーム名を入力してください。",
  };
  return labels[code] ?? "会話窓を読み込めませんでした。";
}

async function callChat<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action, ...values }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(String(payload?.error ?? `HTTP_${response.status}`));
  }
  return payload as T;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Avatar({ image, name }: { image?: string | null; name: string }) {
  return (
    <span className="community-avatar" aria-hidden="true">
      {image ? <img src={image} alt="" referrerPolicy="no-referrer" /> : <b>{name.slice(0, 1)}</b>}
    </span>
  );
}

function reactionGroups(message: Message) {
  return REACTIONS.map((emoji) => {
    const rows = message.reactions.filter((reaction) => reaction.emoji === emoji);
    return { emoji, rows, count: rows.length };
  }).filter((group) => group.count > 0);
}

export function CommunityChatPage() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"normal" | "idea" | "work">("normal");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<"chat" | "advice" | "progress">("chat");
  const chatRef = useRef<HTMLDivElement | null>(null);
  const previousRoom = useRef("");

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  const loadRoom = useCallback(async (roomId: string, quiet = false) => {
    if (!roomId) return;
    if (!quiet) setRoomLoading(true);
    try {
      const result = await callChat<{ ok: true; room: Room; messages: Message[] }>("room", { roomId });
      setMessages(result.messages);
      setError("");
    } catch (caught) {
      if (!quiet) {
        const code = caught instanceof Error ? caught.message : "UNKNOWN";
        setError(errorLabel(code));
      }
    } finally {
      if (!quiet) setRoomLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await callChat<Bootstrap>("bootstrap");
      setBoot(result);
      setRooms(result.rooms);
      const first = activeRoomId && result.rooms.some((room) => room.id === activeRoomId)
        ? activeRoomId
        : result.rooms[0]?.id ?? "";
      setActiveRoomId(first);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN";
      setError(errorLabel(code));
    } finally {
      setLoading(false);
    }
  }, [activeRoomId]);

  useEffect(() => {
    void bootstrap();
    // Initial auth/bootstrap only. Room polling below keeps chat data current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    void loadRoom(activeRoomId);
    const timer = window.setInterval(() => void loadRoom(activeRoomId, true), 6000);
    return () => window.clearInterval(timer);
  }, [activeRoomId, loadRoom]);

  useEffect(() => {
    const box = chatRef.current;
    if (!box) return;
    if (previousRoom.current !== activeRoomId) {
      previousRoom.current = activeRoomId;
      window.setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 30);
    }
  }, [activeRoomId, messages.length]);

  async function refreshAfterMutation() {
    await Promise.all([loadRoom(activeRoomId, true), bootstrapQuiet()]);
  }

  async function bootstrapQuiet() {
    try {
      const result = await callChat<Bootstrap>("bootstrap");
      setBoot(result);
      setRooms(result.rooms);
    } catch {}
  }

  async function sendMessage() {
    if (!activeRoomId || !body.trim() || working) return;
    setWorking(true);
    try {
      await callChat("send", { roomId: activeRoomId, body, kind });
      setBody("");
      await refreshAfterMutation();
      window.setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 30);
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    } finally {
      setWorking(false);
    }
  }

  async function createRoom() {
    if (!newTitle.trim() || working) return;
    setWorking(true);
    try {
      const result = await callChat<{ ok: true; room: Room; rooms: Room[] }>("create-room", {
        title: newTitle,
        description: newDescription,
        roomType: newType,
      });
      setRooms(result.rooms);
      setActiveRoomId(result.room.id);
      setNewTitle("");
      setNewDescription("");
      setNewType("chat");
      setShowCreate(false);
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    } finally {
      setWorking(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    try {
      await callChat("react", { messageId, emoji });
      await loadRoom(activeRoomId, true);
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    }
  }

  async function togglePin(messageId: string) {
    try {
      await callChat("pin", { messageId });
      await loadRoom(activeRoomId, true);
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    }
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("このメッセージを削除しますか？")) return;
    try {
      await callChat("delete-message", { messageId });
      await loadRoom(activeRoomId, true);
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    }
  }

  async function archiveRoom() {
    if (!activeRoom || !window.confirm(`「${activeRoom.title}」を終了しますか？`)) return;
    try {
      const result = await callChat<{ ok: true; rooms: Room[] }>("archive-room", { roomId: activeRoom.id });
      setRooms(result.rooms);
      setActiveRoomId(result.rooms[0]?.id ?? "");
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    }
  }

  async function postTopic(topic?: string) {
    if (!activeRoomId) return;
    try {
      await callChat("topic", { roomId: activeRoomId, topic: topic ?? "" });
      await refreshAfterMutation();
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "UNKNOWN"));
    }
  }

  async function copyLog() {
    if (!activeRoom) return;
    const text = `# ${activeRoom.title}\n\n${messages.map((message) => `${message.display_name}: ${message.body}`).join("\n\n")}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  const canArchive = Boolean(
    activeRoom && boot && (boot.me.owner || activeRoom.created_by_note_id === boot.me.noteId),
  );

  if (loading) {
    return (
      <div className="community-shell community-center">
        <style>{styles}</style>
        <div className="community-loader" />
        <strong>界隈会話窓を開いています</strong>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="community-shell">
        <style>{styles}</style>
        <main className="community-gate">
          <a href="#" className="community-brand">無名S note <b>CREATOR HUB</b></a>
          <div className="community-gate-card">
            <span>CREATOR LOUNGE</span>
            <h1>界隈会話窓</h1>
            <p>{error || "本人確認が必要です。"}</p>
            <div className="community-gate-actions">
              <a href="#member">本人認証・参加確認へ</a>
              <a href="#catalog">名鑑を見る</a>
              <a href="#">トップへ戻る</a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="community-shell">
      <style>{styles}</style>
      <header className="community-topbar">
        <a href="#" className="community-brand"><span>無名S note</span><b>CREATOR HUB</b></a>
        <nav>
          <a href="#dashboard">INSIGHT</a>
          <a href="#catalog">名鑑</a>
          <a href="#battle">ゲーム</a>
          <a href="#" className="community-home">TOP</a>
        </nav>
      </header>

      <main className="community-main">
        <section className="community-hero">
          <div>
            <p>CREATOR LOUNGE / INVITE ONLY</p>
            <h1>界隈会話窓</h1>
            <span>名鑑参加者だけの、作品相談・雑談・進捗共有。</span>
          </div>
          <div className="community-me">
            <Avatar image={boot.me.image} name={boot.me.name} />
            <div><small>{boot.me.owner ? "OWNER" : "MEMBER"}</small><strong>{boot.me.name}</strong><span>@{boot.me.noteId}</span></div>
          </div>
        </section>

        {error ? <div className="community-error" role="alert"><b>!</b><span>{error}</span><button onClick={() => setError("")}>×</button></div> : null}

        <section className="community-layout">
          <aside className="community-side community-rooms">
            <div className="community-panel-title"><div><small>ROOMS</small><h2>会話ルーム</h2></div><button onClick={() => setShowCreate((value) => !value)}>＋</button></div>
            {showCreate ? (
              <div className="community-create">
                <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="ルーム名" maxLength={60} />
                <select value={newType} onChange={(event) => setNewType(event.target.value as typeof newType)}>
                  <option value="chat">雑談</option><option value="advice">作品相談</option><option value="progress">進捗</option>
                </select>
                <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="この部屋について（任意）" maxLength={240} />
                <div><button onClick={createRoom} disabled={working}>作成</button><button onClick={() => setShowCreate(false)}>閉じる</button></div>
              </div>
            ) : null}
            <div className="community-room-list">
              {rooms.map((room) => (
                <button key={room.id} className={room.id === activeRoomId ? "active" : ""} onClick={() => setActiveRoomId(room.id)}>
                  <span>{room.room_type === "advice" ? "相談" : room.room_type === "progress" ? "進捗" : "雑談"}</span>
                  <strong>{room.title}</strong>
                  <small>{room.description || `${room.created_by_name} が作成`}</small>
                </button>
              ))}
            </div>
          </aside>

          <section className="community-chat-column">
            {activeRoom ? (
              <>
                <div className="community-chat-head">
                  <div><small>{activeRoom.room_type.toUpperCase()}</small><h2>{activeRoom.title}</h2><p>{activeRoom.description}</p></div>
                  <div className="community-chat-tools"><button onClick={() => void copyLog()}>ログコピー</button><button onClick={() => void postTopic()}>お題</button>{canArchive ? <button className="danger" onClick={() => void archiveRoom()}>部屋終了</button> : null}</div>
                </div>

                <div className="community-chat-box" ref={chatRef}>
                  {roomLoading && !messages.length ? <div className="community-empty">会話を読み込んでいます…</div> : null}
                  {!roomLoading && !messages.length ? <div className="community-empty">最初のメッセージを送ってみてください。</div> : null}
                  {messages.map((message) => {
                    const mine = message.note_id === boot.me.noteId;
                    const system = message.kind === "system";
                    const canPin = boot.me.owner || mine || activeRoom.created_by_note_id === boot.me.noteId;
                    const canDelete = boot.me.owner || mine;
                    return (
                      <article key={message.id} className={`community-message ${mine ? "mine" : ""} ${system ? "system" : ""}`}>
                        {!mine && !system ? <a href={`https://note.com/${encodeURIComponent(message.note_id)}`} target="_blank" rel="noreferrer"><Avatar image={message.profile_image_url} name={message.display_name} /></a> : null}
                        <div className={`community-bubble ${message.is_pinned ? "pinned" : ""} ${message.kind}`}>
                          {!system ? <div className="community-message-name"><a href={`https://note.com/${encodeURIComponent(message.note_id)}`} target="_blank" rel="noreferrer">{message.display_name}</a>{message.kind !== "normal" ? <span>{message.kind === "idea" ? "相談" : "進捗"}</span> : null}</div> : <div className="community-system-label">TODAY'S TOPIC</div>}
                          <div className="community-message-body">{message.body}</div>
                          <div className="community-message-meta"><time>{dateLabel(message.created_at)}</time>{message.is_pinned ? <span>PIN</span> : null}</div>
                          {!system ? (
                            <>
                              <div className="community-reaction-summary">
                                {reactionGroups(message).map((group) => <span key={group.emoji}>{group.emoji} {group.count}</span>)}
                              </div>
                              <div className="community-message-actions">
                                <div className="community-reaction-buttons">{REACTIONS.map((emoji) => <button key={emoji} title={emoji} onClick={() => void react(message.id, emoji)}>{emoji}</button>)}</div>
                                {canPin ? <button onClick={() => void togglePin(message.id)}>{message.is_pinned ? "ピン解除" : "ピン"}</button> : null}
                                {canDelete ? <button className="danger-text" onClick={() => void deleteMessage(message.id)}>削除</button> : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                        {mine && !system ? <Avatar image={boot.me.image} name={boot.me.name} /> : null}
                      </article>
                    );
                  })}
                </div>

                <div className="community-composer">
                  <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="メッセージを書く" maxLength={2000} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void sendMessage(); }} />
                  <div className="community-compose-actions">
                    <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="normal">雑談</option><option value="idea">相談</option><option value="work">進捗</option></select>
                    <button onClick={() => setBody((value) => `${value}${value ? "\n" : ""}今日の進捗：`)}>進捗</button>
                    <button onClick={() => setBody((value) => `${value}${value ? "\n" : ""}見てほしいです！`)}>見て</button>
                    <button onClick={() => setBody((value) => `${value}${value ? "\n" : ""}ちょっと相談です。`)}>相談</button>
                    <button className="send" disabled={working || !body.trim()} onClick={() => void sendMessage()}>{working ? "送信中…" : "送信"}</button>
                  </div>
                </div>
              </>
            ) : <div className="community-empty tall">ルームを作成してください。</div>}
          </section>

          <aside className="community-side community-members">
            <div className="community-panel-title"><div><small>MEMBERS</small><h2>参加者</h2></div><b>{boot.members.length}</b></div>
            <div className="community-member-list">
              {boot.members.map((member) => (
                <a key={member.noteId} href={`https://note.com/${encodeURIComponent(member.noteId)}`} target="_blank" rel="noreferrer">
                  <Avatar image={member.image} name={member.name} />
                  <span><strong>{member.name}</strong><small>{member.role || "クリエイター"}</small></span>
                </a>
              ))}
            </div>
            <div className="community-topic-panel"><small>TODAY'S TOPIC</small><h3>会話が止まったら</h3>{boot.topics.slice(0, 4).map((topic) => <button key={topic} onClick={() => void postTopic(topic)}>{topic}</button>)}</div>
            <div className="community-rules"><small>ROOM RULES</small><p>否定より先に「いいね」。作品相談は欲しい反応を先に。外部共有やスクショは相手の確認を取ってから。</p></div>
          </aside>
        </section>
      </main>
    </div>
  );
}

const styles = `
:root{color-scheme:dark}.community-shell{min-height:100vh;background:radial-gradient(circle at 10% 0,#18314a 0,transparent 34%),radial-gradient(circle at 95% 15%,#2a1638 0,transparent 30%),#070a0f;color:#f7f9fc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif}.community-shell *{box-sizing:border-box}.community-topbar{height:64px;position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:0 max(14px,calc((100vw - 1240px)/2));background:rgba(7,10,15,.9);border-bottom:1px solid #202a38;backdrop-filter:blur(16px)}.community-brand{color:#fff;text-decoration:none;font-weight:900;display:flex;gap:7px;align-items:center}.community-brand span{font-size:11px;letter-spacing:.12em;color:#76e7ff}.community-brand b{font-size:15px}.community-topbar nav{display:flex;gap:6px}.community-topbar nav a{color:#b9c5d6;text-decoration:none;font-weight:800;font-size:12px;padding:8px 10px;border:1px solid transparent;border-radius:999px}.community-topbar nav a:hover{border-color:#38465a;color:#fff}.community-home{background:#17202d}.community-main{width:min(1240px,calc(100% - 24px));margin:0 auto;padding:28px 0 80px}.community-hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;padding:18px 4px 24px}.community-hero p{margin:0 0 7px;font-size:11px;font-weight:900;letter-spacing:.16em;color:#76e7ff}.community-hero h1{font-size:clamp(34px,6vw,64px);margin:0;line-height:1}.community-hero>div>span{display:block;margin-top:12px;color:#9aa9bc}.community-me{display:flex!important;align-items:center;gap:10px;border:1px solid #2a394d;border-radius:18px;background:#0d131d;padding:10px 12px;min-width:210px}.community-me div{display:flex;flex-direction:column}.community-me small{font-size:9px;color:#76e7ff;font-weight:900;letter-spacing:.14em}.community-me strong{font-size:14px}.community-me span{font-size:11px;color:#7f8da1;margin:0!important}.community-avatar{width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 38px;background:linear-gradient(135deg,#21354e,#27223f);border:1px solid #3a4b62;color:#dce9f8}.community-avatar img{width:100%;height:100%;object-fit:cover}.community-layout{display:grid;grid-template-columns:240px minmax(0,1fr) 230px;gap:12px;align-items:start}.community-side,.community-chat-column{border:1px solid #202d3e;background:rgba(11,16,24,.92);border-radius:22px;box-shadow:0 20px 60px rgba(0,0,0,.18)}.community-side{padding:12px;position:sticky;top:76px}.community-panel-title{display:flex;justify-content:space-between;align-items:center;padding:4px 3px 10px}.community-panel-title small,.community-topic-panel>small,.community-rules>small{font-size:9px;color:#76e7ff;letter-spacing:.15em;font-weight:950}.community-panel-title h2{margin:2px 0 0;font-size:16px}.community-panel-title>button{width:34px;height:34px;border-radius:10px;border:1px solid #34445a;background:#111a27;color:#fff;font-size:20px}.community-panel-title>b{display:grid;place-items:center;background:#142131;border:1px solid #2b4059;border-radius:999px;min-width:30px;height:30px;color:#76e7ff}.community-room-list{display:grid;gap:7px}.community-room-list>button{text-align:left;border:1px solid #273448;border-radius:14px;background:#0b111a;color:#dce4ee;padding:10px;cursor:pointer}.community-room-list>button.active{border-color:#5ccfe8;background:linear-gradient(145deg,#112535,#111726);box-shadow:inset 3px 0 #76e7ff}.community-room-list>button>span{display:inline-block;font-size:9px;color:#76e7ff;border:1px solid #2c5260;border-radius:999px;padding:2px 6px}.community-room-list strong{display:block;font-size:13px;margin:5px 0 3px}.community-room-list small{display:block;color:#7f8da0;font-size:10px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.community-create{padding:8px 0 12px;display:grid;gap:7px}.community-create input,.community-create textarea,.community-create select,.community-composer textarea,.community-compose-actions select{width:100%;background:#080d14;border:1px solid #2a394d;color:#f7f9fc;border-radius:12px;padding:10px;font:inherit;outline:none}.community-create textarea{min-height:70px;resize:vertical}.community-create>div{display:flex;gap:6px}.community-create button,.community-chat-tools button,.community-compose-actions button,.community-topic-panel button{border:1px solid #314157;background:#111a27;color:#dfe7f1;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}.community-chat-column{min-height:70vh;overflow:hidden}.community-chat-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 15px;border-bottom:1px solid #202d3e;background:rgba(15,22,33,.92)}.community-chat-head small{color:#76e7ff;font-size:9px;letter-spacing:.14em;font-weight:900}.community-chat-head h2{font-size:18px;margin:2px 0}.community-chat-head p{font-size:11px;color:#7f8da0;margin:0}.community-chat-tools{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.community-chat-tools button{font-size:11px;padding:7px 9px}.community-chat-tools .danger{color:#ffadb5;border-color:#66333a}.community-chat-box{height:56vh;min-height:430px;overflow-y:auto;padding:14px;background:linear-gradient(180deg,#0c131e,#091019)}.community-message{display:flex;gap:8px;align-items:flex-end;margin:12px 0}.community-message.mine{justify-content:flex-end}.community-message.system{justify-content:center}.community-message>a{text-decoration:none}.community-bubble{max-width:min(76%,640px);border:1px solid #28374b;border-radius:18px 18px 18px 5px;background:#101924;padding:10px 11px;box-shadow:0 5px 18px rgba(0,0,0,.12)}.community-message.mine .community-bubble{border-color:#385843;background:linear-gradient(145deg,#123024,#11251c);border-radius:18px 18px 5px 18px}.community-message.system .community-bubble{width:min(92%,720px);max-width:none;text-align:center;background:linear-gradient(135deg,#241c31,#152332);border-color:#4e4563;border-radius:16px}.community-bubble.pinned{box-shadow:inset 3px 0 #f6c65a,0 5px 18px rgba(0,0,0,.12)}.community-bubble.idea:not(.pinned){box-shadow:inset 3px 0 #76e7ff}.community-bubble.work:not(.pinned){box-shadow:inset 3px 0 #64e6a4}.community-message-name{display:flex;align-items:center;gap:7px;margin-bottom:5px}.community-message-name a{font-size:11px;color:#b8c7da;text-decoration:none;font-weight:900}.community-message-name span{font-size:9px;color:#76e7ff;border:1px solid #305161;border-radius:999px;padding:1px 5px}.community-message-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65}.community-message-meta{display:flex;justify-content:flex-end;gap:7px;align-items:center;margin-top:5px;color:#718095;font-size:9px}.community-message-meta span{color:#f6c65a;font-weight:900}.community-system-label{font-size:9px;color:#f6c65a;font-weight:950;letter-spacing:.14em;margin-bottom:5px}.community-reaction-summary{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}.community-reaction-summary span{font-size:10px;border:1px solid #324057;background:#0b1119;padding:2px 6px;border-radius:999px}.community-message-actions{display:flex;justify-content:space-between;align-items:center;gap:7px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(120,140,165,.16)}.community-reaction-buttons{display:flex;gap:2px;flex-wrap:wrap}.community-message-actions button{border:0;background:transparent;color:#92a1b5;font-size:10px;padding:3px 4px;cursor:pointer}.community-reaction-buttons button{font-size:14px;filter:saturate(.8)}.community-message-actions .danger-text{color:#f98b94}.community-composer{padding:10px;border-top:1px solid #202d3e;background:#0d141e}.community-composer textarea{min-height:74px;max-height:180px;resize:vertical;line-height:1.55}.community-compose-actions{display:flex;gap:5px;align-items:center;margin-top:7px}.community-compose-actions select{width:auto;min-width:84px;padding:8px}.community-compose-actions button{font-size:11px;padding:8px}.community-compose-actions .send{margin-left:auto;background:#76e7ff;color:#061017;border-color:#76e7ff;min-width:74px}.community-compose-actions .send:disabled{opacity:.4}.community-member-list{display:grid;gap:5px}.community-member-list>a{display:flex;align-items:center;gap:8px;color:#edf3fa;text-decoration:none;border:1px solid #263447;border-radius:13px;padding:7px;background:#0b1119}.community-member-list .community-avatar{width:32px;height:32px;flex-basis:32px}.community-member-list>a>span{min-width:0;display:flex;flex-direction:column}.community-member-list strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.community-member-list small{font-size:9px;color:#748399}.community-topic-panel,.community-rules{margin-top:12px;border-top:1px solid #263447;padding-top:12px}.community-topic-panel h3{font-size:13px;margin:4px 0 8px}.community-topic-panel button{display:block;width:100%;text-align:left;margin:5px 0;font-size:10px;line-height:1.45}.community-rules p{font-size:10px;color:#8290a4;line-height:1.65;margin:5px 0}.community-error{display:flex;align-items:center;gap:9px;border:1px solid #653942;background:#28141a;color:#ffc2c7;border-radius:14px;padding:10px 12px;margin-bottom:12px;font-size:12px}.community-error>b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#a74250}.community-error span{flex:1}.community-error button{border:0;background:transparent;color:#fff;font-size:18px}.community-empty{padding:42px 12px;text-align:center;color:#77869a;font-size:12px}.community-empty.tall{min-height:500px;display:grid;place-items:center}.community-center{display:flex;gap:12px;align-items:center;justify-content:center;flex-direction:column}.community-loader{width:34px;height:34px;border:3px solid #26364a;border-top-color:#76e7ff;border-radius:50%;animation:communitySpin .8s linear infinite}@keyframes communitySpin{to{transform:rotate(360deg)}}.community-gate{width:min(700px,calc(100% - 28px));margin:0 auto;padding:42px 0}.community-gate>.community-brand{margin-bottom:50px}.community-gate-card{border:1px solid #2a3b50;border-radius:28px;background:linear-gradient(145deg,#101a27,#0a0e15);padding:clamp(22px,6vw,46px)}.community-gate-card>span{font-size:10px;letter-spacing:.18em;color:#76e7ff;font-weight:950}.community-gate-card h1{font-size:clamp(36px,8vw,62px);margin:8px 0 16px}.community-gate-card p{color:#a4b1c2;line-height:1.8}.community-gate-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.community-gate-actions a{color:#071016;background:#76e7ff;text-decoration:none;font-weight:900;border-radius:12px;padding:11px 14px}.community-gate-actions a:nth-child(n+2){background:#151e2b;color:#dce5ef;border:1px solid #324158}
@media(max-width:950px){.community-layout{grid-template-columns:200px minmax(0,1fr)}.community-members{grid-column:1/-1;position:static}.community-member-list{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.community-topic-panel,.community-rules{display:none}}
@media(max-width:680px){.community-topbar{height:auto;min-height:58px;padding:9px 12px;align-items:flex-start}.community-topbar nav{overflow-x:auto;max-width:63vw}.community-topbar nav a{padding:6px 8px}.community-main{width:min(100% - 14px,1240px);padding-top:13px}.community-hero{align-items:flex-start;padding:12px 4px 16px}.community-hero h1{font-size:36px}.community-hero>div>span{font-size:11px}.community-me{min-width:0;padding:7px}.community-me .community-avatar{width:32px;height:32px;flex-basis:32px}.community-me div span,.community-me div small{display:none}.community-layout{display:flex;flex-direction:column}.community-side{position:static;width:100%}.community-rooms{order:1}.community-chat-column{order:2;width:100%;border-radius:18px}.community-members{order:3}.community-room-list{display:flex;overflow-x:auto;gap:6px;padding-bottom:2px}.community-room-list>button{min-width:150px;max-width:190px}.community-panel-title{padding-bottom:7px}.community-chat-head{align-items:flex-start;padding:11px}.community-chat-head p{max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.community-chat-tools button{font-size:10px;padding:6px}.community-chat-box{height:52vh;min-height:380px;padding:9px}.community-bubble{max-width:82%;padding:9px}.community-message{margin:9px 0;gap:5px}.community-message>.community-avatar,.community-message>a>.community-avatar{width:30px;height:30px;flex-basis:30px}.community-message-actions{display:block}.community-reaction-buttons{margin-bottom:3px}.community-compose-actions{overflow-x:auto}.community-compose-actions button,.community-compose-actions select{flex:0 0 auto}.community-compose-actions .send{position:sticky;right:0}.community-member-list{display:flex;overflow-x:auto}.community-member-list>a{min-width:145px}.community-hero p{font-size:9px}.community-home{display:none}}
`;
