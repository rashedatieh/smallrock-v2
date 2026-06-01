import { Notification } from 'electron';

// Native OS toast notifications. On Windows these surface in the Action Center
// even if the user is focused on another app — the right place for errors.

export function notify(title, body, { urgent = false } = {}) {
  try {
    if (!Notification.isSupported()) {
      console.warn('[SmallRock] notifications unsupported:', title, body);
      return;
    }
    new Notification({
      title: `Small Rock — ${title}`,
      body,
      silent: !urgent,
      urgency: urgent ? 'critical' : 'normal',
    }).show();
  } catch (err) {
    console.error('[SmallRock] notify failed:', err.message);
  }
}

export function notifyError(body) {
  notify('Error', body, { urgent: true });
}
