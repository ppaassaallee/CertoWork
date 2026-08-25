import WidgetKit
import SwiftUI

struct CertoWorkProvider: TimelineProvider {
    func placeholder(in context: Context) -> CertoWorkEntry {
        CertoWorkEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (CertoWorkEntry) -> Void) {
        completion(CertoWorkEntry(date: Date(), snapshot: .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CertoWorkEntry>) -> Void) {
        Task {
            let snapshot = (try? await WidgetStore.fetchSnapshot()) ?? .placeholder
            let entry = CertoWorkEntry(date: Date(), snapshot: snapshot)
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }
}

struct CertoWorkEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct CertoWorkWidgetView: View {
    var entry: CertoWorkEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("CERTO WORK")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(entry.snapshot.dateLabel)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Text("2 must-dos")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Color(red: 0.25, green: 0.42, blue: 0.32))
            ForEach(Array(entry.snapshot.mustDos.prefix(2).enumerated()), id: \.element.id) { index, item in
                HStack(alignment: .top, spacing: 6) {
                    Text("\(index + 1)")
                        .font(.caption2.weight(.bold))
                        .frame(width: 16, height: 16)
                        .background(Color.primary.opacity(0.9), in: Circle())
                        .foregroundStyle(Color(red: 0.97, green: 0.96, blue: 0.93))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(item.title)
                            .font(.caption.weight(.semibold))
                            .lineLimit(2)
                        if let project = item.project, !project.isEmpty {
                            Text(project)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if family != .systemSmall, !entry.snapshot.shouldDos.isEmpty {
                Text("Should dos")
                    .font(.caption2.weight(.bold))
                    .padding(.top, 2)
                ForEach(entry.snapshot.shouldDos.prefix(family == .systemLarge ? 6 : 3)) { item in
                    Text(item.title)
                        .font(.caption)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            Text(entry.snapshot.odysseusLine)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .containerBackground(Color(red: 0.97, green: 0.96, blue: 0.93), for: .widget)
    }
}

extension WidgetTask: Identifiable {}

struct CertoWorkWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "CertoWorkToday", provider: CertoWorkProvider()) { entry in
            CertoWorkWidgetView(entry: entry)
        }
        .configurationDisplayName("Certo Work")
        .description("Today’s 2 must-dos and should-dos.")
        #if os(macOS)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
        #else
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        #endif
    }
}

@main
struct CertoWorkWidgetBundle: WidgetBundle {
    var body: some Widget {
        CertoWorkWidget()
    }
}
