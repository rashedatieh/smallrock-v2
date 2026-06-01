import { systemPreferences, dialog } from 'electron';

export async function ensureAccessibilityPermission() {
  if (process.platform !== 'darwin') return true;

  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (trusted) return true;

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Accessibility Permission Required',
    message: 'Small Rock needs Accessibility access to read and replace text in other apps.',
    detail: 'Click "Open Settings" to grant access in System Settings → Privacy & Security → Accessibility.',
    buttons: ['Open Settings', 'Skip'],
    defaultId: 0,
  });

  if (response === 0) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }

  return false;
}
