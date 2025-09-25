import SwiftUI
import Foundation
import Combine
import AppKit
import Carbon

// MARK: - Managers
class HotkeyManager: ObservableObject {
    @Published var shouldShowOverlay = true  // Start true to match ContentView
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    
    func setupHotkey() {
        print("🔥 Hotkey manager initialized")
        print("🔥 Initial shouldShowOverlay: \(shouldShowOverlay)")
        print("🎯 Setting up global hotkey ⌘⇧\"")
        
        registerGlobalHotkey()
    }
    
    func toggleOverlay() {
        shouldShowOverlay.toggle()
        print("🎭 Overlay toggled: \(shouldShowOverlay)")
        
        // When showing overlay, ensure window becomes key and focused
        if shouldShowOverlay {
            DispatchQueue.main.async {
                self.activateOverlayWindow()
            }
        }
    }
    
    private func activateOverlayWindow() {
        guard let panel = NSApplication.shared.windows.first else {
            print("⚠️ No panel found to activate")
            return
        }
        
        print("🎯 Activating overlay panel...")
        
        // Force the panel to become key window
        panel.makeKeyAndOrderFront(nil)
        panel.orderFrontRegardless()
        
        // Try multiple activation approaches
        NSApp.activate(ignoringOtherApps: true)
        
        // Force the panel to accept first responder
        DispatchQueue.main.async {
            panel.makeFirstResponder(panel.contentView)
        }
        
        // Verify panel is now key
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            print("✅ Panel is key: \(panel.isKeyWindow)")
            print("✅ Panel is main: \(panel.isMainWindow)")
            print("✅ Panel can become key: \(panel.canBecomeKey)")
            print("✅ Panel accepts first responder: \(panel.acceptsFirstResponder)")
            print("✅ App is active: \(NSApp.isActive)")
        }
    }
    
    private func registerGlobalHotkey() {
        // Register ⌘⇧" (Command + Shift + Quote)
        let keyCode: UInt32 = 39 // Quote key
        let modifiers: UInt32 = UInt32(cmdKey + shiftKey)
        
        var hotKeyID = EventHotKeyID()
        hotKeyID.signature = fourCharCode("MEMO")
        hotKeyID.id = 1
        
        let eventSpec = [
            EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: OSType(kEventHotKeyPressed))
        ]
        
        // Install event handler
        InstallEventHandler(GetApplicationEventTarget(), { (nextHandler, theEvent, userData) -> OSStatus in
            guard let userData = userData else { return noErr }
            let hotkeyManager = Unmanaged<HotkeyManager>.fromOpaque(userData).takeUnretainedValue()
            
            DispatchQueue.main.async {
                print("🎯 Global hotkey pressed!")
                hotkeyManager.toggleOverlay()
            }
            
            return noErr
        }, 1, eventSpec, Unmanaged.passUnretained(self).toOpaque(), &eventHandler)
        
        // Register the hotkey
        let status = RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
        
        if status == noErr {
            print("✅ Global hotkey ⌘⇧\" registered successfully")
        } else {
            print("❌ Failed to register global hotkey: \(status)")
        }
    }
    
    deinit {
        if let hotKeyRef = hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
        }
        if let eventHandler = eventHandler {
            RemoveEventHandler(eventHandler)
        }
    }
}

// Helper function for FourCharCode
private func fourCharCode(_ string: String) -> FourCharCode {
    assert(string.count == 4)
    var result: FourCharCode = 0
    for char in string.utf8 {
        result = (result << 8) + FourCharCode(char)
    }
    return result
}

class SearchManager: ObservableObject {
    @Published var searchText = ""
    @Published var searchResults: [SearchResult] = []
    @Published var isLoading = false
    @Published var searchMode: SearchMode = .exact
    @Published var confidence: Double = 0.0
    @Published var queryParsed: QueryParsed?
    
    private var cancellables = Set<AnyCancellable>()
    private let searchAPIURL = "http://localhost:3032"
    
    enum SearchMode {
        case exact
        case jog
    }
    
    init() {
        setupSearchDebouncing()
    }
    
