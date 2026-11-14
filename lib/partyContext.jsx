import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocket, emitAck } from "./socketService";
import { useMatch } from "./matchContext";
import { useAuth } from "./authContext";
import { NetMatch } from "../game/soccer/netMatch";

const PartyContext = createContext(null);

export function PartyProvider({ children }) {
  const { connection } = useMatch();
  const { user } = useAuth();
  const [party, setParty] = useState(null);
  const [game, setGame] = useState(null); // { net, finished }
  const [invites, setInvites] = useState([]);
  const [notice, setNotice] = useState(null);
  const gameRef = useRef(null);
  gameRef.current = game;
  const attached = useRef(null);

  const startGame = useCallback((payload) => {
    setGame({ net: new NetMatch(payload), finished: null, key: Math.random() });
  }, []);

  useEffect(() => {
    if (!user || connection !== "connected") return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    if (attached.current !== socket) {
      attached.current = socket;
      socket.on("party:state", (s) => setParty(s));
      socket.on("party:closed", () => {
        setParty(null);
        setGame(null);
        setNotice("The party was closed.");
      });
      socket.on("party:invite", (inv) => {
        setInvites((list) => (list.some((i) => i.code === inv.code) ? list : [...list, { ...inv, at: Date.now() }]));
      });
      socket.on("party:start", startGame);
      socket.on("party:snap", (snap) => {
        const g = gameRef.current;
        if (g && g.net) g.net.apply(snap);
      });
      socket.on("party:finished", (info) => setGame((g) => (g ? { ...g, finished: info } : g)));
      socket.on("party:lobby", () => setGame(null));
    }
    // (re)attach to a running party after a reconnect or page reload
    emitAck("party:resume")
      .then((r) => {
        if (r.party) setParty(r.party);
        if (r.start) startGame(r.start);
      })
      .catch(() => {});
    return undefined;
  }, [user && user.id, connection, startGame]);

  useEffect(() => {
    if (!user) {
      setParty(null);
      setGame(null);
      setInvites([]);
      attached.current = null;
    }
  }, [user]);

  const run = useCallback(async (event, payload) => {
    setNotice(null);
    try {
      return await emitAck(event, payload);
    } catch (err) {
      setNotice(err.message);
      throw err;
    }
  }, []);

  const actions = useMemo(
    () => ({
      create: async () => {
        const r = await run("party:create");
        setParty(r.party);
      },
      join: async (code) => {
        const r = await run("party:join", { code });
        setParty(r.party);
        setInvites((l) => l.filter((i) => i.code !== String(code).toUpperCase()));
      },
      leave: async () => {
        await emitAck("party:leave").catch(() => {});
        setParty(null);
        setGame(null);
      },
      setRole: (role) => run("party:role", { role }),
      setSettings: (s) => run("party:settings", s),
      invite: (username) => run("party:invite", { username }),
      start: () => run("party:start"),
      rematch: () => run("party:rematch"),
      dismissInvite: (code) => setInvites((l) => l.filter((i) => i.code !== code)),
      clearNotice: () => setNotice(null),
      sendInput: (d) => {
        const s = getSocket();
        if (s && s.connected) s.emit("party:input", d);
      },
    }),
    [run]
  );

  const value = useMemo(() => ({ party, game, invites, notice, actions, me: user }), [party, game, invites, notice, actions, user]);
  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useParty() {
  return useContext(PartyContext);
}
