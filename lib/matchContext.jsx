import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { connectSocket, disconnectSocket, emitAck, getSocket } from "./socketService";
import { useAuth } from "./authContext";

const MatchContext = createContext(null);

const emptyMatch = { info: null, state: null, resolve: null, finished: null, aborted: null, opponent: null };

function prepareResolve(payload) {
  return {
    ...payload,
    ball: Float32Array.from(payload.ball),
    keeper: Float32Array.from(payload.keeper),
    receivedAt: performance.now(),
  };
}

export function MatchProvider({ children }) {
  const { token, user, logout, refreshUser } = useAuth();
  const [connection, setConnection] = useState("idle");
  const [resumed, setResumed] = useState(false);
  const [match, setMatch] = useState(emptyMatch);
  const [lobby, setLobby] = useState(null);
  const [notice, setNotice] = useState(null);
  const offsetRef = useRef(0);
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const lobbyWanted = useRef(false);

  const applyResume = useCallback((res) => {
    if (res && res.match) {
      offsetRef.current = res.match.state.serverNow - Date.now();
      setMatch({ ...emptyMatch, info: res.match.info, state: res.match.state });
    } else if (res && res.finished) {
      setMatch({ ...emptyMatch, finished: res.finished });
    }
    setResumed(true);
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setConnection("idle");
      setResumed(false);
      setMatch(emptyMatch);
      setLobby(null);
      return undefined;
    }
    const socket = connectSocket(token);
    setConnection(socket.connected ? "connected" : "connecting");

    const resume = () => {
      emitAck("match:resume")
        .then(applyResume)
        .catch(() => setResumed(true));
      if (lobbyWanted.current) {
        emitAck("lobby:subscribe").then((r) => setLobby(r.list)).catch(() => {});
      }
    };

    socket.on("connect", () => {
      setConnection("connected");
      resume();
    });
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") return;
      setConnection("disconnected");
    });
    socket.on("connect_error", (err) => {
      if (err && err.message === "AUTH") {
        logoutRef.current();
        return;
      }
      setConnection("disconnected");
    });
    socket.on("session:replaced", () => {
      setConnection("replaced");
    });
    socket.on("lobby:list", setLobby);
    socket.on("match:info", (info) => {
      setMatch((m) => (m.info && m.info.id === info.id ? { ...m, info } : { ...emptyMatch, info }));
    });
    socket.on("match:state", (state) => {
      offsetRef.current = state.serverNow - Date.now();
      setMatch((m) => ({ ...m, state }));
    });
    socket.on("round:resolve", (payload) => {
      setMatch((m) => ({ ...m, resolve: prepareResolve(payload) }));
    });
    socket.on("match:opponent", (opponent) => {
      setMatch((m) => ({ ...m, opponent: { ...opponent, at: performance.now() } }));
    });
    socket.on("match:finished", (finished) => {
      setMatch((m) => ({ ...m, finished }));
      refreshRef.current();
    });
    socket.on("match:aborted", (aborted) => {
      setMatch({ ...emptyMatch, aborted });
    });

    if (socket.connected) resume();

    return () => {
      socket.removeAllListeners();
    };
  }, [token, applyResume]);

  const run = useCallback(async (fn) => {
    setNotice(null);
    try {
      return await fn();
    } catch (err) {
      setNotice(err.message);
      throw err;
    }
  }, []);

  const subscribeLobby = useCallback(async () => {
    lobbyWanted.current = true;
    const r = await emitAck("lobby:subscribe");
    setLobby(r.list);
  }, []);

  const unsubscribeLobby = useCallback(() => {
    lobbyWanted.current = false;
    if (getSocket() && getSocket().connected) emitAck("lobby:unsubscribe").catch(() => {});
  }, []);

  const actions = useMemo(
    () => ({
      subscribeLobby,
      unsubscribeLobby,
      create: () => run(() => emitAck("match:create")),
      join: (matchId) => run(() => emitAck("match:join", { matchId })),
      leave: () => emitAck("match:leave").catch(() => {}),
      shoot: (x, y) => emitAck("game:shoot", { x, y }),
      dive: (x, y) => emitAck("game:dive", { x, y }),
      clearMatch: () => setMatch(emptyMatch),
      clearNotice: () => setNotice(null),
      serverNow: () => Date.now() + offsetRef.current,
    }),
    [subscribeLobby, unsubscribeLobby, run]
  );

  const value = useMemo(
    () => ({ ...match, connection, resumed, lobby, notice, actions, user }),
    [match, connection, resumed, lobby, notice, actions, user]
  );

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

export function useMatch() {
  return useContext(MatchContext);
}
