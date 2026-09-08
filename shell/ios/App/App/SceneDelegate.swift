import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // THE VISIBLE BRIDGE HAS TO BE OURS (audit, 8 Sep 2026). This window
        // is the one the player sees: it replaces the window UIKit built from
        // Main.storyboard, so patching only the storyboard to name
        // AcornautViewController left that controller unloaded and its
        // capacitorDidLoad - the single place BoardsPlugin is registered -
        // never run. Game Center then rejected every call with "Boards" not
        // implemented on ios: no score reached a leaderboard and the
        // GLOBAL & FRIENDS button was dead. Name our controller here, on the
        // window that actually survives.
        window?.rootViewController = AcornautViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
