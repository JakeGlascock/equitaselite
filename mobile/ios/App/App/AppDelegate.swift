import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    // No `var window` anymore — the window is owned by SceneDelegate
    // under the UIScene lifecycle. Same for the brand-navy backgroundColor
    // setup; it lives in scene(_:willConnectTo:options:) now.

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    // MARK: UISceneSession lifecycle

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Returns the configuration matching the "Default Configuration"
        // entry in Info.plist's UIApplicationSceneManifest. The plist
        // entry pins the delegate class to `SceneDelegate` and the
        // storyboard to Main, so this method does not need to set
        // either explicitly.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication,
                     didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // No background-only state to release; left as a stub for
        // future native work that might create off-screen scenes.
    }

    // MARK: URL + activity handlers — kept for the cold-launch path
    // where iOS routes the URL through the app delegate before the
    // scene comes up. With UIScene adopted, the scene-level handlers
    // are the primary route; these are defensive backstops.

    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
