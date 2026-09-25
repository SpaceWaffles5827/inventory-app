import Foundation

/// Matches scanned codes to items and locations, using the same rules as the web
/// scanner (components/scanner/lookup.ts): case-insensitive, and numeric codes compare
/// without leading zeros so UPC-A / EAN-13 / GTIN-14 variants of one product match.
enum CodeMatcher {
    static func normalize(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func numericCore(_ value: String) -> String? {
        guard !value.isEmpty, value.allSatisfy(\.isASCIIDigit) else { return nil }
        let trimmed = value.drop { $0 == "0" }
        return trimmed.isEmpty ? "0" : String(trimmed)
    }

    static func sameCode(_ candidate: String?, _ normalizedCode: String) -> Bool {
        let left = normalize(candidate)
        guard !left.isEmpty else { return false }
        if left == normalizedCode { return true }
        guard let l = numericCore(left), let r = numericCore(normalizedCode) else { return false }
        return l == r
    }

    /// First element whose barcode matches, else whose fallback code (item number / location code) matches exactly.
    static func find<T>(
        in elements: [T],
        code raw: String,
        barcode: (T) -> String?,
        fallback: (T) -> String?
    ) -> T? {
        let code = normalize(raw)
        guard !code.isEmpty else { return nil }
        return elements.first { sameCode(barcode($0), code) }
            ?? elements.first { normalize(fallback($0)) == code }
    }

    static func item(in items: [Item], code: String) -> Item? {
        find(in: items, code: code, barcode: \.barcode, fallback: \.itemNumber)
    }

    static func location(in locations: [Location], code: String) -> Location? {
        find(in: locations, code: code, barcode: \.barcode, fallback: \.code)
    }
}

private extension Character {
    var isASCIIDigit: Bool { ("0"..."9").contains(self) }
}
