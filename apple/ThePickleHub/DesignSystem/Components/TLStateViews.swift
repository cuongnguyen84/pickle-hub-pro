import SwiftUI

/// Shared loading / empty / error surfaces for The Line. One skeleton style
/// (redacted rows — never mix spinner + redacted), one empty layout, one error
/// layout, so every feature reads the same.

/// Skeleton placeholder list — redacted thumbnail + two text lines per row.
struct TLLoadingView: View {
    var rows = 4

    var body: some View {
        VStack(alignment: .leading, spacing: TLSpacing.lg) {
            ForEach(0..<rows, id: \.self) { _ in
                HStack(spacing: TLSpacing.md) {
                    RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                        .fill(TLColor.surface)
                        .frame(width: 120, height: 76)
                    VStack(alignment: .leading, spacing: TLSpacing.sm) {
                        RoundedRectangle(cornerRadius: 4).fill(TLColor.surface).frame(height: 14)
                        RoundedRectangle(cornerRadius: 4).fill(TLColor.surface).frame(width: 120, height: 10)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .redacted(reason: .placeholder)
        .accessibilityLabel("Đang tải")
    }
}

/// Centered empty state — icon, title, subtitle, optional CTA.
struct TLEmptyState: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: TLSpacing.md) {
            Image(systemName: icon).font(.system(size: 34)).foregroundStyle(TLColor.fg4)
            Text(title).font(TLType.titleSans(15)).foregroundStyle(TLColor.fg)
            if let subtitle {
                Text(subtitle)
                    .font(TLType.bodySans(12.5))
                    .foregroundStyle(TLColor.fg3)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(TLFont.sans(13, .semibold))
                    .foregroundStyle(TLColor.accentText)
                    .padding(.top, TLSpacing.xs)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, TLSpacing.xxl)
        .padding(.vertical, 50)
    }
}

/// Error state — shares the empty layout, adds a retry CTA.
struct TLErrorState: View {
    var title = "Không tải được"
    let message: String
    var retry: (() -> Void)? = nil

    var body: some View {
        TLEmptyState(
            icon: "exclamationmark.triangle",
            title: title,
            subtitle: message,
            actionTitle: retry == nil ? nil : "Thử lại",
            action: retry
        )
    }
}
