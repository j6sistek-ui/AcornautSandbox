import UIKit
import Capacitor

/// The app's bridge controller: the stock Capacitor one plus the local
/// plugins the shell ships. Main.storyboard points at this class (set by
/// `npm run configure`).
class AcornautViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BoardsPlugin())
    }
}
