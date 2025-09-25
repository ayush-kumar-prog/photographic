import SwiftUI

struct ContentView: View {
    @EnvironmentObject var hotkeyManager: HotkeyManager
    @EnvironmentObject var searchManager: SearchManager
    @State private var isVisible = false
    
    var body: some View {
        ZStack {
            // Transparent background when hidden
            if !isVisible {
                Color.clear
                    .frame(width: 1, height: 1)
            } else {
                // Screen dimming overlay
                Color.black.opacity(0.1)
                    .ignoresSafeArea(.all)
                    .onTapGesture {
                        withAnimation(.easeOut(duration: 0.3)) {
                            isVisible = false
                        }
                    }
                
                // Main overlay
                LiquidGlassOverlay()
                    .environmentObject(searchManager)
            }
        }
        .onReceive(hotkeyManager.$shouldShowOverlay) { shouldShow in
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isVisible = shouldShow
            }
        }
        .onAppear {
            hotkeyManager.setupHotkey()
            
            // Configure window to be non-activating and floating
            if let window = NSApplication.shared.windows.first {
                window.level = .floating
                window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
                window.isOpaque = false
                window.backgroundColor = NSColor.clear
                window.hasShadow = false
                window.styleMask.remove(.titled)
                window.styleMask.insert(.borderless)
            }
        }
        .onTapGesture(count: 2) {
            // Double-tap to toggle overlay for testing
            hotkeyManager.toggleOverlay()
        }
    }
}

struct LiquidGlassOverlay: View {
    @EnvironmentObject var searchManager: SearchManager
    @State private var animateIn = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text("🧠 Memory Search")
                    .font(.title2)
                    .fontWeight(.light)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Button("⚙️") {
                    print("Settings tapped")
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.horizontal, 24)
            
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.cyan)
                
                TextField("Search your memories...", text: $searchManager.searchText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit {
                        searchManager.performSearch(query: searchManager.searchText)
                    }
            }
            .padding(.horizontal, 24)
            
            // Results
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(searchManager.searchResults) { result in
                        MemoryCard(memory: result)
                            .environmentObject(searchManager)
                    }
                }
                .padding(.horizontal, 24)
            }
            
            if searchManager.searchResults.isEmpty && !searchManager.searchText.isEmpty {
                VStack {
                    Image(systemName: "magnifyingglass")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    
                    Text("No memories found")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Text("Try a different search term")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(40)
            }
            
            if searchManager.searchText.isEmpty {
                VStack(spacing: 16) {
                    Text("✨ Your Photographic Memory")
                        .font(.title)
                        .fontWeight(.light)
                    
                    Text("Double-tap anywhere to toggle this overlay")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("Start typing to search your digital memories")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(40)
            }
        }
        .frame(width: 600, height: 800)
        .background(LiquidGlassMaterial())
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.1), radius: 20, x: 0, y: 10)
        .scaleEffect(animateIn ? 1.0 : 0.9)
        .opacity(animateIn ? 1.0 : 0.0)
        .blur(radius: animateIn ? 0 : 10)
        .animation(.spring(response: 0.6, dampingFraction: 0.8), value: animateIn)
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.6)) {
                animateIn = true
            }
        }
        .onDisappear {
            animateIn = false
        }
    }
}

struct LiquidGlassMaterial: View {
    var body: some View {
        ZStack {
            // Base ultra-thin material
            Rectangle()
                .fill(.ultraThinMaterial.opacity(0.6))
            
            // White gradient overlay for liquid glass effect
            LinearGradient(
                colors: [
                    Color.white.opacity(0.8),
                    Color.white.opacity(0.4),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(Color.white.opacity(0.3), lineWidth: 1)
        )
    }
}

struct MemoryCard: View {
    let memory: SearchResult
    @State private var isHovered = false
    @EnvironmentObject var searchManager: SearchManager
    
    var body: some View {
        HStack(spacing: 16) {
            // App icon
            Image(systemName: memory.appIcon)
                .font(.title2)
                .foregroundColor(.cyan)
                .frame(width: 40, height: 40)
                .background(Color.cyan.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(memory.titleSnippet)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(2)
                
                HStack {
                    Text(memory.app)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if let urlHost = memory.urlHost {
                        Text("• \(urlHost)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Text(timeAgo)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            // Actions
            if isHovered {
                HStack {
                    Button("Open") {
                        searchManager.openMemory(memory)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    
                    if let nugget = memory.nugget {
                        Button("Copy") {
                            searchManager.copyToClipboard(nugget.value)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .shadow(color: .cyan.opacity(isHovered ? 0.2 : 0.0), radius: 8)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isHovered)
        .onHover { hovering in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isHovered = hovering
            }
        }
        .onTapGesture {
            searchManager.openMemory(memory)
        }
    }
    
    private var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: memory.timestamp, relativeTo: Date())
    }
}

#Preview {
    ContentView()
        .environmentObject(HotkeyManager())
        .environmentObject(SearchManager())
}
