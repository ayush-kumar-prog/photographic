import SwiftUI
import AppKit

@main
struct MemoryOverlayApp: App {
    @StateObject private var hotkeyManager = HotkeyManager()
    @StateObject private var searchManager = SearchManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(hotkeyManager)
                .environmentObject(searchManager)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        .defaultSize(width: 600, height: 800)
        .windowLevel(.floating)
        .commands {
            CommandGroup(replacing: .newItem) { }
            CommandGroup(replacing: .undoRedo) { }
            CommandGroup(replacing: .pasteboard) { }
        }
    }
}

// MARK: - Supporting Classes

class HotkeyManager: ObservableObject {
    @Published var shouldShowOverlay = false
    
    func setupHotkey() {
        // For now, we'll use a simple timer-based approach
        // In production, this would use Carbon APIs for global hotkeys
        print("🔥 Hotkey manager initialized - Press ⌘⇧M to toggle overlay")
    }
    
    func toggleOverlay() {
        shouldShowOverlay.toggle()
        print("🎭 Overlay toggled: \(shouldShowOverlay)")
    }
}

class SearchManager: ObservableObject {
    @Published var searchText = ""
    @Published var searchResults: [SearchResult] = []
    @Published var isLoading = false
    @Published var searchMode: SearchMode = .exact
    @Published var confidence: Double = 0.0
    
    enum SearchMode {
        case exact
        case jog
    }
    
    func performSearch(query: String) {
        print("🔍 Performing search for: \(query)")
        // Mock search results for now
        searchResults = [
            SearchResult(
                id: "1",
                ts: Int64(Date().timeIntervalSince1970 * 1000),
                app: "Safari",
                urlHost: "amazon.com",
                titleSnippet: "OMEGA Seamaster Aqua Terra — $3,495",
                thumbUrl: nil,
                score: 0.95,
                nugget: Nugget(type: "price", value: "$3,495", confidence: 0.9)
            )
        ]
    }
    
    func openMemory(_ result: SearchResult) {
        print("🚀 Opening memory: \(result.titleSnippet)")
    }
    
    func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        print("📋 Copied to clipboard: \(text)")
    }
}

// MARK: - Data Models

struct SearchResult: Identifiable, Codable {
    let id: String
    let ts: Int64
    let app: String
    let urlHost: String?
    let titleSnippet: String
    let thumbUrl: String?
    let score: Double
    let nugget: Nugget?
    
    var timestamp: Date {
        Date(timeIntervalSince1970: Double(ts) / 1000.0)
    }
    
    var appIcon: String {
        switch app.lowercased() {
        case "safari": return "safari"
        case "chrome": return "globe"
        case "cursor", "code": return "curlybraces"
        case "terminal": return "terminal"
        case "youtube": return "play.rectangle"
        default: return "app"
        }
    }
}

struct Nugget: Codable {
    let type: String
    let value: String
    let confidence: Double
}
