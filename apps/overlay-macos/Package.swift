// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MemoryOverlay",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "MemoryOverlay",
            targets: ["MemoryOverlay"]
        )
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "MemoryOverlay",
            dependencies: [],

            path: "Sources/MemoryOverlay"
        )
    ]
)