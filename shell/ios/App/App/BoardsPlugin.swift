import Foundation
import Capacitor
import GameKit

/// GAME CENTER, behind the game's board contract (see ../../adapter/adapter.js
/// and illustrated-src/game/platform.ts). Three calls: sign in, submit a
/// score, show Apple's own leaderboard sheet - which already carries
/// all-time, recurring (monthly) and friends views for every board set up in
/// App Store Connect. Copied into ios/App/App by `npm run configure`.
@objc(BoardsPlugin)
public class BoardsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BoardsPlugin"
    public let jsName = "Boards"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]
    private var signInResolved = false

    @objc func signIn(_ call: CAPPluginCall) {
        signInResolved = false
        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
            guard let self = self else { return }
            if let vc = viewController {
                // Apple wants to show its sign-in sheet; the answer comes on a later callback
                DispatchQueue.main.async { self.bridge?.viewController?.present(vc, animated: true) }
                return
            }
            if !self.signInResolved {
                self.signInResolved = true
                call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated, "error": error?.localizedDescription ?? ""])
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required"); return
        }
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["submitted": false]); return }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve(["submitted": true]) }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let leaderboardId = call.getString("leaderboardId")
        DispatchQueue.main.async {
            let vc: GKGameCenterViewController
            if let id = leaderboardId {
                vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .leaderboards)
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }
}

extension BoardsPlugin: GKGameCenterControllerDelegate {
    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
