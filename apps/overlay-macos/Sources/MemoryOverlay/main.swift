import SwiftUI
import AppKit

// Custom NSPanel that can become key for keyboard input
class KeyablePanel: NSPanel {
    override var canBecomeKey: Bool { return true }
    override var acceptsFirstResponder: Bool { return true }
}

// Main entry point for the SwiftUI app
func main() {
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)  // Keep as accessory app for overlay behavior
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: KeyablePanel!
    var hotkeyManager = HotkeyManager()
    var searchManager = SearchManager()
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create the SwiftUI view
        let contentView = ContentView()
            .environmentObject(hotkeyManager)
            .environmentObject(searchManager)
        
        // Create KeyablePanel for proper floating overlay with keyboard support
        window = KeyablePanel(
            contentRect: NSRect(x: 0, y: 0, width: 600, height: 800),
            styleMask: [.borderless, .resizable],
            backing: .buffered,
            defer: false
        )
        
        window.center()
        window.setFrameAutosaveName("MemoryOverlay")
        window.contentView = NSHostingView(rootView: contentView)
        window.title = "Memory Overlay"
        
        // Configure panel properties for floating overlay behavior
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.isOpaque = false
        window.backgroundColor = NSColor.clear
        window.hasShadow = true
        window.isMovableByWindowBackground = true
        
        // Panel-specific configuration for keyboard focus
        window.isFloatingPanel = true
        window.becomesKeyOnlyIfNeeded = false  // Allow panel to become key
        window.acceptsMouseMovedEvents = true
        
        // Ensure window is visible and on top
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        
        print("🚀 Memory Overlay launched successfully!")
        print("📱 Window frame: \(window.frame)")
        print("🖥️  Screen frame: \(NSScreen.main?.frame ?? CGRect.zero)")
        print("👁️  Window is visible: \(window.isVisible)")
        print("🎯 Window level: \(window.level.rawValue)")
        print("💡 Double-tap anywhere in the overlay to toggle for testing")
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        print("👋 Memory Overlay shutting down")
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// Start the application
main()