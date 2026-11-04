import { LocalNotifications } from '@capacitor/local-notifications';

export interface DueReminderOptions {
  id: number | string;
  title: string;
  body: string;
  dueDate?: Date;
  at?: Date;
  entityId?: string;
  type?: 'CREDIT_SALE' | 'DEBT_LIABILITY' | 'LOAN_RETURN' | 'CHECKPOINT';
}

export const nativeReminders = {
  scheduleDueReminders: async (params: DueReminderOptions): Promise<void> => {
    const numericId =
      typeof params.id === 'number'
        ? params.id
        : Math.abs(params.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0)) % 100000;
    const targetDate = params.dueDate || params.at || new Date();
    const dueTime = targetDate.getTime();
    const twoDaysBefore = dueTime - 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const notifications = [];

    // T-2 Days Warning
    if (twoDaysBefore > now) {
      notifications.push({
        id: numericId * 10 + 1,
        title: `Upcoming: ${params.title}`,
        body: `${params.body} is due in 2 days.`,
        schedule: { at: new Date(twoDaysBefore) },
        extra: { entityId: params.entityId, type: params.type },
      });
    }

    // Due Date Morning Alert
    if (dueTime > now) {
      notifications.push({
        id: numericId * 10 + 2,
        title: `Due Today: ${params.title}`,
        body: `${params.body} is due today for settlement.`,
        schedule: { at: new Date(dueTime) },
        extra: { entityId: params.entityId, type: params.type },
      });
    }

    if (notifications.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications });
      } catch (err) {
        console.warn('Local notifications schedule note:', err);
      }
    }
  },

  cancelReminders: async (id: number): Promise<void> => {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: id * 10 + 1 }, { id: id * 10 + 2 }],
      });
    } catch {
      // Ignore if not scheduled
    }
  },
};

export const scheduleCheckpointReminder = nativeReminders.scheduleDueReminders;