    private func setupSearchDebouncing() {
        $searchText
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] searchText in
                if !searchText.isEmpty {
                    self?.performSearch(query: searchText)
                } else {
                    self?.clearResults()
                }
            }
            .store(in: &cancellables)
    }
    
    func performSearch(query: String) {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            clearResults()
            return
        }
        
        print("🔍 Performing search for: '\(query)'")
        isLoading = true
        
        // Try to connect to the real API first
        var components = URLComponents(string: "\(searchAPIURL)/search")!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "k", value: "6")
        ]
        
        guard let url = components.url else {
            isLoading = false
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    print("⚠️ Search API error: \(error.localizedDescription)")
                    print("🎭 Using mock data for development")
                    self?.useMockResults(for: query)
                    return
                }
                
                guard let data = data else {
                    print("⚠️ No data received from search API")
                    print("🎭 Using mock data for development")
                    self?.useMockResults(for: query)
                    return
                }
                
                do {
                    let searchResponse = try JSONDecoder().decode(SearchResponse.self, from: data)
                    self?.updateSearchResults(searchResponse)
                    print("✅ Real search results loaded: \(searchResponse.cards.count) results")
                } catch {
                    print("⚠️ Failed to decode search response: \(error)")
                    print("🎭 Using mock data for development")
                    self?.useMockResults(for: query)
                }
            }
        }.resume()
    }
    
    private func useMockResults(for query: String) {
        let mockResults = generateMockResults(for: query)
        searchResults = mockResults
        confidence = 0.75
        searchMode = mockResults.count == 1 ? .exact : .jog
        print("🎭 Mock search results: \(mockResults.count) results")
    }
    
    private func generateMockResults(for query: String) -> [SearchResult] {
        let queryLower = query.lowercased()
        var results: [SearchResult] = []
        
        // Amazon-related queries
        if queryLower.contains("amazon") || queryLower.contains("product") || queryLower.contains("buy") {
            results.append(SearchResult(
                id: "mock-amazon-1",
                ts: Int64(Date().addingTimeInterval(-3600).timeIntervalSince1970 * 1000),
                app: "Safari",
                urlHost: "amazon.com",
                titleSnippet: "OMEGA Seamaster Aqua Terra — $3,495",
                thumbUrl: nil,
                score: 0.95,
                nugget: Nugget(type: "price", value: "$3,495", confidence: 0.9)
            ))
        }
        
        // YouTube-related queries
        if queryLower.contains("youtube") || queryLower.contains("video") || queryLower.contains("watch") {
            results.append(SearchResult(
                id: "mock-youtube-1",
                ts: Int64(Date().addingTimeInterval(-7200).timeIntervalSince1970 * 1000),
                app: "Safari",
                urlHost: "youtube.com",
                titleSnippet: "Microeconomics Explained - Khan Academy",
                thumbUrl: nil,
                score: 0.87,
                nugget: Nugget(type: "title", value: "Microeconomics Explained", confidence: 0.85)
            ))
        }
        
        // Terminal-related queries
        if queryLower.contains("terminal") || queryLower.contains("command") || queryLower.contains("error") {
            results.append(SearchResult(
                id: "mock-terminal-1",
                ts: Int64(Date().addingTimeInterval(-1800).timeIntervalSince1970 * 1000),
                app: "Terminal",
                urlHost: nil,
                titleSnippet: "npm install --save-dev typescript @types/node",
                thumbUrl: nil,
                score: 0.82,
                nugget: Nugget(type: "command", value: "npm install", confidence: 0.8)
            ))
        }
        
        // Code-related queries
        if queryLower.contains("code") || queryLower.contains("cursor") || queryLower.contains("swift") {
            results.append(SearchResult(
                id: "mock-code-1",
                ts: Int64(Date().addingTimeInterval(-900).timeIntervalSince1970 * 1000),
                app: "Cursor",
                urlHost: nil,
                titleSnippet: "SwiftUI Liquid Glass Material Implementation",
                thumbUrl: nil,
                score: 0.91,
                nugget: Nugget(type: "code", value: "LiquidGlassMaterial", confidence: 0.88)
            ))
        }
        
        // If no specific matches, return a general result
        if results.isEmpty {
            results.append(SearchResult(
                id: "mock-general-1",
                ts: Int64(Date().addingTimeInterval(-600).timeIntervalSince1970 * 1000),
                app: "Safari",
                urlHost: "github.com",
                titleSnippet: "Search results for: \(query)",
                thumbUrl: nil,
                score: 0.65,
                nugget: nil
            ))
        }
        
        return results
    }
    
    private func updateSearchResults(_ response: SearchResponse) {
        searchResults = response.cards
        confidence = response.confidence
        queryParsed = response.queryParsed
        searchMode = response.mode.lowercased() == "exact" ? .exact : .jog
    }
    
    private func clearResults() {
        searchResults = []
        confidence = 0.0
        queryParsed = nil
        searchMode = .exact
    }
    
    func openMemory(_ result: SearchResult) {
        print("🚀 Opening memory: \(result.titleSnippet)")
        
        // Try to open the original source
        if let urlHost = result.urlHost, !urlHost.isEmpty {
            let urlString = "https://\(urlHost)"
            if let url = URL(string: urlString) {
                NSWorkspace.shared.open(url)
                print("🌐 Opened URL: \(urlString)")
            }
        } else {
            // Try to activate the app
            let appName = result.app
            if let app = NSWorkspace.shared.runningApplications.first(where: { 
                $0.localizedName?.lowercased().contains(appName.lowercased()) == true 
            }) {
                app.activate()
                print("📱 Activated app: \(appName)")
            } else {
                print("⚠️ Could not find running app: \(appName)")
            }
        }
    }
    
    func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        print("📋 Copied to clipboard: \(text)")
    }
    
    // Preview helper
    static func preview() -> SearchManager {
        let manager = SearchManager()
        manager.searchResults = [
            SearchResult(
                id: "preview-1",
                ts: Int64(Date().timeIntervalSince1970 * 1000),
                app: "Safari",
                urlHost: "amazon.com",
                titleSnippet: "OMEGA Seamaster Aqua Terra — $3,495",
                thumbUrl: nil,
                score: 0.95,
                nugget: Nugget(type: "price", value: "$3,495", confidence: 0.9)
            ),
            SearchResult(
                id: "preview-2",
                ts: Int64(Date().addingTimeInterval(-3600).timeIntervalSince1970 * 1000),
                app: "YouTube",
                urlHost: "youtube.com",
                titleSnippet: "Microeconomics Explained - Khan Academy",
                thumbUrl: nil,
                score: 0.87,
                nugget: Nugget(type: "title", value: "Microeconomics Explained", confidence: 0.85)
            )
        ]
        manager.searchMode = .jog
        manager.confidence = 0.75
        return manager
    }
}
