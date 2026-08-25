import SwiftUI
import WidgetKit

struct ContentView: View {
    @State private var token = WidgetStore.token
    @State private var status = "Paste the WidgetKit feed token from Certo Work → Settings."

    var body: some View {
        NavigationStack {
            Form {
                Section("Apple widget") {
                    TextField("Widget token", text: $token)
                        #if os(iOS)
                        .textInputAutocapitalization(.never)
                        #endif
                        .autocorrectionDisabled()
                    Button("Save and refresh widgets") {
                        WidgetStore.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
                        WidgetCenter.shared.reloadAllTimelines()
                        status = "Saved. Add the Certo Work widget from the Home Screen or Mac Desktop."
                    }
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("How to add it") {
                    Text("iPhone: long-press the Home Screen → Add Widget → Certo Work.")
                    Text("Mac: Notification Center or Desktop → Edit Widgets → Certo Work.")
                }
            }
            .navigationTitle("Certo Work")
        }
        .onAppear { token = WidgetStore.token }
    }
}
