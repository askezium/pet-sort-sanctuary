import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { EggKind } from './meta/game';

export type Route =
  | { name: 'splash' }
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'level'; id: number }
  | { name: 'shop' }
  | { name: 'collection' };

export type ModalState =
  | null
  | { type: 'habitat'; id: string }
  | { type: 'egg'; kind?: EggKind }
  | { type: 'daily' }
  | { type: 'tasks' }
  | { type: 'settings' };

interface Nav {
  route: Route;
  modal: ModalState;
  toastMsg: string | null;
  go: (r: Route) => void;
  open: (m: ModalState) => void;
  /** Opens a modal only if none is showing. */
  openIfIdle: (m: ModalState) => void;
  close: () => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(Ctx);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>({ name: 'splash' });
  const [modal, setModal] = useState<ModalState>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  const value: Nav = {
    route,
    modal,
    toastMsg,
    go: (r) => {
      setModal(null);
      setRoute(r);
    },
    open: setModal,
    openIfIdle: (m) => setModal((prev) => prev ?? m),
    close: () => setModal(null),
    toast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
