import SwiftUI

struct MemoryCard: View {
    let memory: SearchResult
    @State private var isHovered = false
    @State private var isPressed = false
    @EnvironmentObject var searchManager: SearchManager
    
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 80, height: 80)
                
                Image(systemName: memory.appIcon)
                    .font(.system(size: 32, weight: .light))
                    .foregroundColor(.cyan)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(highlightedTitle)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    
                    Spacer()
                    
                    if memory.score > 0.8 {
                        Circle()
                            .fill(Color.green.opacity(0.6))
                            .frame(width: 8, height: 8)
                    } else if memory.score > 0.6 {
                        Circle()
                            .fill(Color.yellow.opacity(0.6))
                            .frame(width: 8, height: 8)
                    }
                }
                
                HStack(spacing: 8) {
                    Text(memory.app)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    
                    if let urlHost = memory.urlHost, !urlHost.isEmpty {
                        Text("•")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary.opacity(0.5))
                        
                        Text(urlHost)
                            .font(.system(size: 14, weight: .light))
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                }
                
                Text(timeAgo)
                    .font(.system(size: 12, weight: .light))
                    .foregroundColor(.secondary.opacity(0.7))
            }
            
            if isHovered {
                VStack(spacing: 8) {
                    Button(action: {
                        searchManager.openMemory(memory)
                    }) {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.cyan)
                            .padding(8)
                            .background(Color.cyan.opacity(0.1))
                            .clipShape(Circle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    if let nugget = memory.nugget {
                        Button(action: {
                            searchManager.copyToClipboard(nugget.value)
                        }) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.blue)
                                .padding(8)
                                .background(Color.blue.opacity(0.1))
                                .clipShape(Circle())
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(20)
        .background(
            LiquidGlassCard()
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.cyan.opacity(isHovered ? 0.4 : 0.0),
                                    Color.blue.opacity(isHovered ? 0.2 : 0.0),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .scaleEffect(isPressed ? 0.98 : (isHovered ? 1.02 : 1.0))
        .shadow(color: .cyan.opacity(isHovered ? 0.2 : 0.0), radius: 8)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isHovered)
        .animation(.spring(response: 0.2, dampingFraction: 0.9), value: isPressed)
        .onHover { hovering in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isHovered = hovering
            }
        }
        .onTapGesture {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.9)) {
                isPressed = true
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.9)) {
                    isPressed = false
                }
                searchManager.openMemory(memory)
            }
        }
    }
    
    private var highlightedTitle: AttributedString {
        var attributedString = AttributedString(memory.titleSnippet)
        
        if let nugget = memory.nugget {
            if let range = attributedString.range(of: nugget.value) {
                attributedString[range].foregroundColor = .cyan
                attributedString[range].font = .system(size: 16, weight: .semibold)
            }
        }
        
        return attributedString
    }
    
    private var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: memory.timestamp, relativeTo: Date())
    }
}

#Preview {
    ZStack {
        Color.black
        
        VStack(spacing: 16) {
            MemoryCard(memory: SearchResult(
                id: "1",
                ts: Int64(Date().timeIntervalSince1970 * 1000),
                app: "Safari",
                urlHost: "amazon.com",
                titleSnippet: "OMEGA Seamaster Aqua Terra — $3,495",
                thumbUrl: nil,
                score: 0.95,
                nugget: Nugget(type: "price", value: "$3,495", confidence: 0.9)
            ))
            
            MemoryCard(memory: SearchResult(
                id: "2",
                ts: Int64(Date().addingTimeInterval(-3600).timeIntervalSince1970 * 1000),
                app: "YouTube",
                urlHost: "youtube.com",
                titleSnippet: "Microeconomics Explained - Khan Academy",
                thumbUrl: nil,
                score: 0.87,
                nugget: Nugget(type: "title", value: "Microeconomics Explained", confidence: 0.85)
            ))
        }
        .environmentObject(SearchManager.preview())
        .padding()
    }
    .ignoresSafeArea()
}