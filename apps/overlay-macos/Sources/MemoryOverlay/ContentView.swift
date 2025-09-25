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
            if let panel = NSApplication.shared.windows.first {
                // Panel is already configured in main.swift, just verify settings
                print("🎭 Panel configuration verified:")
                print("   - Level: \(panel.level.rawValue)")
                print("   - Style mask: \(panel.styleMask)")
                print("   - Is opaque: \(panel.isOpaque)")
                print("   - Can become key: \(panel.canBecomeKey)")
                print("   - Accepts first responder: \(panel.acceptsFirstResponder)")
                if let nsPanel = panel as? NSPanel {
                    print("   - Is floating panel: \(nsPanel.isFloatingPanel)")
                    print("   - Becomes key only if needed: \(nsPanel.becomesKeyOnlyIfNeeded)")
                }
            } else {
                print("⚠️ No panel found to configure")
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(HotkeyManager())
        .environmentObject(SearchManager())
}