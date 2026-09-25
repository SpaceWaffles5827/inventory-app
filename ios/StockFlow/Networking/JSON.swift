import Foundation

/// Shared JSON coders matching the StockFlow API (ISO-8601 dates, with or without milliseconds).
enum JSON {
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            if let string = try? container.decode(String.self) {
                if let date = DateParsing.parse(string) { return date }
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(string)")
            }
            let millis = try container.decode(Double.self)
            return Date(timeIntervalSince1970: millis / 1000)
        }
        return decoder
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(DateParsing.string(from: date))
        }
        return encoder
    }()
}

enum DateParsing {
    private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let whole: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let dateOnly: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter
    }()

    static func parse(_ string: String) -> Date? {
        fractional.date(from: string) ?? whole.date(from: string) ?? dateOnly.date(from: string)
    }

    static func string(from date: Date) -> String {
        fractional.string(from: date)
    }
}

/// Calendar days (lot expiry / manufacture dates). The web sends these as
/// "yyyy-MM-dd", which the server stores as UTC midnight.
enum DateOnly {
    /// "2027-03-24" for the local calendar day of `date`.
    static func string(from date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// The same calendar day as a stored UTC-midnight date, at local midnight.
    static func localDay(fromStored date: Date) -> Date {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let c = utc.dateComponents([.year, .month, .day], from: date)
        return Calendar.current.date(from: c) ?? date
    }
}

/// A string that the server may send as a number (legacy location structure values).
struct LenientString: Decodable, Hashable {
    let value: String

    init(_ value: String) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = String(int)
        } else if let double = try? container.decode(Double.self) {
            value = String(double)
        } else if container.decodeNil() {
            value = ""
        } else {
            value = ""
        }
    }
}

/// Decodes to nothing; for endpoints whose `data` we don't need.
struct EmptyPayload: Decodable {}
