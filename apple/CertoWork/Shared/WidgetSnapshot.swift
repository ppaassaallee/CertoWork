import Foundation

struct WidgetTask: Codable, Hashable {
    var id: String
    var title: String
    var project: String?
}

struct WidgetSnapshot: Codable, Hashable {
    var workspaceName: String
    var dateLabel: String
    var dateKey: String
    var mustDos: [WidgetTask]
    var shouldDos: [WidgetTask]
    var pendingApprovals: Int
    var odysseusLine: String
    var updatedAt: Double

    static let placeholder = WidgetSnapshot(
        workspaceName: "Certo Work",
        dateLabel: "Today",
        dateKey: "",
        mustDos: [
            WidgetTask(id: "1", title: "Protect the core work", project: nil),
            WidgetTask(id: "2", title: "Move one project forward", project: nil),
        ],
        shouldDos: [
            WidgetTask(id: "3", title: "Clear messages", project: nil),
        ],
        pendingApprovals: 0,
        odysseusLine: "Talk with Odysseus, then apply the updates.",
        updatedAt: 0
    )
}

struct WidgetEnvelope: Codable {
    var snapshot: WidgetSnapshot
}

enum WidgetStore {
    static let suiteName = "group.ai.certo.work"
    static let tokenKey = "widgetToken"
    static let endpointKey = "widgetEndpoint"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    static var token: String {
        get { defaults.string(forKey: tokenKey) ?? "" }
        set { defaults.set(newValue, forKey: tokenKey) }
    }

    static var endpoint: String {
        get { defaults.string(forKey: endpointKey) ?? "https://certo.work" }
        set { defaults.set(newValue, forKey: endpointKey) }
    }

    static func feedURL() -> URL? {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return URL(string: "\(endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/api/widget/\(trimmed)")
    }

    static func fetchSnapshot() async throws -> WidgetSnapshot {
        guard let url = feedURL() else { return .placeholder }
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 15
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(WidgetEnvelope.self, from: data).snapshot
    }
}
