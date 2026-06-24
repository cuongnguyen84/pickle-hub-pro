import SwiftUI

/// One match cell in a bracket column.
struct BracketSlot: Identifiable {
    let id: UUID
    let topName: String
    let botName: String
    let topScore: String   // "" → shown as "–"
    let botScore: String
    let topWon: Bool
    let botWon: Bool
    let completed: Bool
    let onTap: (() -> Void)?
}

/// One round (column) of the bracket, ordered first-round → final.
struct BracketRound: Identifiable {
    let id: Int
    let title: String
    let doneCount: Int
    let slots: [BracketSlot]
}

/// Generic horizontal single-elimination bracket — one column per round, matches
/// vertically centered between feeders, elbow connectors. Shared by Quick Table
/// (its own copy predates this) and Team Match playoff.
struct BracketTreeView: View {
    let rounds: [BracketRound]

    private let cardW: CGFloat = 190
    private let cardH: CGFloat = 76
    private let gap0: CGFloat = 16
    private var pitch: CGFloat { cardH + gap0 }
    private let connW: CGFloat = 26
    private let headerBlock: CGFloat = 30

    var body: some View {
        let firstCount = rounds.first?.slots.count ?? 1
        let totalH = headerBlock + CGFloat(firstCount) * pitch
        ScrollView(.horizontal, showsIndicators: true) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(rounds.enumerated()), id: \.element.id) { r, round in
                    column(round, index: r)
                    if r < rounds.count - 1 { connector(leftCount: round.slots.count, index: r) }
                }
            }
            .frame(height: totalH, alignment: .top)
            .padding(.horizontal, 16)
        }
        .frame(height: totalH)
        .padding(.horizontal, -16)
    }

    private func p2(_ r: Int) -> CGFloat { pow(2, CGFloat(r)) }

    private func column(_ round: BracketRound, index r: Int) -> some View {
        let unit = pitch * p2(r)
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text(round.title.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg2)
                Text("\(round.doneCount)/\(round.slots.count)").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4).monospacedDigit()
            }
            .frame(height: headerBlock, alignment: .center)
            VStack(spacing: unit - cardH) {
                ForEach(round.slots) { card($0) }
            }
            .padding(.top, unit / 2 - cardH / 2)
            Spacer(minLength: 0)
        }
        .frame(width: cardW)
    }

    private func connector(leftCount: Int, index r: Int) -> some View {
        let unit = pitch * p2(r)
        let pairs = max(0, leftCount / 2)
        return VStack(spacing: 0) {
            Color.clear.frame(height: headerBlock + unit * 0.5)
            ForEach(0..<pairs, id: \.self) { i in
                ZStack(alignment: .leading) {
                    Rectangle().fill(TLColor.border2).frame(width: 1.5)
                    Rectangle().fill(TLColor.border2).frame(height: 1.5)
                }
                .frame(width: connW, height: unit)
                if i < pairs - 1 { Color.clear.frame(height: unit) }
            }
            Spacer(minLength: 0)
        }
        .frame(width: connW)
    }

    private func card(_ s: BracketSlot) -> some View {
        Button { s.onTap?() } label: {
            VStack(spacing: 0) {
                row(s.topName, s.topScore, s.topWon, s.completed)
                Rectangle().fill(TLColor.border).frame(height: 1)
                row(s.botName, s.botScore, s.botWon, s.completed)
            }
            .frame(width: cardW, height: cardH)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(s.onTap == nil)
    }

    private func row(_ name: String, _ score: String, _ won: Bool, _ completed: Bool) -> some View {
        HStack(spacing: 8) {
            Rectangle().fill(won ? TLColor.accent : Color.clear).frame(width: 2)
            Text(name).font(TLFont.sans(13, won ? .semibold : .regular))
                .foregroundStyle(won ? TLColor.fg : TLColor.fg2).lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(score.isEmpty ? "–" : score)
                .font(TLFont.mono(13, .semibold)).monospacedDigit()
                .foregroundStyle(won ? TLColor.accentText : TLColor.fg4)
                .padding(.trailing, 10)
        }
        .frame(maxHeight: .infinity)
        .background(won ? TLColor.accent.opacity(0.08) : Color.clear)
    }
}
