import SwiftUI

/// Large, thumb-friendly quantity control: tap +/−, long-press to repeat, or tap the number to type.
struct QuantityStepper: View {
    @Binding var value: Int
    var range: ClosedRange<Int> = 1...1_000_000
    var unit: String?
    var tint: Color = .accentColor

    @FocusState private var editing: Bool
    @State private var text = ""

    var body: some View {
        HStack(spacing: 18) {
            stepButton(symbol: "minus", delta: -1)
                .disabled(value <= range.lowerBound)

            VStack(spacing: 0) {
                ZStack {
                    TextField("0", text: $text)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .focused($editing)
                        .opacity(editing ? 1 : 0)
                        .onChange(of: text) { _, newValue in
                            let digits = newValue.filter(\.isNumber)
                            if digits != newValue { text = digits }
                            if let number = Int(digits) { value = min(range.upperBound, number) }
                        }
                    if !editing {
                        Text(value, format: .number)
                            .contentTransition(.numericText(value: Double(value)))
                            .onTapGesture {
                                text = String(value)
                                editing = true
                            }
                    }
                }
                .font(.system(size: 52, weight: .bold, design: .rounded))
                .monospacedDigit()
                .frame(minWidth: 110)
                .animation(.snappy(duration: 0.2), value: value)

                if let unit {
                    Text(unit)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            stepButton(symbol: "plus", delta: 1)
                .disabled(value >= range.upperBound)
        }
        .onChange(of: editing) { _, isEditing in
            if !isEditing { value = min(max(value, range.lowerBound), range.upperBound) }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { editing = false }
                    .bold()
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Quantity")
        .accessibilityValue("\(value) \(unit ?? "")")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: value = min(range.upperBound, value + 1)
            case .decrement: value = max(range.lowerBound, value - 1)
            @unknown default: break
            }
        }
    }

    private func stepButton(symbol: String, delta: Int) -> some View {
        RepeatButton {
            let next = value + delta
            guard range.contains(next) else { return }
            value = next
            Haptics.selection()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .bold))
                .frame(width: 58, height: 58)
                .foregroundStyle(tint)
                .background(tint.opacity(0.13), in: .circle)
        }
    }
}

/// A button that fires repeatedly (and faster) while held.
private struct RepeatButton<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: Label
    @State private var timer: Task<Void, Never>?
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        label
            .opacity(isEnabled ? 1 : 0.35)
            .contentShape(.circle)
            .onTapGesture { if isEnabled { action() } }
            .onLongPressGesture(minimumDuration: 0.35, pressing: { pressing in
                if pressing, isEnabled {
                    timer?.cancel()
                    timer = Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(350))
                        var interval = 140
                        while !Task.isCancelled {
                            action()
                            try? await Task.sleep(for: .milliseconds(interval))
                            interval = max(40, interval - 12)
                        }
                    }
                } else {
                    timer?.cancel()
                    timer = nil
                }
            }, perform: {})
            .accessibilityAddTraits(.isButton)
    }
}

/// Quick-pick chips for common adjustment reasons.
struct ReasonPicker: View {
    @Binding var reason: String
    let suggestions: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(suggestions, id: \.self) { suggestion in
                        let selected = reason == suggestion
                        Button {
                            reason = selected ? "" : suggestion
                            Haptics.selection()
                        } label: {
                            Text(suggestion)
                                .font(.subheadline.weight(.medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .foregroundStyle(selected ? Color.white : Color.primary)
                                .background(selected ? Color.accentColor : Color(.tertiarySystemFill), in: .capsule)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollClipDisabled()
            TextField("Reason (optional)", text: $reason, axis: .vertical)
                .lineLimit(1...3)
        }
    }

    static let inbound = ["Received", "Returned", "Count correction", "Found", "Production"]
    static let outbound = ["Sold", "Used", "Damaged", "Expired", "Count correction", "Lost"]
}
