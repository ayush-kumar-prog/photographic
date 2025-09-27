import Foundation

// MARK: - Data Models
struct SearchResult: Identifiable, Codable, Equatable {
    let id: String
    let ts: Int64
    let app: String
    let urlHost: String?
    let titleSnippet: String
    let thumbUrl: String?
    let score: Double
    let nugget: Nugget?
    
    // Add CodingKeys to map snake_case from API to camelCase in Swift
    enum CodingKeys: String, CodingKey {
        case id
        case ts
        case app
        case urlHost = "url_host"
        case titleSnippet = "title_snippet"
        case thumbUrl = "thumb_url"
        case score
        case nugget
    }
    
    var timestamp: Date {
        Date(timeIntervalSince1970: Double(ts) / 1000.0)
    }
    
    var appIcon: String {
        switch app.lowercased() {
        case "safari": return "safari"
        case "chrome": return "globe"
        case "cursor", "code": return "curlybraces"
        case "terminal": return "terminal"
        case "youtube": return "play.rectangle"
        default: return "app"
        }
    }
}

struct Nugget: Codable, Equatable {
    let type: String
    let value: String
    let confidence: Double
}

struct SearchResponse: Codable {
    let mode: String
    let confidence: Double
    let cards: [SearchResult]
    let queryParsed: QueryParsed?
    
    enum CodingKeys: String, CodingKey {
        case mode, confidence, cards
        case queryParsed = "query_parsed"
    }
}

struct QueryParsed: Codable {
    let timeWindow: TimeWindow?
    let appHints: [String]?
    let answerField: String?
    
    enum CodingKeys: String, CodingKey {
        case timeWindow = "time_window"
        case appHints = "app_hints"
        case answerField = "answer_field"
    }
}

struct TimeWindow: Codable {
    let from: String
    let to: String
}