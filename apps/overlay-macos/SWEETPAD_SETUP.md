# SweetPad Setup Guide for Memory Overlay

> Complete setup guide for developing the SwiftUI Memory Overlay in Cursor using SweetPad

## 🎯 Overview

This guide will help you set up SweetPad for seamless Swift development directly in Cursor, eliminating the need to switch between Cursor and Xcode.

## 📋 Prerequisites

- **macOS 14.0+** (Apple Silicon recommended)
- **Cursor** (or VS Code)
- **Xcode Command Line Tools** installed
- **Homebrew** package manager

## 🛠️ Installation Steps

### 1. Install Required Tools

```bash
# Install SweetPad dependencies via Homebrew
brew install xcode-build-server xcbeautify swiftformat

# Verify installations
which xcode-build-server  # Should show /opt/homebrew/bin/xcode-build-server
which xcbeautify          # Should show /opt/homebrew/bin/xcbeautify
which swiftformat         # Should show /opt/homebrew/bin/swiftformat
```

### 2. Install SweetPad Extension

1. Open Cursor
2. Press `⌘⇧X` to open Extensions
3. Search for "SweetPad"
4. Click "Install"

### 3. Configure SweetPad Settings

The project already includes `.vscode/settings.json` with optimal SweetPad configuration:

```json
{
  "[swift]": {
    "editor.defaultFormatter": "sweetpad.sweetpad",
    "editor.formatOnSave": true,
    "editor.tabSize": 4,
    "editor.insertSpaces": true
  },
  "swift.path": "/usr/bin/swift",
  "swift.buildPath": "/usr/bin/swift",
  "sweetpad.buildServer.enabled": true,
  "sweetpad.buildServer.path": "/opt/homebrew/bin/xcode-build-server",
  "sweetpad.xcbeautify.enabled": true,
  "sweetpad.xcbeautify.path": "/opt/homebrew/bin/xcbeautify",
  "sweetpad.swiftformat.enabled": true,
  "sweetpad.swiftformat.path": "/opt/homebrew/bin/swiftformat"
}
```

## 🚀 Development Workflow

### Building & Running

#### Option 1: Using Cursor Tasks (Recommended)
1. Press `⌘⇧P` to open Command Palette
2. Type "Tasks: Run Task"
3. Select from available tasks:
   - **swift-build** - Build debug version
   - **swift-build-release** - Build release version
   - **swift-run** - Build and run directly
   - **swift-clean** - Clean build artifacts

#### Option 2: Using Terminal
```bash
# Build debug version
swift build

# Build release version
swift build -c release

# Run directly
swift run

# Clean build artifacts
swift package clean
```

#### Option 3: Using npm Scripts
```bash
# From project root
pnpm start:overlay

# This runs: cd apps/overlay-macos && ./build.sh && ./.build/debug/MemoryOverlay
```

### Debugging

1. Set breakpoints in your Swift code by clicking in the gutter
2. Press `F5` or go to Run > Start Debugging
3. Select "Debug MemoryOverlay" configuration
4. The app will build and launch with debugger attached

### Code Formatting

- **Automatic**: Code formats on save (configured in settings)
- **Manual**: Press `⌘⇧P` → "Format Document"
- **Custom**: Modify `.swiftformat` file in project root

## 🎨 SweetPad Features You Can Use

### 1. **Syntax Highlighting**
- Full Swift syntax highlighting
- SwiftUI-specific highlighting
- Error and warning indicators

### 2. **Code Completion**
- IntelliSense for Swift and SwiftUI
- Auto-completion for system frameworks
- Import suggestions

### 3. **Build Integration**
- Real-time build errors and warnings
- Integrated build output with xcbeautify
- Quick fix suggestions

### 4. **Debugging**
- Full LLDB integration
- Breakpoint support
- Variable inspection
- Call stack navigation

### 5. **Code Formatting**
- SwiftFormat integration
- Customizable formatting rules
- Format on save

## 📁 Project Structure

```
apps/overlay-macos/
├── Package.swift                    # Swift Package definition
├── Sources/MemoryOverlay/          # Swift source files
│   ├── main.swift                  # App entry point
│   ├── ContentView.swift           # Main view
│   ├── LiquidGlassOverlay.swift    # Overlay UI
│   ├── LiquidSearchBar.swift       # Search component
│   ├── MemoryCard.swift            # Result cards
│   ├── Materials.swift             # Glass materials
│   └── Models.swift                # Data models & managers
├── .vscode/                        # VS Code/Cursor configuration
│   ├── settings.json               # SweetPad settings
│   ├── tasks.json                  # Build tasks
│   └── launch.json                 # Debug configuration
├── build.sh                        # Build script
└── SWEETPAD_SETUP.md              # This guide
```

## 🔧 Customization

### SwiftFormat Configuration

Create `.swiftformat` in project root:

```
--indent 4
--linebreaks lf
--maxwidth 120
--wraparguments before-first
--wrapcollections before-first
--closingparen balanced
--commas inline
--semicolons never
--trimwhitespace always
--insertlines enabled
--removelines enabled
```

### Custom Build Settings

Modify `Package.swift` for custom build settings:

```swift
.executableTarget(
    name: "MemoryOverlay",
    dependencies: [],
    path: "Sources/MemoryOverlay",
    swiftSettings: [
        .define("DEBUG", .when(configuration: .debug))
    ]
)
```

## 🐛 Troubleshooting

### SweetPad Not Working
1. Restart Cursor
2. Check that all tools are installed: `brew list | grep -E "(xcode-build-server|xcbeautify|swiftformat)"`
3. Verify Swift is available: `swift --version`

### Build Errors
1. Clean build: `swift package clean`
2. Update dependencies: `swift package update`
3. Check Swift version: `swift --version` (should be 5.9+)

### Code Completion Not Working
1. Open Command Palette (`⌘⇧P`)
2. Run "Swift: Restart Language Server"
3. Wait for indexing to complete

### Debugging Issues
1. Ensure build succeeds first
2. Check that binary exists: `ls -la .build/debug/MemoryOverlay`
3. Verify launch.json configuration

## 🎯 Development Tips

### 1. **Live Preview**
- Use SwiftUI previews in your code
- SweetPad will show preview errors inline

### 2. **Quick Actions**
- `⌘⇧P` → "Swift: Build" for quick builds
- `⌘⇧P` → "Swift: Run" to build and run
- `F5` to start debugging

### 3. **Code Navigation**
- `⌘Click` to go to definition
- `⌘⇧O` to open symbol by name
- `⌘T` to go to file

### 4. **Integrated Terminal**
- `` ⌃` `` to open terminal
- Run Swift commands directly
- Monitor build output

## 🎉 Benefits of This Setup

✅ **Single IDE**: Develop entirely in Cursor  
✅ **AI Integration**: Use Cursor's AI features with Swift  
✅ **Fast Builds**: Optimized Swift Package Manager builds  
✅ **Full Debugging**: Complete LLDB integration  
✅ **Code Quality**: Automatic formatting and linting  
✅ **Live Feedback**: Real-time error checking  

## 🚀 Next Steps

1. **Open the project** in Cursor: `cursor apps/overlay-macos`
2. **Install SweetPad** extension if not already installed
3. **Build the project**: Press `⌘⇧P` → "Tasks: Run Task" → "swift-build"
4. **Run the app**: Press `F5` to start debugging
5. **Start coding**: Edit Swift files with full IDE support!

---

**You now have a complete Swift development environment in Cursor! 🎯**
