import { create } from 'zustand';

interface Notification {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error' | 'success';
  readonly duration: number;
  readonly createdAt: number;
}

interface UIStoreState {
  readonly showInventory: boolean;
  readonly showQuestLog: boolean;
  readonly showChat: boolean;
  readonly showDebug: boolean;
  readonly showPauseMenu: boolean;
  readonly notifications: readonly Notification[];
}

interface UIStoreActions {
  readonly toggleInventory: () => void;
  readonly toggleQuestLog: () => void;
  readonly toggleChat: () => void;
  readonly toggleDebug: () => void;
  readonly togglePauseMenu: () => void;
  readonly closeAllPanels: () => void;
  readonly addNotification: (
    title: string,
    message: string,
    severity?: Notification['severity'],
    duration?: number,
  ) => void;
  readonly removeNotification: (id: string) => void;
}

type UIStore = UIStoreState & UIStoreActions;

let notificationCounter = 0;

export const useUIStore = create<UIStore>()((set, get) => ({
  showInventory: false,
  showQuestLog: false,
  showChat: false,
  showDebug: false,
  showPauseMenu: false,
  notifications: [],

  toggleInventory: () => set({ showInventory: !get().showInventory }),

  toggleQuestLog: () => set({ showQuestLog: !get().showQuestLog }),

  toggleChat: () => set({ showChat: !get().showChat }),

  toggleDebug: () => set({ showDebug: !get().showDebug }),

  togglePauseMenu: () => set({ showPauseMenu: !get().showPauseMenu }),

  closeAllPanels: () =>
    set({
      showInventory: false,
      showQuestLog: false,
      showChat: false,
      showPauseMenu: false,
    }),

  addNotification: (
    title: string,
    message: string,
    severity: Notification['severity'] = 'info',
    duration: number = 5000,
  ) => {
    notificationCounter += 1;
    const id = `notif-${Date.now()}-${notificationCounter}`;
    const notification: Notification = {
      id,
      title,
      message,
      severity,
      duration,
      createdAt: Date.now(),
    };

    set({ notifications: [...get().notifications, notification] });

    if (duration > 0) {
      setTimeout(() => {
        set({
          notifications: get().notifications.filter((n) => n.id !== id),
        });
      }, duration);
    }
  },

  removeNotification: (id: string) =>
    set({
      notifications: get().notifications.filter((n) => n.id !== id),
    }),
}));

export type { Notification };
