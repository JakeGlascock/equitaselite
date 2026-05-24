import UIKit
import Capacitor

// UIScene lifecycle adopter (Phase M3 polish, 2026-05-24).
//
// iOS has been progressively deprecating the AppDelegate-only window
// lifecycle since iOS 13. New App Store submissions in the Xcode 16
// era trigger "UIScene lifecycle will soon be required" warnings —
// adopting it now means submission won't get flagged.
//
// The window is created automatically by UIKit from the Main
// storyboard referenced in Info.plist's UISceneStoryboardFile. Our
// only job is:
//   1. tint the window navy on connect (was AppDelegate's job pre-scene)
//   2. forward openURLContexts + continue userActivity to Capacitor's
//      ApplicationDelegateProxy, otherwise deep links / Universal
//      Links never reach the bridge.

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        // Brand-navy fills the safe-area gap above the WebView. Matches
        // --ee-bg = #031427 from globals.css.
        let brandNavy = UIColor(red: 0x03/255.0,
                                green: 0x14/255.0,
                                blue: 0x27/255.0,
                                alpha: 1.0)
        self.window?.backgroundColor = brandNavy

        // Cold-launch via a Universal Link or custom URL — the URL /
        // activity arrives here on the scene, not on the AppDelegate.
        for context in connectionOptions.urlContexts {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: context.url,
                options: [:]
            )
        }
        if let userActivity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                continue: userActivity,
                restorationHandler: { _ in }
            )
        }
    }

    func scene(_ scene: UIScene,
               openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Warm path — app already running, user tapped a custom-scheme
        // URL. Forward to Capacitor exactly as the AppDelegate handler
        // did pre-UIScene.
        guard let url = URLContexts.first?.url else { return }
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: url,
            options: [:]
        )
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        // Warm path — Universal Link tapped while the app is in the
        // foreground or background. Phase M3 wires this end-to-end
        // once Apple's AASA fetch + Associated Domains entitlement
        // are in place.
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }

    // The remaining lifecycle hooks are intentionally empty. iOS calls
    // them at scene transitions; Capacitor's bridge handles its own
    // pause/resume so we have nothing to add. They exist as stubs so
    // future native work has an obvious place to hook in.

    func sceneDidDisconnect(_ scene: UIScene)  {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
