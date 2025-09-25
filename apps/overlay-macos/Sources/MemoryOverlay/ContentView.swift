import SwiftUI
import AppKit

struct ContentView: View {
    @EnvironmentObject var hotkeyManager: HotkeyManager
    @EnvironmentObject var searchManager: SearchManager
    @State private var isVisible = true  // Start visible for testing
    
    var body: some View {
        ZStack {
            // Always maintain proper window size
            Color.clear
                .frame(width: 600, height: 800)
            
            if isVisible {
                Color.black.opacity(0.1)
                    .ignoresSafeArea(.all)
                    .onTapGesture {
                        print("🎭 Background tapped - hiding overlay")
                        withAnimation(.easeOut(duration: 0.3)) {
                            isVisible = false
                        }
                    }
                
                LiquidGlassOverlay()
                    .environmentObject(searchManager)
            }
        }
        .onReceive(hotkeyManager.$shouldShowOverlay) { shouldShow in
            print("🎭 HotkeyManager shouldShowOverlay changed to: \(shouldShow)")
            print("🎭 Current isVisible: \(isVisible)")
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isVisible = shouldShow
            }
        }
        .onAppear {
            print("🎭 ContentView appeared - isVisible: \(isVisible)")
            print("🎭 HotkeyManager shouldShowOverlay: \(hotkeyManager.shouldShowOverlay)")
            
            hotkeyManager.setupHotkey()
            configureWindow()
        }
        .onChange(of: isVisible) { _, newValue in
            print("🎭 isVisible changed to: \(newValue)")
        }
    }
    
    private func configureWindow() {
        DispatchQueue.main.async {
            if let window = NSApplication.shared.windows.first {
                window.level = .floating
                window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
                window.isOpaque = false
                window.backgroundColor = NSColor.clear
                window.hasShadow = true
                
                // Make window movable but keep it borderless
                window.styleMask = [.borderless, .resizable]
                window.isMovableByWindowBackground = true
                
                // Window will automatically become key/main when needed
                
                print("🎭 Window configured successfully - movable and focusable")
            } else {
                print("⚠️ No window found to configure")
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(HotkeyManager())
        .environmentObject(SearchManager())
}