import SwiftUI
import AppKit

// Main entry point for the SwiftUI app
func main() {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var hotkeyManager = HotkeyManager()
    var searchManager = SearchManager()
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create the SwiftUI view
        let contentView = ContentView()
            .environmentObject(hotkeyManager)
            .environmentObject(searchManager)
        
        // Create the window
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 600, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        window.center()
        window.setFrameAutosaveName("MemoryOverlay")
        window.contentView = NSHostingView(rootView: contentView)
        window.title = "Memory Overlay"
        
        // Configure window properties
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.isOpaque = false
        window.backgroundColor = NSColor.clear
        
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