// Client-side native helpers.
//
// All exports are safe to call from any client component on any platform.
// Outside the Capacitor wrapper (web, demo preview, server) they no-op
// silently — the import is dynamic so the @capacitor/* runtime never
// ships in the browser bundle for non-native sessions.
//
// Detection mirrors CapacitorBridge.tsx: the native runtime injects
// `window.Capacitor`; absence of that global means we're on plain web.

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  type Cap = { isNativePlatform?: () => boolean }
  return (window as unknown as { Capacitor?: Cap }).Capacitor?.isNativePlatform?.() === true
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success'

/**
 * Fire a single haptic tap. `light` is the right default for button
 * presses; `success` is reserved for end-of-flow confirmations.
 */
export async function haptic(style: HapticStyle = 'light'): Promise<void> {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
    if (style === 'success') {
      await Haptics.notification({ type: NotificationType.Success })
      return
    }
    const map = {
      light:  ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy:  ImpactStyle.Heavy,
    } as const
    await Haptics.impact({ style: map[style] })
  } catch {
    // Silently swallow — a missing plugin or denied haptic is not
    // worth blocking the calling button on.
  }
}

export interface ContactDraft {
  fullName: string
  email?:   string
  firm?:    string
  note?:    string
}

/**
 * Save a contact to the user's native iOS Contacts app. Triggers the
 * standard "Allow Equitas Elite to access your contacts?" permission
 * prompt the first time. Returns `false` on web (no native API) or if
 * the user denied permission; the caller can fall back to a vCard
 * download or a noop.
 */
export async function saveContact(draft: ContactDraft): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { Contacts, EmailType } = await import('@capacitor-community/contacts')
    const perm = await Contacts.requestPermissions()
    // 'limited' is the iOS 18 partial-access state — we don't actually
    // need to read contacts, only write, but the plugin reuses the
    // same permission so we accept it.
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') return false

    // Split a "First Last" into given / family name. iOS Contacts
    // expects them separately for sort + search; otherwise the entry
    // shows up under the family-name field only.
    const [given = '', ...rest] = draft.fullName.trim().split(/\s+/)
    const family = rest.join(' ')

    await Contacts.createContact({
      contact: {
        name:         { given, family },
        organization: draft.firm  ? { company: draft.firm } : undefined,
        emails:       draft.email ? [{ type: EmailType.Work, address: draft.email }] : undefined,
        note:         draft.note  ?? undefined,
      },
    })
    return true
  } catch {
    return false
  }
}
