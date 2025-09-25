import SwiftUI

struct LiquidGlassMaterial: View {
    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial.opacity(0.6))
            
            LinearGradient(
                colors: [
                    Color.white.opacity(0.8),
                    Color.white.opacity(0.4),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            LinearGradient(
                colors: [
                    Color.white.opacity(0.3),
                    Color.clear
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 1)
            .offset(y: -12)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(Color.white.opacity(0.3), lineWidth: 1)
        )
    }
}

struct LiquidGlassCard: View {
    var cornerRadius: CGFloat = 16
    
    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial.opacity(0.5))
            
            LinearGradient(
                colors: [
                    Color.white.opacity(0.6),
                    Color.white.opacity(0.2),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
        )
    }
}

#Preview {
    ZStack {
        Color.black
        
        VStack(spacing: 20) {
            Rectangle()
                .frame(width: 300, height: 200)
                .background(LiquidGlassMaterial())
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .shadow(color: .black.opacity(0.1), radius: 20, x: 0, y: 10)
            
            Rectangle()
                .frame(width: 250, height: 100)
                .background(LiquidGlassCard())
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 5)
        }
    }
    .ignoresSafeArea()
}