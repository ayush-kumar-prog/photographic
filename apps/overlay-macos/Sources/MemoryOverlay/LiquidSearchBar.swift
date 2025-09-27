import SwiftUI
import AppKit

struct LiquidSearchBar: View {
    @EnvironmentObject var searchManager: SearchManager
    @State private var rippleTrigger = false
    @State private var placeholderOpacity = 1.0
    @FocusState private var isSearchFocused: Bool
    @Binding var shouldFocus: Bool
    
    init(shouldFocus: Binding<Bool> = .constant(false)) {
        self._shouldFocus = shouldFocus
    }
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 20)
                .fill(.ultraThinMaterial.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
                .frame(height: 60)
            
            RippleEffect(trigger: rippleTrigger, color: .cyan)
                .frame(height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 20))
            
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color.cyan.opacity(isSearchFocused ? 0.2 : 0.1))
                        .frame(width: 36, height: 36)
                        .scaleEffect(isSearchFocused ? 1.1 : 1.0)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSearchFocused)
                    
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 18, weight: .light))
                        .foregroundColor(.cyan.opacity(0.8))
                }
                
                ZStack(alignment: .leading) {
                    if searchManager.searchText.isEmpty {
                        HStack {
                            Text("Search your memories...")
                                .font(.system(size: 18, weight: .light))
                                .foregroundColor(.primary.opacity(0.5))
                                .opacity(placeholderOpacity)
                                .animation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true), value: placeholderOpacity)
                                .onAppear {
                                    placeholderOpacity = 0.3
                                }
                            
                            Spacer()
                        }
                    }
                    
                    TextField("", text: $searchManager.searchText)
                        .font(.system(size: 18, weight: .light))
                        .foregroundColor(.primary)
                        .focused($isSearchFocused)
                        .textFieldStyle(PlainTextFieldStyle())
                        .onChange(of: searchManager.searchText) { _, _ in
                            triggerRipple()
                            if !searchManager.searchText.isEmpty {
                                searchManager.performSearch(query: searchManager.searchText)
                            }
                        }
                        .onSubmit {
                            if !searchManager.searchText.isEmpty {
                                searchManager.performSearch(query: searchManager.searchText)
                            }
                        }
                }
                
                if !searchManager.searchText.isEmpty {
                    Button(action: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            searchManager.searchText = ""
                        }
                    }) {
                        ZStack {
                            Circle()
                                .fill(Color.white.opacity(0.2))
                                .frame(width: 24, height: 24)
                            
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.primary.opacity(0.6))
                        }
                    }
                    .buttonStyle(PlainButtonStyle())
                    .transition(.scale.combined(with: .opacity))
                }
                
                if searchManager.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 20)
        }
        .onAppear {
            // Wait for window to be properly configured and key before focusing
            waitForWindowKeyThenFocus()
        }
        .onChange(of: shouldFocus) { _, newValue in
            if newValue {
                waitForWindowKeyThenFocus()
            }
        }
    }
    
    private func triggerRipple() {
        rippleTrigger.toggle()
    }
    
    private func waitForWindowKeyThenFocus() {
        // Force focus immediately - bypass window key checks for now
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.isSearchFocused = true
            print("🎯 Force focusing search bar...")
            
            // Also try to make the window first responder
            if let window = NSApplication.shared.windows.first {
                window.makeFirstResponder(window.contentView)
                print("✅ Made window first responder")
            }
        }
    }
}

struct RippleEffect: View {
    @State private var rippleScale: CGFloat = 0
    @State private var rippleOpacity: Double = 0
    let trigger: Bool
    let color: Color
    let duration: Double
    
    init(trigger: Bool, color: Color = .cyan, duration: Double = 0.6) {
        self.trigger = trigger
        self.color = color
        self.duration = duration
    }
    
    var body: some View {
        Circle()
            .stroke(color.opacity(0.3), lineWidth: 2)
            .scaleEffect(rippleScale)
            .opacity(rippleOpacity)
            .onChange(of: trigger) { _, newValue in
                if newValue {
                    startRipple()
                }
            }
    }
    
    private func startRipple() {
        rippleScale = 0
        rippleOpacity = 1
        
        withAnimation(.easeOut(duration: duration)) {
            rippleScale = 2.0
            rippleOpacity = 0
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            rippleScale = 0
            rippleOpacity = 0
        }
    }
}

#Preview {
    ZStack {
        Color.black
        
        VStack {
            LiquidSearchBar()
                .environmentObject(SearchManager.preview())
                .padding()
        }
    }
    .ignoresSafeArea()
}