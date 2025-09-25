import SwiftUI

struct LiquidGlassOverlay: View {
    @EnvironmentObject var searchManager: SearchManager
    @State private var animateIn = false
    @State private var shouldFocusSearch = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Header with liquid glass orbs
            HStack {
                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { _ in
                        Circle()
                            .fill(Color.white.opacity(0.3))
                            .frame(width: 8, height: 8)
                    }
                }
                
                Spacer()
                
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
            
            // Search bar with liquid glass effect
            LiquidSearchBar(shouldFocus: $shouldFocusSearch)
                .environmentObject(searchManager)
                .padding(.horizontal, 24)
            
            // Results section
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(Array(searchManager.searchResults.enumerated()), id: \.offset) { index, result in
                        MemoryCard(memory: result)
                            .environmentObject(searchManager)
                            .transition(.asymmetric(
                                insertion: .move(edge: .top).combined(with: .opacity),
                                removal: .scale.combined(with: .opacity)
                            ))
                            .animation(
                                .spring(response: 0.5, dampingFraction: 0.7)
                                    .delay(Double(index) * 0.1),
                                value: searchManager.searchResults.count
                            )
                    }
                }
                .padding(.horizontal, 24)
            }
            
            // Empty state
            if searchManager.searchResults.isEmpty && !searchManager.searchText.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.largeTitle)
                        .foregroundColor(.secondary.opacity(0.5))
                    
                    Text("No memories found")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text("Try a different search term or check if your services are running")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(40)
                .background(LiquidGlassCard())
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .padding(.horizontal, 24)
            }
            
            // Placeholder state
            if searchManager.searchText.isEmpty {
                VStack(spacing: 24) {
                    // Floating memory icons
                    HStack(spacing: 20) {
                        ForEach(["brain.head.profile", "clock", "magnifyingglass"], id: \.self) { icon in
                            Image(systemName: icon)
                                .font(.system(size: 32, weight: .ultraLight))
                                .foregroundColor(.cyan.opacity(0.4))
                        }
                    }
                    
                    VStack(spacing: 12) {
                        Text("✨ Your Photographic Memory")
                            .font(.title)
                            .fontWeight(.light)
                            .foregroundColor(.primary)
                        
                        Text("Press ⌘⇧\" to toggle this overlay")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("Start typing to search through your digital memories")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    
                    // Example queries
                    VStack(spacing: 8) {
                        Text("Try searching for:")
                            .font(.caption)
                            .foregroundColor(.secondary.opacity(0.8))
                        
                        VStack(spacing: 4) {
                            exampleQuery("\"Amazon product yesterday\"")
                            exampleQuery("\"YouTube video last week\"")
                            exampleQuery("\"Terminal error message\"")
                        }
                    }
                }
                .padding(40)
            }
        }
        .frame(width: 600, height: 800)
        .background(LiquidGlassMaterial())
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.1), radius: 20, x: 0, y: 10)
        .shadow(color: .black.opacity(0.05), radius: 40, x: 0, y: 20)
        .scaleEffect(animateIn ? 1.0 : 0.9)
        .opacity(animateIn ? 1.0 : 0.0)
        .blur(radius: animateIn ? 0 : 10)
        .animation(.spring(response: 0.6, dampingFraction: 0.8), value: animateIn)
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.6)) {
                animateIn = true
            }
            
            // Focus search bar after animation
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                shouldFocusSearch = true
                print("🎯 Triggering search focus from overlay")
            }
        }
        .onDisappear {
            animateIn = false
        }
    }
    
    private func exampleQuery(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .light))
            .foregroundColor(.secondary.opacity(0.6))
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background(Color.white.opacity(0.05))
            .clipShape(Capsule())
    }
}

#Preview {
    ZStack {
        Color.black
        
        LiquidGlassOverlay()
            .environmentObject(SearchManager.preview())
    }
    .ignoresSafeArea()
}