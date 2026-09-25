import SwiftUI
import UIKit

// MARK: - Formatting

enum Format {
    static func currency(_ value: Double) -> String {
        value.formatted(.currency(code: "USD").precision(.fractionLength(value.magnitude >= 10_000 ? 0 : 2)))
    }

    static func compactCurrency(_ value: Double) -> String {
        if value.magnitude >= 10_000 {
            return value.formatted(.currency(code: "USD").notation(.compactName).precision(.fractionLength(0...1)))
        }
        return currency(value)
    }

    static func number(_ value: Int) -> String {
        value.formatted(.number)
    }

    static func compact(_ value: Int) -> String {
        value.magnitude >= 10_000 ? value.formatted(.number.notation(.compactName)) : value.formatted(.number)
    }

    static func signed(_ value: Int) -> String {
        value > 0 ? "+\(number(value))" : number(value)
    }

    static func relative(_ date: Date) -> String {
        let seconds = Date.now.timeIntervalSince(date)
        if seconds < 60 { return "Just now" }
        return date.formatted(.relative(presentation: .named, unitsStyle: .abbreviated))
    }

    static func day(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        if Calendar.current.isDate(date, equalTo: .now, toGranularity: .weekOfYear) {
            return date.formatted(.dateTime.weekday(.wide))
        }
        if Calendar.current.isDate(date, equalTo: .now, toGranularity: .year) {
            return date.formatted(.dateTime.weekday(.wide).month(.wide).day())
        }
        return date.formatted(date: .long, time: .omitted)
    }

    static func expiry(days: Int) -> String {
        switch days {
        case ..<(-1): "Expired \(-days) days ago"
        case -1: "Expired yesterday"
        case 0: "Expires today"
        case 1: "Expires tomorrow"
        default: "Expires in \(days) days"
        }
    }
}

// MARK: - Haptics

@MainActor
enum Haptics {
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func selection() { UISelectionFeedbackGenerator().selectionChanged() }
}

// MARK: - Cards

struct CardBackground: ViewModifier {
    var padding: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 22, style: .continuous))
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardBackground(padding: padding)) }

    /// Liquid Glass on iOS 26, a material capsule before that.
    @ViewBuilder
    func glassCapsule(interactive: Bool = true) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(interactive ? .regular.interactive() : .regular, in: .capsule)
        } else {
            background(.ultraThinMaterial, in: .capsule)
        }
    }

    @ViewBuilder
    func glassCircle() -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.interactive(), in: .circle)
        } else {
            background(.ultraThinMaterial, in: .circle)
        }
    }

    @ViewBuilder
    func glassRounded(_ radius: CGFloat = 24, tint: Color? = nil) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(tint.map { .regular.tint($0) } ?? .regular, in: .rect(cornerRadius: radius, style: .continuous))
        } else {
            background(.regularMaterial, in: .rect(cornerRadius: radius, style: .continuous))
        }
    }

    @ViewBuilder
    func prominentGlassButton() -> some View {
        if #available(iOS 26.0, *) {
            buttonStyle(.glassProminent)
        } else {
            buttonStyle(.borderedProminent)
        }
    }

    @ViewBuilder
    func glassButton() -> some View {
        if #available(iOS 26.0, *) {
            buttonStyle(.glass)
        } else {
            buttonStyle(.bordered)
        }
    }
}

// MARK: - Badges

struct StatusBadge: View {
    let status: ItemStatus
    var compact = false

    var body: some View {
        Label(status.title, systemImage: status.symbol)
            .labelStyle(.titleAndIcon)
            .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
            .foregroundStyle(status.color)
            .padding(.horizontal, compact ? 6 : 8)
            .padding(.vertical, compact ? 2 : 4)
            .background(status.color.opacity(0.14), in: .capsule)
    }
}

struct Pill: View {
    let text: String
    var color: Color = .secondary
    var symbol: String?

    var body: some View {
        HStack(spacing: 4) {
            if let symbol { Image(systemName: symbol) }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.13), in: .capsule)
    }
}

/// Small colored dot + level bar showing how close an item is to its reorder point.
struct StockGauge: View {
    let onHand: Int
    let reorderPoint: Int

    private var status: ItemStatus { .derive(onHand: onHand, reorderPoint: reorderPoint) }
    private var fraction: Double {
        guard reorderPoint > 0 else { return onHand > 0 ? 1 : 0 }
        return min(1, max(0, Double(onHand) / Double(reorderPoint * 2)))
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color(.tertiarySystemFill))
                Capsule()
                    .fill(status.color.gradient)
                    .frame(width: max(4, proxy.size.width * fraction))
            }
        }
        .frame(height: 6)
        .accessibilityLabel("\(onHand) on hand, reorder point \(reorderPoint)")
    }
}

// MARK: - Stat card

struct StatCard: View {
    let title: String
    let value: String
    let symbol: String
    var tint: Color = .accentColor
    var footnote: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(tint.gradient, in: .rect(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.title2.weight(.bold))
                    .fontDesign(.rounded)
                    .contentTransition(.numericText())
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let footnote {
                    Text(footnote)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: 14)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Section header

struct SectionHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.weight(.bold))
            Spacer()
            trailing
                .font(.subheadline.weight(.medium))
        }
        .padding(.horizontal, 4)
    }
}

extension SectionHeader where Trailing == EmptyView {
    init(title: String) {
        self.title = title
        self.trailing = EmptyView()
    }
}

// MARK: - Error banner

struct ErrorBanner: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let retry {
                Button("Retry", action: retry)
                    .font(.subheadline.bold())
            }
        }
        .padding(14)
        .background(Color.orange.opacity(0.12), in: .rect(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Toast

/// A transient confirmation shown at the top of the screen.
struct Toast: Equatable, Identifiable {
    enum Style { case success, error, info }
    let id = UUID()
    let message: String
    var style: Style = .success
    var symbol: String?

    static func == (lhs: Toast, rhs: Toast) -> Bool { lhs.id == rhs.id }
}

struct ToastModifier: ViewModifier {
    @Binding var toast: Toast?

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let toast {
                ToastView(toast: toast)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: toast.id) {
                        try? await Task.sleep(for: .seconds(2.4))
                        withAnimation(.snappy) { self.toast = nil }
                    }
                    .onTapGesture { withAnimation(.snappy) { self.toast = nil } }
            }
        }
        .animation(.spring(duration: 0.4, bounce: 0.25), value: toast)
    }
}

private struct ToastView: View {
    let toast: Toast

    private var symbol: String {
        toast.symbol ?? {
            switch toast.style {
            case .success: "checkmark.circle.fill"
            case .error: "xmark.octagon.fill"
            case .info: "info.circle.fill"
            }
        }()
    }

    private var color: Color {
        switch toast.style {
        case .success: .green
        case .error: .red
        case .info: .accentColor
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(color)
                .font(.title3)
            Text(toast.message)
                .font(.subheadline.weight(.semibold))
                .multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .glassCapsule(interactive: false)
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
        .padding(.horizontal, 24)
    }
}

extension View {
    func toast(_ toast: Binding<Toast?>) -> some View { modifier(ToastModifier(toast: toast)) }
}
