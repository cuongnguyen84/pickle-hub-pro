import SwiftUI

/// Surface card matching the web `.tl-card` look: dark surface, hairline border.
struct TLCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
                    .strokeBorder(TLColor.border, lineWidth: 1)
            )
    }
}

/// DS-03 — canonical button. Kind names follow the ROLE, not the web class
/// name, to defuse the naming trap the panel flagged: web `.tl-btn.primary`
/// is a CREAM fill while this file's older `TLPrimaryButton` is lime.
///   .green   ↔ web `<Button variant="default">` / `.tl-btn.green` (lime fill)
///   .cream   ↔ web `<Button variant="tl-primary">` / `.tl-btn.primary`
///   .outline ↔ web `<Button variant="outline">` / `.tl-btn` base
enum TLButtonKind {
    case green, cream, outline
}

struct TLButton: View {
    let title: LocalizedStringKey
    var kind: TLButtonKind = .green
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(spinnerTint)
                }
                Text(title).fontWeight(kind == .green ? .semibold : .medium)
            }
            .frame(maxWidth: .infinity, minHeight: 44) // A11Y-02 touch target
            .padding(.vertical, 2)
        }
        .background(background, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(borderColor, lineWidth: 1)
        )
        .foregroundStyle(foreground)
        .disabled(isLoading)
    }

    private var background: Color {
        switch kind {
        case .green: return TLColor.accent
        case .cream: return TLColor.fg
        case .outline: return .clear
        }
    }
    private var foreground: Color {
        switch kind {
        case .green: return TLColor.accentInk
        case .cream: return TLColor.bg
        case .outline: return TLColor.fg
        }
    }
    private var borderColor: Color {
        switch kind {
        case .green: return TLColor.accent
        case .cream: return TLColor.fg
        case .outline: return TLColor.border
        }
    }
    private var spinnerTint: Color {
        kind == .outline ? TLColor.fg : TLColor.bg
    }
}

/// Primary CTA — green fill, dark text. Kept for existing call sites;
/// delegates to the DS-03 canonical TLButton (.green).
struct TLPrimaryButton: View {
    let title: LocalizedStringKey
    var isLoading = false
    let action: () -> Void

    var body: some View {
        TLButton(title: title, kind: .green, isLoading: isLoading, action: action)
    }
}

/// DS-03 — 44×44 icon button. `label` is a REQUIRED accessibility name
/// (compile-time enforcement of the panel's a11y constraint).
struct TLIconButton: View {
    let systemName: String
    let label: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .frame(width: 44, height: 44)
        }
        .foregroundStyle(TLColor.fg2)
        .accessibilityLabel(label)
    }
}

/// DS-03 — mono-caps pill matching the web `.tl-format-badge` look.
struct TLBadge: View {
    let text: String
    var color: Color = TLColor.fg3

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .semibold, design: .monospaced))
            .tracking(0.6)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .overlay(Capsule().strokeBorder(color, lineWidth: 1))
            .foregroundStyle(color)
    }
}

/// DS-03 — themed select. Menu-based (native picker affordance), labeled
/// options with a bound selection value.
struct TLSelect<Value: Hashable>: View {
    let label: String
    let options: [(value: Value, label: String)]
    @Binding var selection: Value

    var body: some View {
        Menu {
            ForEach(options, id: \.value) { option in
                Button(option.label) { selection = option.value }
            }
        } label: {
            HStack {
                Text(currentLabel).foregroundStyle(TLColor.fg)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12))
                    .foregroundStyle(TLColor.fg3)
            }
            .frame(minHeight: 44)
            .padding(.horizontal, 14)
            .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                    .strokeBorder(TLColor.border, lineWidth: 1)
            )
        }
        .accessibilityLabel(label)
    }

    private var currentLabel: String {
        options.first(where: { $0.value == selection })?.label ?? label
    }
}

/// DS-03 — sheet body container. ALWAYS wraps content in a ScrollView:
/// at large Dynamic Type sizes a fixed-detent sheet silently clips the
/// bottom (confirm button, payment reference) with no scroll affordance —
/// the pre-mortem's silent-failure incident. Scroll makes every child
/// reachable at any type size.
struct TLSheet<Content: View>: View {
    var title: String? = nil
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let title {
                    Text(title)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(TLColor.fg)
                }
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(TLColor.bgElev)
    }
}

/// DS-03 — dialog body container for confirm-style modals presented via
/// `.sheet` + `.presentationDetents`. Same ScrollView rule as TLSheet.
struct TLDialog<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        TLSheet(title: title) { content }
    }
}

/// Dark text field styled to the theme.
struct TLTextField: View {
    let placeholder: LocalizedStringKey
    @Binding var text: String
    var isSecure = false
    var keyboard: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil

    var body: some View {
        Group {
            if isSecure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        }
        .textContentType(textContentType)
        .foregroundStyle(TLColor.fg)
        .padding(14)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(TLColor.border, lineWidth: 1)
        )
    }
}
